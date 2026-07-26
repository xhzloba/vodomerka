import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '@/shared/domain/PlayerContext';
import { useTorrents } from '@/shared/domain/TorrentsContext';
import { hasMultipleEpisodes } from '@/shared/domain/torrentEpisodes';
import { EpisodePickerDialog } from '@/shared/ui/EpisodePickerDialog/EpisodePickerDialog';
import {
  CaptionsIcon,
  CloseIcon,
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

export function NativePlayer() {
  const { session, isPreparing, prepareError, playTorrent, closePlayer } = usePlayer();
  const { torrents, openTorrentFile } = useTorrents();
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<number | null>(null);
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

  const sessionTorrent = useMemo(
    () => torrents.find((item) => item.id === session?.torrentId) ?? null,
    [torrents, session?.torrentId],
  );
  const canPickEpisode = Boolean(
    sessionTorrent && hasMultipleEpisodes(sessionTorrent.files),
  );

  const visible = Boolean(session) || isPreparing || Boolean(prepareError);
  const canSeek = session?.seekable !== false;

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
    setDuration(0);
    setBuffered(0);
    setPlaying(false);
    setCaptionsOn(false);
    setHasTextTracks(false);
  }, [session?.url]);

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
    setIsFullscreen(false);
    closePlayer();
  }, [closePlayer]);

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

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      const video = videoRef.current;
      if (!video || !canSeek) {
        return;
      }
      const next = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + deltaSeconds));
      video.currentTime = next;
      bumpControls();
    },
    [bumpControls, canSeek],
  );

  const seekTo = useCallback(
    (ratio: number) => {
      const video = videoRef.current;
      if (!video || !canSeek || !Number.isFinite(video.duration) || video.duration <= 0) {
        return;
      }
      video.currentTime = Math.max(0, Math.min(1, ratio)) * video.duration;
      bumpControls();
    },
    [bumpControls, canSeek],
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

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const title = session?.title || 'Vodomerka Player';
  const timeLabel = canSeek
    ? `${formatTime(currentTime)} / ${formatTime(duration)}`
    : formatTime(currentTime);

  return (
    <>
    <div
      ref={rootRef}
      className={`vp ${controlsVisible ? 'vp--controls' : ''} ${isFullscreen ? 'vp--fs' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
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
            src={session.url}
            poster={session.posterUrl}
            autoPlay
            playsInline
            onLoadedMetadata={(event) => {
              setHasTextTracks(event.currentTarget.textTracks.length > 0);
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
            onProgress={(event) => {
              const media = event.currentTarget;
              if (media.buffered.length > 0) {
                setBuffered(media.buffered.end(media.buffered.length - 1));
              }
            }}
            onVolumeChange={(event) => {
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
          <button
            type="button"
            className="vp__close"
            aria-label="Закрыть"
            onClick={handleClosePlayer}
          >
            <CloseIcon size={18} strokeWidth={2.25} />
          </button>

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
                aria-valuemax={Math.floor(duration || 0)}
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
                  if (!canSeek || !videoRef.current) {
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
        setSwitchingEpisode(true);
        void playTorrent(session.torrentId, filePath)
          .then((result) => {
            if (result.ok) {
              setEpisodePickerOpen(false);
            }
          })
          .finally(() => {
            setSwitchingEpisode(false);
          });
      }}
    />
    </>
  );
}
