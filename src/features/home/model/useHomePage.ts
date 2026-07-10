import { useCallback, useEffect, useState } from 'react';
import type { HomePageData } from '@/shared/api/vokino/repository';
import { sanitizeHomePageData, vokinoRepository } from '@/shared/api/vokino/repository';
import { ensureMediaOverridesLoaded } from '@/shared/domain/overridesStore';

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

interface AsyncState<T> {
  status: AsyncStatus;
  data: T | null;
  error: string | null;
}

const initialState: AsyncState<HomePageData> = {
  status: 'idle',
  data: null,
  error: null,
};

let homePageCache: HomePageData | null = null;

function createInitialState(): AsyncState<HomePageData> {
  if (homePageCache) {
    return { status: 'success', data: sanitizeHomePageData(homePageCache), error: null };
  }

  return initialState;
}

export function useHomePage() {
  const [state, setState] = useState(createInitialState);

  const load = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;

    await ensureMediaOverridesLoaded();

    if (force) {
      vokinoRepository.clearCache();
      homePageCache = null;
      setState({ status: 'loading', data: null, error: null });
    } else if (homePageCache) {
      setState({ status: 'success', data: sanitizeHomePageData(homePageCache), error: null });
      return;
    } else {
      setState({ status: 'loading', data: null, error: null });
    }

    try {
      const data = sanitizeHomePageData(await vokinoRepository.getHomePage());
      homePageCache = data;
      setState({ status: 'success', data, error: null });
    } catch (error) {
      setState({
        status: 'error',
        data: homePageCache,
        error: error instanceof Error ? error.message : 'Не удалось загрузить главную',
      });
    }
  }, []);

  useEffect(() => {
    void load();
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
