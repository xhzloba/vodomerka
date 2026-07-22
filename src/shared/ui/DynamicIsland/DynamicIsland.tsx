import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFavorites } from '@/shared/domain/FavoritesContext';
import { useMediaDrag, type MediaDragDropTarget } from '@/shared/domain/MediaDragContext';
import type { MediaItem } from '@/shared/domain/media';
import { useWatched } from '@/shared/domain/WatchedContext';
import { playLikeSound } from '@/shared/audio/uiSounds';
import { useAppTopProgressIslandState } from '@/shared/ui/AppTopProgress/AppTopProgressContext';
import { EyeIcon, FavoritesIcon } from '@/shared/ui/icons';
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

type ShellMode = 'idle' | 'toast' | 'loading' | 'drop';

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
  const { draggingItem, dropTarget, endMediaDrag, setDropAction } = useMediaDrag();
  const { isFavorite, addFavorite } = useFavorites();
  const { isWatched, addWatched } = useWatched();

  const [shellMode, setShellMode] = useState<ShellMode>('idle');
  const [heldToast, setHeldToast] = useState<ToastState | null>(null);
  const [toastContentOn, setToastContentOn] = useState(false);
  const [loadingContentOn, setLoadingContentOn] = useState(false);
  const [dropContentOn, setDropContentOn] = useState(false);
  const [snakeOn, setSnakeOn] = useState(false);
  const [tipExpanded, setTipExpanded] = useState(false);

  const toastTimers = useRef<number[]>([]);
  const loadingTimers = useRef<number[]>([]);
  const dropTimers = useRef<number[]>([]);
  const hoverAddTimer = useRef<number | null>(null);
  const loadingActiveRef = useRef(false);
  const snakeStartedAtRef = useRef<number | null>(null);
  const appliedDropRef = useRef(false);

  const isProgressActive = progress?.mode === 'active';
  const isDropMode = Boolean(draggingItem);
  const snakeAllowed = resolveThemeColorScheme(settings.theme) === 'dark';
  /** Snake while dragging to island or while top progress runs (not under toast). Light themes: off. */
  const snakeHold = snakeAllowed && (isDropMode || (isProgressActive && !toast));

  const clearHoverAddTimer = useCallback(() => {
    if (hoverAddTimer.current != null) {
      window.clearTimeout(hoverAddTimer.current);
      hoverAddTimer.current = null;
    }
  }, []);

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
    if (isDropMode || toast) {
      clearTimers(loadingTimers);
      loadingActiveRef.current = false;
      setLoadingContentOn(false);
      return;
    }

    if (isProgressActive) {
      clearTimers(loadingTimers);

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

      if (isWatched(item.id)) {
        showToast(`«${item.title}» уже в просмотренном`, {
          kind: 'restore',
          title: 'Просмотрено',
        });
        return;
      }

      playLikeSound();
      void addWatched(item, { silent: true }).then(() => {
        showToast(`«${item.title}» в просмотренном`, {
          kind: 'restore',
          title: 'Просмотрено',
        });
      });
    },
    [addFavorite, addWatched, endMediaDrag, isFavorite, isWatched, showToast],
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

  const handleShellClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!tipInteractive) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest('.dynamic-island__close')) {
      return;
    }

    toggleTipExpanded();
  };

  const handleShellKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!tipInteractive) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleTipExpanded();
    }
  };

  return createPortal(
    <div
      className={`dynamic-island dynamic-island--${shellMode}${
        heldToast && !isDropMode ? ` dynamic-island--toast-${heldToast.kind}` : ''
      }${shellMode === 'toast' && compact ? ' dynamic-island--compact' : ''}${
        shellMode === 'toast' && !compact && !tipExpanded ? ' dynamic-island--roomy' : ''
      }${shellMode === 'toast' && tipExpanded ? ' dynamic-island--tip-expanded' : ''}${
        snakeOn ? ' dynamic-island--snake' : ''
      }${toast?.dismissible || tipInteractive || isDropMode ? ' dynamic-island--interactive' : ''}${
        toastContentOn ? ' dynamic-island--toast-content-on' : ''
      }${loadingContentOn ? ' dynamic-island--loading-content-on' : ''}${
        dropContentOn ? ' dynamic-island--drop-content-on' : ''
      }${dropTarget ? ` dynamic-island--drop-hover-${dropTarget}` : ''}`}
      role={shellMode === 'idle' ? 'presentation' : 'status'}
      aria-live={shellMode === 'toast' ? 'polite' : undefined}
      aria-busy={shellMode === 'loading' && isProgressActive ? true : undefined}
      aria-expanded={isTip ? tipExpanded : undefined}
      aria-label={
        shellMode === 'drop'
          ? 'Перетащи на избранное или просмотренное'
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
          role={tipInteractive ? 'button' : undefined}
          tabIndex={tipInteractive ? 0 : undefined}
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

          <div className="dynamic-island__loading" aria-hidden={!loadingContentOn || isDropMode}>
            <span className="dynamic-island__spinner" aria-hidden="true" />
            <span className="dynamic-island__loading-divider" aria-hidden="true" />
            <span className="dynamic-island__loading-label">Обновление</span>
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
              data-media-drop="watched"
              className={`dynamic-island__drop-zone dynamic-island__drop-zone--watched${
                dropTarget === 'watched' ? ' dynamic-island__drop-zone--active' : ''
              }`}
              aria-label="В просмотренное"
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
