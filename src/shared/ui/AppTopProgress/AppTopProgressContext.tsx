import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { TopIndeterminateProgress } from '@/shared/ui/TopIndeterminateProgress/TopIndeterminateProgress';

interface ProgressEntry {
  id: string;
  label: string;
}

interface AppTopProgressContextValue {
  setProgress: (id: string, active: boolean, label?: string) => void;
}

const AppTopProgressContext = createContext<AppTopProgressContextValue | null>(null);

export function AppTopProgressProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ProgressEntry[]>([]);

  const setProgress = useCallback((id: string, active: boolean, label = 'Загрузка') => {
    setEntries((current) => {
      const without = current.filter((entry) => entry.id !== id);

      if (!active) {
        return without;
      }

      return [...without, { id, label }];
    });
  }, []);

  const activeEntry = entries.length > 0 ? entries[entries.length - 1] : null;

  const value = useMemo(() => ({ setProgress }), [setProgress]);

  return (
    <AppTopProgressContext.Provider value={value}>
      {activeEntry ? <TopIndeterminateProgress label={activeEntry.label} /> : null}
      {children}
    </AppTopProgressContext.Provider>
  );
}

export function useAppTopProgress(id: string, active: boolean, label = 'Загрузка') {
  const context = useContext(AppTopProgressContext);

  if (!context) {
    throw new Error('useAppTopProgress must be used within AppTopProgressProvider');
  }

  useEffect(() => {
    context.setProgress(id, active, label);
    return () => {
      context.setProgress(id, false, label);
    };
  }, [active, context, id, label]);
}
