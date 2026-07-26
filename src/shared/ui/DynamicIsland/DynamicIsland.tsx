import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFavorites } from '@/shared/domain/FavoritesContext';
import { useMediaDrag, type MediaDragDropTarget } from '@/shared/domain/MediaDragContext';
import type { MediaItem } from '@/shared/domain/media';
import { useTorrents } from '@/shared/domain/TorrentsContext';
import { useWatched } from '@/shared/domain/WatchedContext';
import { playLikeSound } from '@/shared/audio/uiSounds';
import { useAppTopProgressIslandState } from '@/shared/ui/AppTopProgress/AppTopProgressContext';
import { usePlayer } from '@/shared/domain/PlayerContext';
import { EyeIcon, FavoritesIcon, PlayIcon, WatchingIcon } from '@/shared/ui/icons';
import { WATCH_STATUS_LABELS } from '@/shared/domain/watchStatus';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import { resolveThemeColorScheme } from '@/shared/settings/themes';
import {
  ToastIconView,
  useToast,
  useToastIslandState,
  type ToastKind,
  type ToastState,
} from '@/shared/ui/Toast/ToastContext';
import './DynamicIsland.css';

type ShellMode = 'idle' | 'toast' | 'loading' | 'download' | 'drop';

const COMPACT_TOAST_KINDS = new Set<ToastKind>([
  'favorite',
  'success',
  'error',
  'play',
  'hide',
  'restore',
  'copy',
]);

/** Content fades out, then shell morphs back — iPhone-like */
const CONTENT_OUT_MS = 200;
const SHELL_OUT_MS = 620;
const CONTENT_IN_DELAY_MS = 90;
const SNAKE_CYCLE_MS = 3600;

