import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useContinueWatching } from '@/shared/domain/ContinueWatchingContext';
import {
  buildContinueUpsertPayload,
  CONTINUE_UPSERT_THROTTLE_MS,
  continueWatchingIdForSession,
  isContinueProgressComplete,
  isContinueSerialPlayback,
  shouldPersistContinueProgress,
} from '@/shared/domain/continueWatchingProgress';
import { usePlayer } from '@/shared/domain/PlayerContext';
import { useTorrents } from '@/shared/domain/TorrentsContext';
import { formatPlaybackTitle, hasMultipleEpisodes } from '@/shared/domain/torrentEpisodes';
import { useWatched } from '@/shared/domain/WatchedContext';
import { EpisodePickerDialog } from '@/shared/ui/EpisodePickerDialog/EpisodePickerDialog';
import {
  CaptionsIcon,
  FullscreenExitIcon,
  FullscreenIcon,
  LayersIcon,
  PauseBarsIcon,
  PictureInPictureIcon,
  PlayIcon,
  SkipBack10Icon,
  SkipForward10Icon,
  VolumeIcon,
  VolumeMutedIcon,
} from '@/shared/ui/icons';
import './NativePlayer.css';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function withSeekQuery(url: string, seconds: number): string {
  try {
    const parsed = new URL(url);
    if (seconds > 0) {
      parsed.searchParams.set('t', String(Math.max(0, seconds).toFixed(3)));
    } else {
      parsed.searchParams.delete('t');
    }
    // Bust HTTP/media element cache so each scrub restarts ffmpeg cleanly.
    parsed.searchParams.set('_', String(Date.now()));
    return parsed.toString();
  } catch {
    const base = url.split('?')[0] ?? url;
    const t = seconds > 0 ? `t=${Math.max(0, seconds).toFixed(3)}&` : '';
    return `${base}?${t}_=${Date.now()}`;
  }
}

