import { useCallback, useRef, useState } from 'react';
import type { ApiServerId } from '@/shared/settings/types';
import {
  probeAllApiServers,
  type ApiServerHealthStatus,
} from '@/shared/api/vokino/serverHealth';

type HealthMap = Record<ApiServerId, ApiServerHealthStatus>;

const INITIAL_HEALTH: HealthMap = {
  '1': 'idle',
  '2': 'idle',
};

export function useApiServerHealth() {
  const [health, setHealth] = useState<HealthMap>(INITIAL_HEALTH);
  const [isChecking, setIsChecking] = useState(false);
  const requestIdRef = useRef(0);

  const check = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsChecking(true);
    setHealth({ '1': 'checking', '2': 'checking' });

    try {
      const result = await probeAllApiServers();
      if (requestId !== requestIdRef.current) {
        return;
      }

      setHealth({
        '1': result['1'] ? 'ok' : 'fail',
        '2': result['2'] ? 'ok' : 'fail',
      });
    } finally {
      if (requestId === requestIdRef.current) {
        setIsChecking(false);
      }
    }
  }, []);

  return { health, isChecking, check };
}
