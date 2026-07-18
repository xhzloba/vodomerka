import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useAppTopProgressIslandState } from '@/shared/ui/AppTopProgress/AppTopProgressContext';
import {
  ToastIconView,
  useToastIslandState,
  type ToastKind,
  type ToastState,
} from '@/shared/ui/Toast/ToastContext';
import './DynamicIsland.css';

type ShellMode = 'idle' | 'toast' | 'loading';

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
  const progress = useAppTopProgressIslandState();

  const [shellMode, setShellMode] = useState<ShellMode>('idle');
  const [heldToast, setHeldToast] = useState<ToastState | null>(null);
  const [toastContentOn, setToastContentOn] = useState(false);
  const [loadingContentOn, setLoadingContentOn] = useState(false);
  const [snakeOn, setSnakeOn] = useState(false);
  const [tipExpanded, setTipExpanded] = useState(false);

  const toastTimers = useRef<number[]>([]);
  const loadingTimers = useRef<number[]>([]);
  const loadingActiveRef = useRef(false);
  const snakeStartedAtRef = useRef<number | null>(null);

  const isProgressActive = progress?.mode === 'active';

  useEffect(() => {
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
      setTipExpanded(false);
      const shrinkId = window.setTimeout(() => {
        setShellMode((current) => (current === 'toast' ? 'idle' : current));
      }, CONTENT_OUT_MS);
      const clearId = window.setTimeout(() => {
        setHeldToast(null);
      }, CONTENT_OUT_MS + SHELL_OUT_MS);
      toastTimers.current.push(shrinkId, clearId);
    }

    return () => clearTimers(toastTimers);
  }, [toast]);

  useEffect(() => {
    if (toast) {
      clearTimers(loadingTimers);
      loadingActiveRef.current = false;
      snakeStartedAtRef.current = null;
      setLoadingContentOn(false);
      setSnakeOn(false);
      return;
    }

    if (isProgressActive) {
      clearTimers(loadingTimers);

      if (!loadingActiveRef.current) {
        loadingActiveRef.current = true;
        snakeStartedAtRef.current = performance.now();
        setShellMode('loading');
        setSnakeOn(true);
        setLoadingContentOn(false);
        const showId = window.setTimeout(() => {
          setLoadingContentOn(true);
        }, CONTENT_IN_DELAY_MS);
        loadingTimers.current.push(showId);
      } else {
        setShellMode('loading');
        setSnakeOn(true);
        setLoadingContentOn(true);
      }

      return () => clearTimers(loadingTimers);
    }

    if (!loadingActiveRef.current) {
      return;
    }

    setLoadingContentOn(false);

    const finishDelay = remainingSnakeCycleMs(snakeStartedAtRef.current ?? performance.now());
    const shrinkId = window.setTimeout(() => {
      setShellMode((current) => (current === 'loading' ? 'idle' : current));
    }, CONTENT_OUT_MS);
    const finishId = window.setTimeout(() => {
      loadingActiveRef.current = false;
      snakeStartedAtRef.current = null;
      setSnakeOn(false);
    }, Math.max(finishDelay, CONTENT_OUT_MS));
    loadingTimers.current.push(shrinkId, finishId);

    return () => clearTimers(loadingTimers);
  }, [isProgressActive, toast]);

  const compact = isCompactToast(heldToast);
  const isTip = heldToast?.kind === 'tip';
  const hasIcon = Boolean(heldToast && heldToast.kind !== 'default');
  const tipInteractive = Boolean(isTip && toast && toastContentOn && shellMode === 'toast');

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
        heldToast ? ` dynamic-island--toast-${heldToast.kind}` : ''
      }${shellMode === 'toast' && compact ? ' dynamic-island--compact' : ''}${
        shellMode === 'toast' && !compact && !tipExpanded ? ' dynamic-island--roomy' : ''
      }${shellMode === 'toast' && tipExpanded ? ' dynamic-island--tip-expanded' : ''}${
        snakeOn ? ' dynamic-island--snake' : ''
      }${toast?.dismissible || tipInteractive ? ' dynamic-island--interactive' : ''}${
        toastContentOn ? ' dynamic-island--toast-content-on' : ''
      }${loadingContentOn ? ' dynamic-island--loading-content-on' : ''}`}
      role={shellMode === 'idle' ? 'presentation' : 'status'}
      aria-live={shellMode === 'toast' ? 'polite' : undefined}
      aria-busy={shellMode === 'loading' && isProgressActive ? true : undefined}
      aria-expanded={isTip ? tipExpanded : undefined}
      aria-label={
        shellMode === 'loading'
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
          <div className="dynamic-island__idle" aria-hidden={shellMode !== 'idle'}>
            <span className="dynamic-island__dot" />
          </div>

          <div className="dynamic-island__toast" aria-hidden={!toastContentOn}>
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
                  {isTip && !tipExpanded ? (
                    <span className="dynamic-island__hint">Нажмите, чтобы раскрыть</span>
                  ) : null}
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
                    <X size={14} strokeWidth={2} />
                  </button>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="dynamic-island__loading" aria-hidden={!loadingContentOn}>
            <span className="dynamic-island__spinner" aria-hidden="true" />
            <span className="dynamic-island__loading-divider" aria-hidden="true" />
            <span className="dynamic-island__loading-label">Обновление</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