export function NativePlayer() {
  const { session, isPreparing, prepareError, playTorrent, closePlayer } = usePlayer();
  const { torrents, openTorrentFile } = useTorrents();
  const { upsertProgress, removeProgress } = useContinueWatching();
  const { setStatus } = useWatched();
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const lastUpsertAtRef = useRef(0);
  const resumeAppliedKeyRef = useRef<string | null>(null);
  /** True while closing — blocks double continue upsert (explicit flush + session cleanup). */
  const closingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [hasTextTracks, setHasTextTracks] = useState(false);
  const [episodePickerOpen, setEpisodePickerOpen] = useState(false);
  const [switchingEpisode, setSwitchingEpisode] = useState(false);
  const [videoSrc, setVideoSrc] = useState('');
  const [seekOrigin, setSeekOrigin] = useState(0);
  const [isServerSeeking, setIsServerSeeking] = useState(false);
  const serverSeekTimerRef = useRef<number | null>(null);
  const serverSeekSafetyRef = useRef<number | null>(null);
  const serverSeekPendingRef = useRef(false);
  const wasPlayingBeforeSeekRef = useRef(true);
  /** Mute only for seek transition — don't flip the user's mute toggle. */
  const silentMuteRef = useRef(false);
  const userMutedRef = useRef(false);

  const finishServerSeek = useCallback((media: HTMLVideoElement) => {
    serverSeekPendingRef.current = false;
    setIsServerSeeking(false);
    if (serverSeekSafetyRef.current != null) {
      window.clearTimeout(serverSeekSafetyRef.current);
      serverSeekSafetyRef.current = null;
    }
    if (silentMuteRef.current) {
      silentMuteRef.current = false;
      media.muted = userMutedRef.current;
      setMuted(userMutedRef.current);
    }
    if (wasPlayingBeforeSeekRef.current) {
      void media.play().catch(() => undefined);
    }
  }, []);

  const sessionTorrent = useMemo(
    () => torrents.find((item) => item.id === session?.torrentId) ?? null,
    [torrents, session?.torrentId],
  );
  const canPickEpisode = Boolean(
    sessionTorrent && hasMultipleEpisodes(sessionTorrent.files),
  );

  const displayTitle = useMemo(() => {
    const mediaTitle =
      sessionTorrent?.mediaTitle ||
      sessionTorrent?.title ||
      session?.title ||
      'Vodomerka Player';
    const sourcePath = session?.sourcePath || session?.filePath;
    const match = sessionTorrent?.files.find((file) => {
      if (!sourcePath) {
        return false;
      }
      if (file.path === sourcePath) {
        return true;
      }
      const left = file.path.replace(/\\/g, '/').toLowerCase();
      const right = sourcePath.replace(/\\/g, '/').toLowerCase();
      if (left === right) {
        return true;
      }
      const leftName = left.split('/').pop() ?? '';
      const rightName = right.split('/').pop() ?? '';
      return leftName.length > 0 && leftName === rightName;
    });
    const fileName = match?.name || (sourcePath ? sourcePath.split(/[/\\]/).pop() : null);
    return formatPlaybackTitle(mediaTitle, fileName);
  }, [session, sessionTorrent]);

  const visible = Boolean(session) || isPreparing || Boolean(prepareError);
  const knownDuration = session?.durationSeconds ?? 0;
  const useServerSeek = Boolean(session?.serverSeek && knownDuration > 0);
  const canSeek = Boolean(
    session && session.seekable !== false && (!session.serverSeek || knownDuration > 0),
  );

  const bumpControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused && !volumeOpen) {
        setControlsVisible(false);
      }
    }, 2600);
  }, [volumeOpen]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    bumpControls();
    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, [visible, session?.url, bumpControls]);

  useEffect(() => {
    setPlaybackError(null);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    lastUpsertAtRef.current = 0;
    resumeAppliedKeyRef.current = null;
    serverSeekPendingRef.current = false;
    wasPlayingBeforeSeekRef.current = true;
    silentMuteRef.current = false;
    setIsServerSeeking(false);
    if (serverSeekTimerRef.current != null) {
      window.clearTimeout(serverSeekTimerRef.current);
      serverSeekTimerRef.current = null;
    }
    if (serverSeekSafetyRef.current != null) {
      window.clearTimeout(serverSeekSafetyRef.current);
      serverSeekSafetyRef.current = null;
    }

    const start =
      typeof session?.startSeconds === 'number' && session.startSeconds > 0
        ? session.startSeconds
        : 0;
    const known = session?.durationSeconds && session.durationSeconds > 0 ? session.durationSeconds : 0;
    const canServerResume = Boolean(session?.serverSeek && known > 0 && start > 0);

    if (canServerResume && session) {
      setSeekOrigin(start);
      setCurrentTime(start);
      currentTimeRef.current = start;
      setVideoSrc(withSeekQuery(session.url, start));
      resumeAppliedKeyRef.current = session.url;
    } else {
      setSeekOrigin(0);
      setVideoSrc(session?.url ?? '');
    }

    setBuffered(canServerResume ? start : 0);
    setPlaying(false);
    setCaptionsOn(false);
    setHasTextTracks(false);
    setDuration(known);
    durationRef.current = known;
  }, [session?.url, session?.durationSeconds, session?.startSeconds, session?.serverSeek]);

  useEffect(() => {
    return () => {
      if (serverSeekTimerRef.current != null) {
        window.clearTimeout(serverSeekTimerRef.current);
      }
      if (serverSeekSafetyRef.current != null) {
        window.clearTimeout(serverSeekSafetyRef.current);
      }
    };
  }, []);

  const persistContinueProgress = useCallback(
    async (force = false, options?: { ended?: boolean }) => {
      if (!session) {
        return;
      }
      // Closing already flushed once — ignore timeupdate / cleanup duplicates.
      if (closingRef.current && !force) {
        return;
      }
      const total =
        durationRef.current > 0
          ? durationRef.current
          : session.durationSeconds && session.durationSeconds > 0
            ? session.durationSeconds
            : 0;
      const position = options?.ended && total > 0 ? total : currentTimeRef.current;

      if (!options?.ended && !shouldPersistContinueProgress(position, total)) {
        return;
      }

      const now = Date.now();
      if (!force && !options?.ended && now - lastUpsertAtRef.current < CONTINUE_UPSERT_THROTTLE_MS) {
        return;
      }
      lastUpsertAtRef.current = now;

      const id = continueWatchingIdForSession(session, sessionTorrent);
      const completed =
        Boolean(options?.ended && total > 0) || isContinueProgressComplete(position, total);

      if (completed) {
        await removeProgress(id);
        // Сериалы (сезоны/серии) — только убрать из «Продолжить», в watched не кидаем.
        // Раньше ловили лишь «несколько файлов», и одна скачанная серия уезжала в «Фильмы».
        if (!isContinueSerialPlayback(session, sessionTorrent)) {
          const item = buildContinueUpsertPayload(session, position, total, sessionTorrent).item;
          if (item.id && !item.id.startsWith('torrent:') && item.type === 'movie') {
            await setStatus(item, 'watched', { silent: true });
          }
        }
        return;
      }

      await upsertProgress(buildContinueUpsertPayload(session, position, total, sessionTorrent));
    },
    [removeProgress, session, sessionTorrent, setStatus, upsertProgress],
  );

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    if (!session || closingRef.current) {
      return;
    }
    void persistContinueProgress(false);
  }, [currentTime, persistContinueProgress, session]);

  useEffect(() => {
    // New session — allow persist again after a previous close.
    closingRef.current = false;
    return () => {
      // Explicit close already flushed; skip the second upsert that was thrashing Home.
      if (closingRef.current) {
        return;
      }
      void persistContinueProgress(true);
    };
    // Final flush when player unmounts / session tears down via close.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally session-scoped
  }, [session?.torrentId, session?.sourcePath]);

  const toggleFullscreen = useCallback(async () => {
    // Только Electron window fullscreen — не document.requestFullscreen (теряется окно на Mac).
    const next = !isFullscreen;
    const applied = await window.electronAPI?.windowChrome?.setFullScreen?.(next);
    setIsFullscreen(typeof applied === 'boolean' ? applied : next);
    bumpControls();
  }, [bumpControls, isFullscreen]);

  useEffect(() => {
    return window.electronAPI?.windowChrome?.onFullScreenChanged?.((fullScreen) => {
      setIsFullscreen(fullScreen);
    });
  }, []);

  const handleClosePlayer = useCallback(() => {
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    void persistContinueProgress(true, undefined)
      .catch(() => undefined)
      .finally(() => {
        setIsFullscreen(false);
        closePlayer();
      });
  }, [closePlayer, persistContinueProgress]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
    bumpControls();
  }, [bumpControls]);

  const seekToAbsolute = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (!video || !session || !canSeek) {
        return;
      }

      const total = useServerSeek
        ? knownDuration
        : Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : knownDuration;
      if (!Number.isFinite(total) || total <= 0) {
        return;
      }

      const target = Math.max(0, Math.min(total, seconds));

      if (useServerSeek) {
        // Cut audio immediately so the dying ffmpeg pipe doesn't stutter,
        // then restart the stream after a short scrub debounce.
        setSeekOrigin(target);
        setCurrentTime(target);
        currentTimeRef.current = target;
        setBuffered(target);
        serverSeekPendingRef.current = true;
        setIsServerSeeking(true);
        wasPlayingBeforeSeekRef.current = !video.paused;
        if (!silentMuteRef.current) {
          userMutedRef.current = video.muted;
          silentMuteRef.current = true;
          video.muted = true;
        }
        try {
          video.pause();
        } catch {
          // ignore
        }

        if (serverSeekTimerRef.current != null) {
          window.clearTimeout(serverSeekTimerRef.current);
        }
        if (serverSeekSafetyRef.current != null) {
          window.clearTimeout(serverSeekSafetyRef.current);
          serverSeekSafetyRef.current = null;
        }
        serverSeekTimerRef.current = window.setTimeout(() => {
          serverSeekTimerRef.current = null;
          setVideoSrc(withSeekQuery(session.url, target));
          // Safety: if canplay never arrives, unblock UI/audio.
          serverSeekSafetyRef.current = window.setTimeout(() => {
            serverSeekSafetyRef.current = null;
            const media = videoRef.current;
            if (!media || !serverSeekPendingRef.current) {
              return;
            }
            finishServerSeek(media);
          }, 2500);
        }, 90);
        bumpControls();
        return;
      }

      video.currentTime = target;
      bumpControls();
    },
    [bumpControls, canSeek, finishServerSeek, knownDuration, session, useServerSeek],
  );

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      seekToAbsolute(currentTimeRef.current + deltaSeconds);
    },
    [seekToAbsolute],
  );

  const seekTo = useCallback(
    (ratio: number) => {
      const total = useServerSeek ? knownDuration : duration;
      if (!Number.isFinite(total) || total <= 0) {
        return;
      }
      seekToAbsolute(Math.max(0, Math.min(1, ratio)) * total);
    },
    [duration, knownDuration, seekToAbsolute, useServerSeek],
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.muted = !video.muted;
    setMuted(video.muted);
    bumpControls();
  }, [bumpControls]);

  const toggleCaptions = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const tracks = [...video.textTracks];
    if (tracks.length === 0) {
      setHasTextTracks(false);
      bumpControls();
      return;
    }
    setHasTextTracks(true);
    const next = !captionsOn;
    for (const track of tracks) {
      track.mode = next ? 'showing' : 'hidden';
    }
    setCaptionsOn(next);
    bumpControls();
  }, [bumpControls, captionsOn]);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) {
      return;
    }
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      // ignore
    }
    bumpControls();
  }, [bumpControls]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const video = videoRef.current;
      bumpControls();

      if (event.key === 'Escape') {
        event.preventDefault();
        if (isFullscreen) {
          void toggleFullscreen();
          return;
        }
        handleClosePlayer();
        return;
      }

      if (!video || !session) {
        return;
      }

      if (event.key === ' ' || event.key === 'k' || event.key === 'K') {
        event.preventDefault();
        togglePlay();
        return;
      }

      if ((event.key === 'ArrowRight' || event.key === 'l' || event.key === 'L') && canSeek) {
        event.preventDefault();
        seekBy(10);
        return;
      }

      if ((event.key === 'ArrowLeft' || event.key === 'j' || event.key === 'J') && canSeek) {
        event.preventDefault();
        seekBy(-10);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        video.muted = false;
        video.volume = Math.min(1, video.volume + 0.05);
        setMuted(false);
        setVolume(video.volume);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        video.volume = Math.max(0, video.volume - 0.05);
        setVolume(video.volume);
        return;
      }

      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        toggleMute();
        return;
      }

      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        void toggleFullscreen();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    visible,
    session,
    handleClosePlayer,
    bumpControls,
    canSeek,
    togglePlay,
    toggleMute,
    toggleFullscreen,
    seekBy,
    isFullscreen,
  ]);

  if (!visible) {
    return null;
  }

  const effectiveDuration = duration > 0 ? duration : knownDuration;
  const progress = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;
  const bufferedPct = effectiveDuration > 0 ? (buffered / effectiveDuration) * 100 : 0;
  const title = displayTitle;
  const timeLabel =
    effectiveDuration > 0
      ? `${formatTime(currentTime)} / ${formatTime(effectiveDuration)}`
      : formatTime(currentTime);

  return (
    <>
    <div
      ref={rootRef}
      className={`vp ${controlsVisible ? 'vp--controls' : ''} ${isFullscreen ? 'vp--fs' : ''}${
        isServerSeeking ? ' vp--seeking' : ''
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      aria-busy={isServerSeeking || undefined}
      onMouseMove={bumpControls}
      onMouseLeave={() => {
        if (videoRef.current && !videoRef.current.paused) {
          setControlsVisible(false);
          setVolumeOpen(false);
        }
      }}
    >
      <div className="vp__stage">
        {session ? (
          <video
            ref={videoRef}
            className="vp__video"
            src={videoSrc || session.url}
            poster={session.posterUrl}
            autoPlay
            playsInline
            onLoadedMetadata={(event) => {
              setHasTextTracks(event.currentTarget.textTracks.length > 0);
              if (useServerSeek && knownDuration > 0) {
                setDuration(knownDuration);
                durationRef.current = knownDuration;
              }
              const start = session.startSeconds;
              const resumeKey = `${session.url}|${start ?? 0}`;
              if (
                start != null &&
                start > 0 &&
                !useServerSeek &&
                resumeAppliedKeyRef.current !== resumeKey
              ) {
                resumeAppliedKeyRef.current = resumeKey;
                try {
                  event.currentTarget.currentTime = start;
                  currentTimeRef.current = start;
                  setCurrentTime(start);
                } catch {
                  // ignore seek failures on live streams
                }
              }
              // Initial play / non-seek loads. Seek resume waits for canplay (audio ready).
              if (!serverSeekPendingRef.current) {
                void event.currentTarget.play().catch(() => undefined);
              }
            }}
            onCanPlay={(event) => {
              if (!serverSeekPendingRef.current) {
                return;
              }
              finishServerSeek(event.currentTarget);
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => {
              // Don't treat seek-pause as a real pause for continue-watching.
              if (serverSeekPendingRef.current) {
                return;
              }
              setPlaying(false);
              void persistContinueProgress(true);
            }}
            onEnded={() => {
              setPlaying(false);
              const total =
                durationRef.current > 0
                  ? durationRef.current
                  : session.durationSeconds && session.durationSeconds > 0
                    ? session.durationSeconds
                    : 0;
              if (total > 0) {
                currentTimeRef.current = total;
                setCurrentTime(total);
              }
              void persistContinueProgress(true, { ended: true });
            }}
            onTimeUpdate={(event) => {
              // Ignore stale frames from the previous ffmpeg pipe while scrubbing.
              if (serverSeekPendingRef.current) {
                return;
              }
              const next = seekOrigin + event.currentTarget.currentTime;
              currentTimeRef.current = next;
              setCurrentTime(next);
            }}
            onDurationChange={(event) => {
              if (useServerSeek && knownDuration > 0) {
                setDuration(knownDuration);
                durationRef.current = knownDuration;
                return;
              }
              const next = event.currentTarget.duration;
              if (Number.isFinite(next) && next > 0) {
                setDuration(next);
                durationRef.current = next;
              }
            }}
            onProgress={(event) => {
              const media = event.currentTarget;
              if (media.buffered.length > 0) {
                setBuffered(seekOrigin + media.buffered.end(media.buffered.length - 1));
              }
            }}
            onVolumeChange={(event) => {
              if (silentMuteRef.current) {
                return;
              }
              setVolume(event.currentTarget.volume);
              setMuted(event.currentTarget.muted || event.currentTarget.volume === 0);
            }}
            onError={() => {
              const mediaError = videoRef.current?.error;
              const detail =
                mediaError?.code === 4
                  ? 'Источник заблокирован или формат не поддержан'
                  : mediaError?.code === 3
                    ? 'Ошибка декодирования'
                    : mediaError?.code === 2
                      ? 'Сеть/поток оборвался'
                      : 'Неизвестная ошибка';
              setPlaybackError(`${detail}. Открой во внешнем плеере, если повторится.`);
            }}
            onClick={(event) => {
              event.stopPropagation();
              togglePlay();
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              void toggleFullscreen();
            }}
          />
        ) : (
          <div className="vp__video vp__video--empty" />
        )}

        <div className="vp__chrome">
          {isPreparing ? (
            <div className="vp__status">
              <div className="vp__spinner" aria-hidden="true" />
              <p>Запуск Vodomerka Player…</p>
            </div>
          ) : null}

          {prepareError ? (
            <div className="vp__status vp__status--error">
              <p>{prepareError}</p>
              <button type="button" className="vp__text-btn" onClick={handleClosePlayer}>
                Закрыть
              </button>
            </div>
          ) : null}

          {playbackError && session ? (
            <div className="vp__status vp__status--error">
              <p>{playbackError}</p>
              <button
                type="button"
                className="vp__text-btn"
                onClick={() => void openTorrentFile(session.torrentId)}
              >
                Открыть во внешнем плеере
              </button>
            </div>
          ) : null}

          {session && !playbackError ? (
            <>
              <div className="vp__hud" aria-hidden={!controlsVisible}>
                <button
                  type="button"
                  className="vp__hud-skip"
                  aria-label="Назад 10 секунд"
                  disabled={!canSeek}
                  onClick={(event) => {
                    event.stopPropagation();
                    seekBy(-10);
                  }}
                >
                  <SkipBack10Icon size={40} />
                </button>
                <button
                  type="button"
                  className="vp__hud-play"
                  aria-label={playing ? 'Пауза' : 'Играть'}
                  onClick={(event) => {
                    event.stopPropagation();
                    togglePlay();
                  }}
                >
                  {playing ? (
                    <PauseBarsIcon size={28} />
                  ) : (
                    <PlayIcon size={28} className="vp__hud-play-triangle" />
                  )}
                </button>
                <button
                  type="button"
                  className="vp__hud-skip"
                  aria-label="Вперёд 10 секунд"
                  disabled={!canSeek}
                  onClick={(event) => {
                    event.stopPropagation();
                    seekBy(10);
                  }}
                >
                  <SkipForward10Icon size={40} />
                </button>
              </div>

              <div className="vp__dock">
              <div
                className={`vp__scrub ${canSeek ? '' : 'is-disabled'}`}
                role="slider"
                aria-label="Прогресс"
                aria-valuemin={0}
                aria-valuemax={Math.floor(effectiveDuration || 0)}
                aria-valuenow={Math.floor(currentTime)}
                tabIndex={canSeek ? 0 : -1}
                onClick={(event) => {
                  if (!canSeek) {
                    return;
                  }
                  const rect = event.currentTarget.getBoundingClientRect();
                  seekTo((event.clientX - rect.left) / rect.width);
                }}
                onKeyDown={(event) => {
                  if (!canSeek) {
                    return;
                  }
                  if (event.key === 'ArrowRight') {
                    seekBy(10);
                  }
                  if (event.key === 'ArrowLeft') {
                    seekBy(-10);
                  }
                }}
              >
                <span className="vp__scrub-track" />
                <span className="vp__scrub-buffer" style={{ width: `${bufferedPct}%` }} />
                <span className="vp__scrub-progress" style={{ width: `${progress}%` }} />
                {canSeek ? (
                  <span className="vp__scrub-knob" style={{ left: `${progress}%` }} />
                ) : null}
              </div>

              <div className="vp__bar">
                <div className="vp__bar-left">
                  <button
                    type="button"
                    className="vp__btn"
                    aria-label={playing ? 'Пауза' : 'Играть'}
                    onClick={togglePlay}
                  >
                    {playing ? <PauseBarsIcon size={22} /> : <PlayIcon size={22} />}
                  </button>

                  <div
                    className={`vp__volume ${volumeOpen ? 'is-open' : ''}`}
                    onMouseEnter={() => setVolumeOpen(true)}
                    onMouseLeave={() => setVolumeOpen(false)}
                  >
                    <button
                      type="button"
                      className="vp__btn"
                      aria-label={muted || volume === 0 ? 'Включить звук' : 'Выключить звук'}
                      onClick={toggleMute}
                    >
                      {muted || volume === 0 ? (
                        <VolumeMutedIcon size={22} strokeWidth={1.9} />
                      ) : (
                        <VolumeIcon size={22} strokeWidth={1.9} />
                      )}
                    </button>
                    <div className="vp__volume-flyout">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={muted ? 0 : volume}
                        aria-label="Громкость"
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          const video = videoRef.current;
                          setVolume(next);
                          if (video) {
                            video.volume = next;
                            video.muted = next === 0;
                          }
                          setMuted(next === 0);
                        }}
                      />
                    </div>
                  </div>

                  <div className="vp__meta" title={title}>
                    <span className="vp__time">{timeLabel}</span>
                    <span className="vp__title">{title}</span>
                  </div>
                </div>

                <div className="vp__bar-right">
                  {canPickEpisode ? (
                    <button
                      type="button"
                      className="vp__btn"
                      aria-label="Сезоны и серии"
                      title="Сезоны и серии"
                      onClick={() => {
                        setEpisodePickerOpen(true);
                        bumpControls();
                      }}
                    >
                      <LayersIcon size={21} strokeWidth={1.9} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="vp__btn"
                    aria-label="Картинка в картинке"
                    title="Картинка в картинке"
                    onClick={() => void togglePip()}
                  >
                    <PictureInPictureIcon size={21} strokeWidth={1.9} />
                  </button>
                  <button
                    type="button"
                    className={`vp__btn ${captionsOn ? 'is-active' : ''}`}
                    aria-label="Субтитры"
                    title={hasTextTracks ? 'Субтитры' : 'Субтитры недоступны'}
                    disabled={!hasTextTracks && !captionsOn}
                    onClick={toggleCaptions}
                  >
                    <CaptionsIcon size={21} strokeWidth={1.9} />
                  </button>
                  <button
                    type="button"
                    className="vp__btn"
                    aria-label={isFullscreen ? 'Выйти из полного экрана' : 'Полный экран'}
                    onClick={() => void toggleFullscreen()}
                  >
                    {isFullscreen ? (
                      <FullscreenExitIcon size={21} strokeWidth={1.9} />
                    ) : (
                      <FullscreenIcon size={21} strokeWidth={1.9} />
                    )}
                  </button>
                </div>
              </div>
            </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
    <EpisodePickerDialog
      open={episodePickerOpen && sessionTorrent != null}
      title={sessionTorrent?.mediaTitle || sessionTorrent?.title || 'Выбор серии'}
      files={sessionTorrent?.files ?? []}
      currentFilePath={session?.sourcePath ?? session?.filePath}
      isOpening={switchingEpisode}
      onCancel={() => {
        if (!switchingEpisode) {
          setEpisodePickerOpen(false);
        }
      }}
      onConfirm={(filePath) => {
        if (!session?.torrentId) {
          return;
        }
        const torrentId = session.torrentId;
        // Close immediately so progress ticks / prepare can't trap a disabled modal.
        setEpisodePickerOpen(false);
        setSwitchingEpisode(true);
        void playTorrent(torrentId, filePath).finally(() => {
          setSwitchingEpisode(false);
        });
      }}
    />
    </>
  );
}
