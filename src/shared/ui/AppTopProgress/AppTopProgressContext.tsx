import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { TopIndeterminateProgress } from '@/shared/ui/TopIndeterminateProgress/TopIndeterminateProgress';

interface ProgressEntry {
  id: string;
  label: string;
}

interface RenderedProgress {
  label: string;
  mode: 'active' | 'completing';
}

interface AppTopProgressContextValue {
  setProgress: (id: string, active: boolean, label?: string) => void;
}

const COMPLETE_ANIMATION_MS = 420;
const DEACTIVATE_GRACE_MS = 80;

const AppTopProgressContext = createContext<AppTopProgressContextValue | null>(null);

export function AppTopProgressProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [rendered, setRendered] = useState<RenderedProgress | null>(null);
  const completeTimerRef = useRef<number | null>(null);
  const deactivateTimerRef = useRef<number | null>(null);

  const setProgress = useCallback((id: string, active: boolean, label = 'Загрузка') => {
    setEntries((current) => {
      const existing = current.find((entry) => entry.id === id);

      if (!active) {
        if (!existing) {
          return current;
        }

        return current.filter((entry) => entry.id !== id);
      }

      if (existing?.label === label) {
        return current;
      }

      const without = current.filter((entry) => entry.id !== id);
      return [...without, { id, label }];
    });
  }, []);

  const activeEntry = entries.length > 0 ? entries[entries.length - 1] : null;

  useEffect(() => {
    if (completeTimerRef.current !== null) {
      window.clearTimeout(completeTimerRef.current);
      completeTimerRef.current = null;
    }

    if (deactivateTimerRef.current !== null) {
      window.clearTimeout(deactivateTimerRef.current);
      deactivateTimerRef.current = null;
    }

    if (activeEntry) {
      setRendered((current) => {
        if (current?.mode === 'active' && current.label === activeEntry.label) {
          return current;
        }

        return { label: activeEntry.label, mode: 'active' };
      });
      return;
    }

    deactivateTimerRef.current = window.setTimeout(() => {
      deactivateTimerRef.current = null;

      setRendered((current) => {
        if (!current || current.mode === 'completing') {
          return current;
        }

        return { ...current, mode: 'completing' };
      });
    }, DEACTIVATE_GRACE_MS);

    return () => {
      if (deactivateTimerRef.current !== null) {
        window.clearTimeout(deactivateTimerRef.current);
        deactivateTimerRef.current = null;
      }
    };
  }, [activeEntry]);

  useEffect(() => {
    if (rendered?.mode !== 'completing') {
      return;
    }

    completeTimerRef.current = window.setTimeout(() => {
      setRendered(null);
      completeTimerRef.current = null;
    }, COMPLETE_ANIMATION_MS);

    return () => {
      if (completeTimerRef.current !== null) {
        window.clearTimeout(completeTimerRef.current);
        completeTimerRef.current = null;
      }
    };
  }, [rendered]);

  const value = useMemo(() => ({ setProgress }), [setProgress]);

  return (
    <AppTopProgressContext.Provider value={value}>
      {rendered ? (
        <TopIndeterminateProgress
          label={rendered.label}
          completing={rendered.mode === 'completing'}
        />
      ) : null}
      {children}
    </AppTopProgressContext.Provider>
  );
}

export function useAppTopProgress(id: string, active: boolean, label = 'Загрузка') {
  const context = useContext(AppTopProgressContext);

  if (!context) {
    throw new Error('useAppTopProgress must be used within AppTopProgressProvider');
  }

  useLayoutEffect(() => {
    context.setProgress(id, active, label);
    return () => {
      context.setProgress(id, false, label);
    };
  }, [active, context, id, label]);
}