function DownloadIslandGlyph() {
  return (
    <svg
      className="dynamic-island__download-glyph"
      viewBox="0 0 14 14"
      width={14}
      height={14}
      fill="none"
      aria-hidden="true"
    >
      <g className="dynamic-island__download-arrow" stroke="currentColor" strokeWidth="1.6">
        <path d="M7 2.5v6.4" strokeLinecap="round" />
        <path d="M4.4 6.6 7 9.2l2.6-2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.1 11.5h7.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function isCompactToast(toast: ToastState | null): boolean {
  if (!toast) {
    return false;
  }
  if (toast.kind === 'tip') {
    return false;
  }
  return COMPACT_TOAST_KINDS.has(toast.kind) || !toast.title;
}

function clearTimers(bucket: { current: number[] }) {
  for (const id of bucket.current) {
    window.clearTimeout(id);
  }
  bucket.current = [];
}

function remainingSnakeCycleMs(startedAt: number, now = performance.now()): number {
  const elapsed = Math.max(0, now - startedAt);
  const left = SNAKE_CYCLE_MS - (elapsed % SNAKE_CYCLE_MS);
  return left < 48 ? 0 : left;
}

export function DynamicIsland() {
  const { toast, dismissToast, pauseToastAutoDismiss, resumeToastAutoDismiss } =
    useToastIslandState();
  const { showToast } = useToast();
  const { settings } = useAppSettings();
  const progress = useAppTopProgressIslandState();
  const { downloadActivity, torrents, isLoading: isLoadingTorrents } = useTorrents();
  const { playTorrent } = usePlayer();
  const { draggingItem, dropTarget, endMediaDrag, setDropAction } = useMediaDrag();
  const { isFavorite, addFavorite } = useFavorites();
  const { getStatus, setStatus } = useWatched();

  const [shellMode, setShellMode] = useState<ShellMode>('idle');
  const [heldToast, setHeldToast] = useState<ToastState | null>(null);
  const [toastContentOn, setToastContentOn] = useState(false);
  const [loadingContentOn, setLoadingContentOn] = useState(false);
  const [downloadContentOn, setDownloadContentOn] = useState(false);
  const [dropContentOn, setDropContentOn] = useState(false);
  const [snakeOn, setSnakeOn] = useState(false);
  const [tipExpanded, setTipExpanded] = useState(false);
  const [downloadExpanded, setDownloadExpanded] = useState(false);
  const [isPlayingDownload, setIsPlayingDownload] = useState(false);

  const toastTimers = useRef<number[]>([]);
  const loadingTimers = useRef<number[]>([]);
  const downloadTimers = useRef<number[]>([]);
  const dropTimers = useRef<number[]>([]);
  const hoverAddTimer = useRef<number | null>(null);
  const downloadCollapseTimer = useRef<number | null>(null);
  const islandRootRef = useRef<HTMLDivElement | null>(null);
  const loadingActiveRef = useRef(false);
  const downloadActiveRef = useRef(false);
  const snakeStartedAtRef = useRef<number | null>(null);
  const appliedDropRef = useRef(false);
  const downloadStatusSeededRef = useRef(false);
  const downloadStatusRef = useRef<Map<string, string>>(new Map());

  const isProgressActive = progress?.mode === 'active';
  const isDownloadActive = Boolean(downloadActivity);
  const isDropMode = Boolean(draggingItem);
  const snakeAllowed = resolveThemeColorScheme(settings.theme) === 'dark';
  /** Snake while dragging / download / top progress (not under toast). Light themes: off. */
  const snakeHold =
    snakeAllowed &&
    (isDropMode || (isDownloadActive && !downloadExpanded) || (isProgressActive && !toast));

  const clearHoverAddTimer = useCallback(() => {
    if (hoverAddTimer.current != null) {
      window.clearTimeout(hoverAddTimer.current);
      hoverAddTimer.current = null;
    }
  }, []);

  const clearDownloadCollapseTimer = useCallback(() => {
    if (downloadCollapseTimer.current != null) {
      window.clearTimeout(downloadCollapseTimer.current);
      downloadCollapseTimer.current = null;
    }
  }, []);

  const scheduleDownloadCollapse = useCallback(() => {
    clearDownloadCollapseTimer();
    downloadCollapseTimer.current = window.setTimeout(() => {
      downloadCollapseTimer.current = null;
      setDownloadExpanded(false);
    }, 2500);
  }, [clearDownloadCollapseTimer]);

  useEffect(() => {
    if (!isDownloadActive || toast || isProgressActive || isDropMode) {
      clearDownloadCollapseTimer();
      setDownloadExpanded(false);
      setIsPlayingDownload(false);
    }
  }, [isDownloadActive, toast, isProgressActive, isDropMode, clearDownloadCollapseTimer]);

  useEffect(() => {
    if (!downloadExpanded) {
      clearDownloadCollapseTimer();
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const root = islandRootRef.current;
      const target = event.target as Node | null;
      if (root && target && root.contains(target)) {
        return;
      }
      clearDownloadCollapseTimer();
      setDownloadExpanded(false);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [downloadExpanded, clearDownloadCollapseTimer]);

  useEffect(() => {
    if (isLoadingTorrents) {
      return;
    }

    const prev = downloadStatusRef.current;
    if (!downloadStatusSeededRef.current) {
      downloadStatusSeededRef.current = true;
      downloadStatusRef.current = new Map(torrents.map((item) => [item.id, item.status]));
      return;
    }

    for (const item of torrents) {
      const previous = prev.get(item.id);
      if (item.status === 'done' && previous && previous !== 'done') {
        const title = item.mediaTitle || item.title || 'Фильм';
        showToast(`«${title}» скачан`, {
          kind: 'success',
          title: 'Загрузка завершена',
        });
      }
    }

    downloadStatusRef.current = new Map(torrents.map((item) => [item.id, item.status]));
  }, [torrents, isLoadingTorrents, showToast]);

  useEffect(() => {
    if (snakeHold) {
      if (!snakeStartedAtRef.current) {
        snakeStartedAtRef.current = performance.now();
      }
      setSnakeOn(true);
      return;
    }

    if (!snakeStartedAtRef.current) {
      setSnakeOn(false);
      return;
    }

    const finishDelay = remainingSnakeCycleMs(snakeStartedAtRef.current);
    const finishId = window.setTimeout(() => {
      setSnakeOn(false);
      snakeStartedAtRef.current = null;
    }, finishDelay);

    return () => window.clearTimeout(finishId);
  }, [snakeHold]);

  useEffect(() => {
    clearTimers(dropTimers);
    clearHoverAddTimer();

    if (isDropMode) {
      appliedDropRef.current = false;
      setShellMode('drop');
      setDropContentOn(false);
      setToastContentOn(false);
      setLoadingContentOn(false);
      setDownloadContentOn(false);
      const showId = window.setTimeout(() => {
        setDropContentOn(true);
      }, CONTENT_IN_DELAY_MS);
      dropTimers.current.push(showId);
      return () => {
        clearTimers(dropTimers);
        clearHoverAddTimer();
      };
    }

    setDropContentOn(false);
    const shrinkId = window.setTimeout(() => {
      setShellMode((current) => (current === 'drop' ? 'idle' : current));
    }, CONTENT_OUT_MS);
    dropTimers.current.push(shrinkId);
    return () => {
      clearTimers(dropTimers);
      clearHoverAddTimer();
    };
  }, [clearHoverAddTimer, isDropMode]);

  useEffect(() => {
    if (isDropMode) {
      return;
    }

    clearTimers(toastTimers);

    if (toast) {
      setHeldToast(toast);
      setShellMode('toast');
      setToastContentOn(false);
      setTipExpanded(false);
      setDownloadContentOn(false);
      setLoadingContentOn(false);
      const showId = window.setTimeout(() => {
        setToastContentOn(true);
      }, CONTENT_IN_DELAY_MS);
      toastTimers.current.push(showId);
      return () => clearTimers(toastTimers);
    }

    if (heldToast) {
      setToastContentOn(false);
      const shrinkId = window.setTimeout(() => {
        setTipExpanded(false);
        setShellMode((current) => (current === 'toast' ? 'idle' : current));
      }, CONTENT_OUT_MS);
      const clearId = window.setTimeout(() => {
        setHeldToast(null);
      }, CONTENT_OUT_MS + SHELL_OUT_MS);
      toastTimers.current.push(shrinkId, clearId);
    }

    return () => clearTimers(toastTimers);
  }, [toast, isDropMode]);

  useEffect(() => {
    if (isDropMode || toast || isProgressActive) {
      clearTimers(downloadTimers);
      downloadActiveRef.current = false;
      setDownloadContentOn(false);
      return;
    }

    if (isDownloadActive && downloadActivity) {
      clearTimers(downloadTimers);

      if (!downloadActiveRef.current) {
        downloadActiveRef.current = true;
        setShellMode('download');
        setDownloadContentOn(false);
        setLoadingContentOn(false);
        const showId = window.setTimeout(() => {
          setDownloadContentOn(true);
        }, CONTENT_IN_DELAY_MS);
        downloadTimers.current.push(showId);
      } else {
        setShellMode('download');
        setDownloadContentOn(true);
      }

      return () => clearTimers(downloadTimers);
    }

    if (!downloadActiveRef.current) {
      return;
    }

    setDownloadContentOn(false);
    const shrinkId = window.setTimeout(() => {
      downloadActiveRef.current = false;
      setShellMode((current) => (current === 'download' ? 'idle' : current));
    }, CONTENT_OUT_MS);
    downloadTimers.current.push(shrinkId);

    return () => clearTimers(downloadTimers);
  }, [downloadActivity, isDownloadActive, isProgressActive, toast, isDropMode]);

  useEffect(() => {
    if (isDropMode || toast) {
      clearTimers(loadingTimers);
      loadingActiveRef.current = false;
      setLoadingContentOn(false);
      return;
    }

    if (isProgressActive) {
      clearTimers(loadingTimers);
      // Лоадер страницы приоритетнее скачивания.
      downloadActiveRef.current = false;
      setDownloadContentOn(false);

      if (!loadingActiveRef.current) {
        loadingActiveRef.current = true;
        setShellMode('loading');
        setLoadingContentOn(false);
        const showId = window.setTimeout(() => {
          setLoadingContentOn(true);
        }, CONTENT_IN_DELAY_MS);
        loadingTimers.current.push(showId);
      } else {
        setShellMode('loading');
        setLoadingContentOn(true);
      }

      return () => clearTimers(loadingTimers);
    }

    if (!loadingActiveRef.current) {
      return;
    }

    setLoadingContentOn(false);

    const shrinkId = window.setTimeout(() => {
      loadingActiveRef.current = false;
      setShellMode((current) => (current === 'loading' ? 'idle' : current));
    }, CONTENT_OUT_MS);
    loadingTimers.current.push(shrinkId);

    return () => clearTimers(loadingTimers);
  }, [isProgressActive, toast, isDropMode]);

  const compact = isCompactToast(heldToast);
  const isTip = heldToast?.kind === 'tip';
  const hasIcon = Boolean(heldToast && heldToast.kind !== 'default');
  const tipInteractive = Boolean(isTip && toast && toastContentOn && shellMode === 'toast');
  const downloadInteractive = Boolean(
    shellMode === 'download' &&
      downloadContentOn &&
      isDownloadActive &&
      !isDropMode &&
      !toast &&
      !isProgressActive,
  );
  const shellInteractive = tipInteractive || downloadInteractive || Boolean(toast?.dismissible);

  const applyDropTarget = useCallback(
    (item: MediaItem, target: Exclude<MediaDragDropTarget, null>) => {
      if (appliedDropRef.current) {
        return;
      }

      appliedDropRef.current = true;
      endMediaDrag('absorb');

      if (target === 'favorite') {
        if (isFavorite(item.id)) {
          showToast(`«${item.title}» уже в избранном`, {
            kind: 'favorite',
            title: 'Избранное',
          });
          return;
        }

        playLikeSound();
        void addFavorite(item, { silent: true }).then(() => {
          showToast(`«${item.title}» в избранном`, {
            kind: 'favorite',
            title: 'Добавлено',
          });
        });
        return;
      }

      const status = target === 'watching' ? 'watching' : 'watched';
      if (getStatus(item.id) === status) {
        showToast(`«${item.title}» уже в «${WATCH_STATUS_LABELS[status]}»`, {
          kind: 'restore',
          title: WATCH_STATUS_LABELS[status],
        });
        return;
      }

      playLikeSound();
      void setStatus(item, status, { silent: true }).then(() => {
        showToast(`«${item.title}» → ${WATCH_STATUS_LABELS[status]}`, {
          kind: 'restore',
          title: WATCH_STATUS_LABELS[status],
        });
      });
    },
    [addFavorite, endMediaDrag, getStatus, isFavorite, setStatus, showToast],
  );

  useEffect(() => {
    setDropAction((item, target) => {
      applyDropTarget(item, target);
    });
    return () => setDropAction(null);
  }, [applyDropTarget, setDropAction]);

  useEffect(() => {
    if (!draggingItem || !dropTarget || appliedDropRef.current) {
      clearHoverAddTimer();
      return;
    }

    hoverAddTimer.current = window.setTimeout(() => {
      hoverAddTimer.current = null;
      applyDropTarget(draggingItem, dropTarget);
    }, 100);

    return () => clearHoverAddTimer();
  }, [applyDropTarget, clearHoverAddTimer, draggingItem, dropTarget]);

  const toggleTipExpanded = () => {
    if (!tipInteractive) {
      return;
    }

    setTipExpanded((current) => {
      const next = !current;
      if (next) {
        pauseToastAutoDismiss();
      } else {
        resumeToastAutoDismiss();
      }
      return next;
    });
  };

  const toggleDownloadExpanded = () => {
    if (!downloadInteractive) {
      return;
    }
    setDownloadExpanded((current) => {
      const next = !current;
      if (!next) {
        clearDownloadCollapseTimer();
      }
      return next;
    });
  };

  const handleShellClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (
      target?.closest('.dynamic-island__close') ||
      target?.closest('.dynamic-island__download-play')
    ) {
      return;
    }

    if (tipInteractive) {
      toggleTipExpanded();
      return;
    }

    if (downloadInteractive) {
      toggleDownloadExpanded();
    }
  };

  const handleShellKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    if (tipInteractive) {
      event.preventDefault();
      toggleTipExpanded();
      return;
    }

    if (downloadInteractive) {
      event.preventDefault();
      toggleDownloadExpanded();
    }
  };

  const handleDownloadPlay = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!downloadActivity?.canPlay || isPlayingDownload) {
      return;
    }

    setIsPlayingDownload(true);
    try {
      const ok = await playTorrent(downloadActivity.id);
      if (!ok) {
        showToast('Не удалось открыть в плеере', {
          kind: 'hide',
          title: 'Плеер',
        });
        return;
      }
      setDownloadExpanded(false);
    } finally {
      setIsPlayingDownload(false);
    }
  };

  const downloadPercent = downloadActivity?.percent ?? 0;
  const downloadCount = downloadActivity?.count ?? 0;
  const downloadItemPercent = Math.round((downloadActivity?.progress ?? 0) * 100);
  const downloadTitle = downloadActivity?.title ?? 'Торрент';

  return createPortal(
    <div
      ref={islandRootRef}
      className={`dynamic-island dynamic-island--${shellMode}${
        heldToast && !isDropMode ? ` dynamic-island--toast-${heldToast.kind}` : ''
      }${shellMode === 'toast' && compact ? ' dynamic-island--compact' : ''}${
        shellMode === 'toast' && !compact && !tipExpanded ? ' dynamic-island--roomy' : ''
      }${shellMode === 'toast' && tipExpanded ? ' dynamic-island--tip-expanded' : ''}${
        shellMode === 'download' && downloadExpanded
          ? ' dynamic-island--download-expanded'
          : ''
      }${snakeOn ? ' dynamic-island--snake' : ''}${
        shellInteractive || isDropMode ? ' dynamic-island--interactive' : ''
      }${toastContentOn ? ' dynamic-island--toast-content-on' : ''}${
        loadingContentOn ? ' dynamic-island--loading-content-on' : ''
      }${downloadContentOn ? ' dynamic-island--download-content-on' : ''}${
        dropContentOn ? ' dynamic-island--drop-content-on' : ''
      }${dropTarget ? ` dynamic-island--drop-hover-${dropTarget}` : ''}`}
      onMouseEnter={() => {
        if (downloadExpanded) {
          clearDownloadCollapseTimer();
        }
      }}
      onMouseLeave={() => {
        if (downloadExpanded) {
          scheduleDownloadCollapse();
        }
      }}
      role={shellMode === 'idle' ? 'presentation' : 'status'}
      aria-live={shellMode === 'toast' || shellMode === 'download' ? 'polite' : undefined}
      aria-busy={
        (shellMode === 'loading' && isProgressActive) ||
        (shellMode === 'download' && !downloadExpanded)
          ? true
          : undefined
      }
      aria-expanded={
        isTip ? tipExpanded : downloadInteractive ? downloadExpanded : undefined
      }
      aria-label={
        shellMode === 'drop'
          ? 'Перетащи на избранное или просмотренное'
          : shellMode === 'download' && downloadActivity
            ? [
                `Скачивание «${downloadTitle}» ${downloadPercent}%`,
                downloadCount > 1 ? `${downloadCount} файлов` : null,
                downloadExpanded
                  ? 'Нажмите, чтобы свернуть'
                  : 'Нажмите, чтобы показать детали',
              ]
                .filter(Boolean)
                .join('. ')
            : shellMode === 'loading'
              ? 'Обновление'
              : shellMode === 'toast' && heldToast
                ? [
                    heldToast.title,
                    heldToast.message,
                    isTip
                      ? tipExpanded
                        ? 'Нажмите, чтобы свернуть'
                        : 'Нажмите, чтобы показать полностью'
                      : null,
                  ]
                    .filter(Boolean)
                    .join('. ')
                : undefined
      }
    >
      <div className="dynamic-island__snake">
        <div className="dynamic-island__snake-ring" aria-hidden="true">
          <span className="dynamic-island__snake-beam dynamic-island__snake-beam--trail" />
          <span className="dynamic-island__snake-beam dynamic-island__snake-beam--core" />
        </div>

        <div
          className="dynamic-island__shell"
          onClick={handleShellClick}
          onKeyDown={handleShellKeyDown}
          role={tipInteractive || downloadInteractive ? 'button' : undefined}
          tabIndex={tipInteractive || downloadInteractive ? 0 : undefined}
        >
          <div className="dynamic-island__toast" aria-hidden={!toastContentOn || isDropMode}>
            {heldToast ? (
              <>
                {hasIcon ? (
                  <span className="dynamic-island__icon" aria-hidden="true">
                    <ToastIconView kind={heldToast.kind} />
                  </span>
                ) : null}
                <div className="dynamic-island__copy">
                  {heldToast.title ? (
                    <span className="dynamic-island__title">{heldToast.title}</span>
                  ) : null}
                  <span className="dynamic-island__message">{heldToast.message}</span>
                </div>
                {heldToast.dismissible && toast ? (
                  <button
                    type="button"
                    className="dynamic-island__close"
                    aria-label="Закрыть"
                    onClick={(event) => {
                      event.stopPropagation();
                      dismissToast();
                    }}
                  >
                    <X size={15} strokeWidth={2.2} />
                  </button>
                ) : null}
              </>
            ) : null}
          </div>

          <div
            className="dynamic-island__download"
            aria-hidden={!downloadContentOn || isDropMode || Boolean(toast) || isProgressActive}
          >
            <div
              className="dynamic-island__download-compact"
              aria-hidden={downloadExpanded}
            >
              <span className="dynamic-island__download-icon" aria-hidden="true">
                <DownloadIslandGlyph />
              </span>
              {downloadCount > 1 ? (
                <span className="dynamic-island__download-count">{downloadCount}</span>
              ) : null}
              <span className="dynamic-island__download-percent">{downloadPercent}%</span>
            </div>

            <div
              className="dynamic-island__download-detail"
              aria-hidden={!downloadExpanded}
            >
              <div className="dynamic-island__download-poster" aria-hidden="true">
                {downloadActivity?.posterUrl ? (
                  <img src={downloadActivity.posterUrl} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span>{downloadTitle.slice(0, 1)}</span>
                )}
              </div>

              <div className="dynamic-island__download-copy">
                <span className="dynamic-island__download-title">{downloadTitle}</span>
                <div className="dynamic-island__download-topline">
                  <span className="dynamic-island__download-meta">
                    {downloadCount > 1
                      ? `Скачивается · ещё ${downloadCount - 1}`
                      : 'Скачивается'}
                  </span>
                  <span className="dynamic-island__download-detail-percent">
                    {downloadItemPercent}%
                  </span>
                </div>
                <div className="dynamic-island__download-progress" aria-hidden="true">
                  <span style={{ width: `${downloadItemPercent}%` }} />
                </div>
              </div>

              <button
                type="button"
                className="dynamic-island__download-play"
                aria-label="Смотреть"
                title="Смотреть"
                disabled={!downloadActivity?.canPlay || isPlayingDownload}
                onClick={(event) => {
                  void handleDownloadPlay(event);
                }}
              >
                <PlayIcon size={15} />
              </button>
            </div>
          </div>

          <div
            className="dynamic-island__loading"
            aria-hidden={!loadingContentOn || isDropMode}
          >
            <span className="dynamic-island__spinner" aria-hidden="true" />
          </div>

          <div className="dynamic-island__drop" aria-hidden={!dropContentOn}>
            <button
              type="button"
              data-media-drop="favorite"
              className={`dynamic-island__drop-zone dynamic-island__drop-zone--favorite${
                dropTarget === 'favorite' ? ' dynamic-island__drop-zone--active' : ''
              }`}
              aria-label="В избранное"
            >
              <span className="dynamic-island__drop-zone__icon" aria-hidden="true">
                <FavoritesIcon size={18} filled={dropTarget === 'favorite'} strokeWidth={1.9} />
              </span>
              <span className="dynamic-island__drop-zone__label">Избранное</span>
            </button>
            <span className="dynamic-island__drop-divider" aria-hidden="true" />
            <button
              type="button"
              data-media-drop="watching"
              className={`dynamic-island__drop-zone dynamic-island__drop-zone--watching${
                dropTarget === 'watching' ? ' dynamic-island__drop-zone--active' : ''
              }`}
              aria-label="Смотрю"
            >
              <span className="dynamic-island__drop-zone__icon" aria-hidden="true">
                <WatchingIcon size={18} strokeWidth={1.9} />
              </span>
              <span className="dynamic-island__drop-zone__label">Смотрю</span>
            </button>
            <span className="dynamic-island__drop-divider" aria-hidden="true" />
            <button
              type="button"
              data-media-drop="watched"
              className={`dynamic-island__drop-zone dynamic-island__drop-zone--watched${
                dropTarget === 'watched' ? ' dynamic-island__drop-zone--active' : ''
              }`}
              aria-label="Просмотрено"
            >
              <span className="dynamic-island__drop-zone__icon" aria-hidden="true">
                <EyeIcon size={18} strokeWidth={1.9} />
              </span>
              <span className="dynamic-island__drop-zone__label">Просмотрено</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
