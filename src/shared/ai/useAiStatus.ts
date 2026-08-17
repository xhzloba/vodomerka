import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiPullProgressEvent, AiStatusSnapshot } from '../../../contracts/ipc';
import { fetchAiStatus } from '@/shared/ai';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';

export function useAiStatus(options?: { auto?: boolean }) {
  const { settings } = useAppSettings();
  const auto = options?.auto ?? true;
  const [snapshot, setSnapshot] = useState<AiStatusSnapshot | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [pullProgress, setPullProgress] = useState<AiPullProgressEvent | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsChecking(true);

    try {
      const next = await fetchAiStatus(settings.aiBaseUrl);
      if (requestId !== requestIdRef.current) {
        return null;
      }
      setSnapshot(next);
      return next;
    } finally {
      if (requestId === requestIdRef.current) {
        setIsChecking(false);
      }
    }
  }, [settings.aiBaseUrl]);

  useEffect(() => {
    if (!auto) {
      return;
    }

    void refresh();
  }, [auto, refresh]);

  useEffect(() => {
    return window.electronAPI?.ai?.onPullProgress?.((event) => {
      if (event.status === 'cancelled') {
        setPullProgress(null);
        return;
      }

      setPullProgress(event);
      if (event.progress >= 1 || event.status === 'success') {
        void refresh();
      }
    });
  }, [refresh]);

  return {
    snapshot,
    isChecking,
    pullProgress,
    refresh,
    setPullProgress,
  };
}
