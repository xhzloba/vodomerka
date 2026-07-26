import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ContinueWatchingRecord, ContinueWatchingUpsertPayload } from '../../../contracts/ipc';
import type { MediaItem } from '@/shared/domain/media';
import { ensureMediaOverridesLoaded } from '@/shared/domain/overridesStore';
import {
  continueRecordToMediaItem,
  loadContinueWatching,
  removeContinueWatchingItem,
  upsertContinueWatchingItem,
} from '@/shared/domain/continueWatchingStorage';

interface ContinueWatchingContextValue {
  records: ContinueWatchingRecord[];
  items: MediaItem[];
  isLoading: boolean;
  upsertProgress: (payload: ContinueWatchingUpsertPayload) => Promise<void>;
  removeProgress: (id: string) => Promise<void>;
  findByMediaId: (mediaId: string) => ContinueWatchingRecord | undefined;
  reloadContinueWatching: () => Promise<void>;
}

const ContinueWatchingContext = createContext<ContinueWatchingContextValue | null>(null);

export function ContinueWatchingProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<ContinueWatchingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void ensureMediaOverridesLoaded()
      .then(() => loadContinueWatching())
      .then((loaded) => {
        if (!cancelled) {
          setRecords(loaded);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.continueWatching?.onChanged?.(() => {
      void ensureMediaOverridesLoaded()
        .then(() => loadContinueWatching())
        .then((loaded) => {
          setRecords(loaded);
        });
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const upsertProgress = useCallback(async (payload: ContinueWatchingUpsertPayload) => {
    const next = await upsertContinueWatchingItem(payload);
    setRecords(next);
  }, []);

  const removeProgress = useCallback(async (id: string) => {
    const next = await removeContinueWatchingItem(id);
    setRecords(next);
  }, []);

  const findByMediaId = useCallback(
    (mediaId: string) => records.find((record) => record.mediaId === mediaId || record.item.id === mediaId),
    [records],
  );

  const reloadContinueWatching = useCallback(async () => {
    setIsLoading(true);
    try {
      await ensureMediaOverridesLoaded();
      setRecords(await loadContinueWatching());
    } finally {
      setIsLoading(false);
    }
  }, []);

  const items = useMemo(() => records.map(continueRecordToMediaItem), [records]);

  const value = useMemo(
    () => ({
      records,
      items,
      isLoading,
      upsertProgress,
      removeProgress,
      findByMediaId,
      reloadContinueWatching,
    }),
    [
      findByMediaId,
      isLoading,
      items,
      records,
      reloadContinueWatching,
      removeProgress,
      upsertProgress,
    ],
  );

  return (
    <ContinueWatchingContext.Provider value={value}>{children}</ContinueWatchingContext.Provider>
  );
}

export function useContinueWatching() {
  const context = useContext(ContinueWatchingContext);
  if (!context) {
    throw new Error('useContinueWatching must be used within ContinueWatchingProvider');
  }
  return context;
}
