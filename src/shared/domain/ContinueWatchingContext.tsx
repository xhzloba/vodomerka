import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

function continueRecordsEqual(
  left: ContinueWatchingRecord[],
  right: ContinueWatchingRecord[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]!;
    const b = right[index]!;
    if (
      a.id !== b.id ||
      a.updatedAt !== b.updatedAt ||
      a.positionSeconds !== b.positionSeconds ||
      a.torrentId !== b.torrentId ||
      a.filePath !== b.filePath
    ) {
      return false;
    }
  }
  return true;
}

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
  /** Skip onChanged reload while we already applied the IPC result locally. */
  const localWriteDepthRef = useRef(0);

  const applyRecords = useCallback((next: ContinueWatchingRecord[]) => {
    setRecords((prev) => (continueRecordsEqual(prev, next) ? prev : next));
  }, []);

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
      if (localWriteDepthRef.current > 0) {
        return;
      }
      void ensureMediaOverridesLoaded()
        .then(() => loadContinueWatching())
        .then((loaded) => {
          if (localWriteDepthRef.current > 0) {
            return;
          }
          applyRecords(loaded);
        });
    });

    return () => {
      unsubscribe?.();
    };
  }, [applyRecords]);

  const upsertProgress = useCallback(
    async (payload: ContinueWatchingUpsertPayload) => {
      localWriteDepthRef.current += 1;
      try {
        const next = await upsertContinueWatchingItem(payload);
        applyRecords(next);
      } finally {
        window.setTimeout(() => {
          localWriteDepthRef.current = Math.max(0, localWriteDepthRef.current - 1);
        }, 120);
      }
    },
    [applyRecords],
  );

  const removeProgress = useCallback(
    async (id: string) => {
      localWriteDepthRef.current += 1;
      try {
        const next = await removeContinueWatchingItem(id);
        applyRecords(next);
      } finally {
        window.setTimeout(() => {
          localWriteDepthRef.current = Math.max(0, localWriteDepthRef.current - 1);
        }, 120);
      }
    },
    [applyRecords],
  );

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
