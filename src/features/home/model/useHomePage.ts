import { useCallback, useEffect, useRef, useState } from 'react';
import type { HomePageData } from '@/shared/api/vokino/repository';
import { sanitizeHomePageData, vokinoRepository } from '@/shared/api/vokino/repository';
import { ensureMediaOverridesLoaded } from '@/shared/domain/overridesStore';
import { VOKINO_API_SERVER_CHANGED_EVENT } from '@/shared/config/api';

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

interface AsyncState {
  status: AsyncStatus;
  data: HomePageData | null;
  error: string | null;
  isRefreshing: boolean;
}

const initialState: AsyncState = {
  status: 'idle',
  data: null,
  error: null,
  isRefreshing: false,
};

let homePageCache: HomePageData | null = null;

function createInitialState(): AsyncState {
  if (homePageCache) {
    return {
      status: 'success',
      data: sanitizeHomePageData(homePageCache),
      error: null,
      isRefreshing: false,
    };
  }

  return initialState;
}

export function useHomePage() {
  const [state, setState] = useState(createInitialState);
  const requestIdRef = useRef(0);

  const load = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    await ensureMediaOverridesLoaded();
    if (requestId !== requestIdRef.current) {
      return;
    }

    const staleData = !force ? homePageCache : null;
    const hasStaleData = staleData !== null;

    if (force) {
      vokinoRepository.clearCache();
      homePageCache = null;
      setState({ status: 'loading', data: null, error: null, isRefreshing: false });
    } else if (hasStaleData) {
      setState({
        status: 'success',
        data: sanitizeHomePageData(staleData),
        error: null,
        isRefreshing: true,
      });
    } else {
      setState({ status: 'loading', data: null, error: null, isRefreshing: false });
    }

    vokinoRepository.clearCache();

    try {
      const data = sanitizeHomePageData(await vokinoRepository.getHomePage());
      if (requestId !== requestIdRef.current) {
        return;
      }

      homePageCache = data;
      setState({ status: 'success', data, error: null, isRefreshing: false });
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (hasStaleData) {
        if (import.meta.env.DEV) {
          console.warn('[home] background refresh failed', error);
        }

        setState((current) => ({
          ...current,
          status: 'success',
          isRefreshing: false,
        }));
        return;
      }

      setState({
        status: 'error',
        data: homePageCache,
        error: error instanceof Error ? error.message : 'Не удалось загрузить главную',
        isRefreshing: false,
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onApiServerChanged = () => {
      homePageCache = null;
      void load({ force: true });
    };

    window.addEventListener(VOKINO_API_SERVER_CHANGED_EVENT, onApiServerChanged);
    return () => {
      window.removeEventListener(VOKINO_API_SERVER_CHANGED_EVENT, onApiServerChanged);
    };
  }, [load]);

  useEffect(() => {
    void ensureMediaOverridesLoaded().then(() => {
      setState((current) => {
        if (current.status !== 'success' || !current.data) {
          return current;
        }

        const hydrated = sanitizeHomePageData(current.data);
        homePageCache = hydrated;
        return { ...current, data: hydrated };
      });
    });
  }, []);

  return {
    ...state,
    reload: () => load({ force: true }),
    isLoading: state.status === 'loading' || (state.status === 'idle' && !homePageCache),
    isError: state.status === 'error',
    isSuccess: state.status === 'success',
  };
}
