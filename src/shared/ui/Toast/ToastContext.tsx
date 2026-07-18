import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CircleAlert, CircleCheck, Lightbulb } from 'lucide-react';
import {
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  FavoritesIcon,
  PlayIcon,
} from '@/shared/ui/icons';

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

export interface ToastState {
  id: number;
  kind: ToastKind;
  title?: string;
  message: string;
  duration: number;
  dismissible: boolean;
}

export interface ToastOptions {
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
  toast: ToastState | null;
  dismissToast: () => void;
  pauseToastAutoDismiss: () => void;
  resumeToastAutoDismiss: () => void;
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

export function ToastIconView({ kind }: { kind: ToastKind }) {
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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef<(() => void) | null>(null);
  const idRef = useRef(0);
  const startedAtRef = useRef(0);
  const remainingRef = useRef(0);
  const pausedRef = useRef(false);

  const clearAutoDismiss = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleAutoDismiss = useCallback((ms: number) => {
    clearAutoDismiss();
    if (ms <= 0) {
      return;
    }

    startedAtRef.current = Date.now();
    remainingRef.current = ms;
    pausedRef.current = false;
    timeoutRef.current = setTimeout(() => {
      onDismissRef.current = null;
      setToast(null);
      timeoutRef.current = null;
    }, ms);
  }, [clearAutoDismiss]);

  const dismissToast = useCallback(() => {
    clearAutoDismiss();
    pausedRef.current = false;
    remainingRef.current = 0;
    onDismissRef.current?.();
    onDismissRef.current = null;
    setToast(null);
  }, [clearAutoDismiss]);

  const pauseToastAutoDismiss = useCallback(() => {
    if (!timeoutRef.current || pausedRef.current) {
      return;
    }

    const elapsed = Date.now() - startedAtRef.current;
    remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    clearAutoDismiss();
    pausedRef.current = true;
  }, [clearAutoDismiss]);

  const resumeToastAutoDismiss = useCallback(() => {
    if (!pausedRef.current) {
      return;
    }

    pausedRef.current = false;
    const remaining = Math.max(1600, remainingRef.current);
    scheduleAutoDismiss(remaining);
  }, [scheduleAutoDismiss]);

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      clearAutoDismiss();
      pausedRef.current = false;

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

      scheduleAutoDismiss(duration);
    },
    [clearAutoDismiss, scheduleAutoDismiss],
  );

  useEffect(() => {
    return () => {
      clearAutoDismiss();
    };
  }, [clearAutoDismiss]);

  return (
    <ToastContext.Provider
      value={{
        showToast,
        toast,
        dismissToast,
        pauseToastAutoDismiss,
        resumeToastAutoDismiss,
      }}
    >
      {children}
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

/** Internal: Island reads full toast state */
export function useToastIslandState() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToastIslandState must be used within ToastProvider');
  }

  return {
    toast: context.toast,
    dismissToast: context.dismissToast,
    pauseToastAutoDismiss: context.pauseToastAutoDismiss,
    resumeToastAutoDismiss: context.resumeToastAutoDismiss,
  };
}
