import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, CircleCheck, Lightbulb, X } from 'lucide-react';
import {
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  FavoritesIcon,
  PlayIcon,
} from '@/shared/ui/icons';
import './Toast.css';

/** @deprecated Use ToastKind instead */
export type ToastIcon = 'hide' | 'restore' | 'favorite';

export type ToastKind =
  | 'default'
  | 'success'
  | 'error'
  | 'play'
  | 'hide'
  | 'restore'
  | 'favorite'
  | 'copy'
  | 'tip';

interface ToastState {
  id: number;
  kind: ToastKind;
  title?: string;
  message: string;
  duration: number;
  dismissible: boolean;
}

interface ToastOptions {
  kind?: ToastKind;
  /** @deprecated Use kind instead */
  icon?: ToastIcon;
  title?: string;
  duration?: number;
  dismissible?: boolean;
  onDismiss?: () => void;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 3200;

function resolveKind(options?: ToastOptions): ToastKind {
  if (options?.kind) {
    return options.kind;
  }

  switch (options?.icon) {
    case 'hide':
      return 'hide';
    case 'restore':
      return 'restore';
    case 'favorite':
      return 'favorite';
    default:
      return 'default';
  }
}

function ToastIconView({ kind }: { kind: ToastKind }) {
  switch (kind) {
    case 'play':
      return <PlayIcon size={17} />;
    case 'hide':
      return <EyeOffIcon size={17} strokeWidth={1.75} />;
    case 'restore':
      return <EyeIcon size={17} strokeWidth={1.75} />;
    case 'favorite':
      return <FavoritesIcon size={17} strokeWidth={1.75} filled />;
    case 'copy':
      return <CopyIcon size={17} strokeWidth={1.75} />;
    case 'success':
      return <CircleCheck size={17} strokeWidth={1.75} />;
    case 'error':
      return <CircleAlert size={17} strokeWidth={1.75} />;
    case 'tip':
      return <Lightbulb size={17} strokeWidth={1.75} />;
    default:
      return null;
  }
}

function ToastView({
  toast,
  onDismiss,
}: {
  toast: ToastState;
  onDismiss: () => void;
}) {
  const hasIcon = toast.kind !== 'default';

  return (
    <div
      key={toast.id}
      className={`app-toast app-toast--${toast.kind}${hasIcon ? '' : ' app-toast--no-icon'}${
        toast.dismissible ? ' app-toast--dismissible' : ''
      }`}
      role="status"
      aria-live="polite"
      style={{ '--toast-duration': `${toast.duration}ms` } as CSSProperties}
    >
      <div className="app-toast__panel">
        {hasIcon ? (
          <span className="app-toast__icon" aria-hidden="true">
            <ToastIconView kind={toast.kind} />
          </span>
        ) : null}

        <div className="app-toast__content">
          {toast.title ? <span className="app-toast__title">{toast.title}</span> : null}
          <span className="app-toast__message">{toast.message}</span>
        </div>

        {toast.dismissible ? (
          <button
            type="button"
            className="app-toast__close"
            aria-label="Закрыть"
            onClick={onDismiss}
          >
            <X size={15} strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef<(() => void) | null>(null);
  const idRef = useRef(0);

  const dismissToast = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    onDismissRef.current?.();
    onDismissRef.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const duration = options?.duration ?? DEFAULT_DURATION;

    idRef.current += 1;
    onDismissRef.current = options?.onDismiss ?? null;
    setToast({
      id: idRef.current,
      kind: resolveKind(options),
      title: options?.title,
      message,
      duration,
      dismissible: options?.dismissible ?? false,
    });

    timeoutRef.current = setTimeout(() => {
      onDismissRef.current = null;
      setToast(null);
      timeoutRef.current = null;
    }, duration);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? createPortal(<ToastView toast={toast} onDismiss={dismissToast} />, document.body) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}
