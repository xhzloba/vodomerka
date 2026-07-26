import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { MediaPlaybackSession } from '../../../contracts/ipc';

interface PlayerContextValue {
  session: MediaPlaybackSession | null;
  isPreparing: boolean;
  prepareError: string | null;
  playTorrent: (torrentId: string) => Promise<boolean>;
  closePlayer: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<MediaPlaybackSession | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  const closePlayer = useCallback(() => {
    setSession(null);
    setIsPreparing(false);
    setPrepareError(null);

    // Leave OS fullscreen / bring window back — иначе на Mac окно «пропадает» в другом Space.
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
    void window.electronAPI?.media?.stopPlayback?.();
    void window.electronAPI?.windowChrome?.setFullScreen?.(false);
    void window.electronAPI?.windowChrome?.setPlayerOpen?.(false);
    void window.electronAPI?.windowChrome?.focusMain?.();
  }, []);

  useEffect(() => {
    const open = Boolean(session) || isPreparing || Boolean(prepareError);
    void window.electronAPI?.windowChrome?.setPlayerOpen?.(open);
  }, [session, isPreparing, prepareError]);

  useEffect(() => {
    return window.electronAPI?.windowChrome?.onClosePlayer?.(() => {
      closePlayer();
    });
  }, [closePlayer]);

  const playTorrent = useCallback(async (torrentId: string) => {
    if (!window.electronAPI?.media?.prepareTorrentPlayback) {
      setPrepareError('Плеер доступен только в приложении');
      setIsPreparing(false);
      setSession(null);
      return false;
    }

    setIsPreparing(true);
    setPrepareError(null);
    setSession(null);

    try {
      const result = await window.electronAPI.media.prepareTorrentPlayback(torrentId);
      if (!result.ok) {
        setPrepareError(result.error);
        setIsPreparing(false);
        return false;
      }
      setSession(result.session);
      setIsPreparing(false);
      return true;
    } catch (error) {
      setPrepareError(error instanceof Error ? error.message : 'Ошибка плеера');
      setIsPreparing(false);
      return false;
    }
  }, []);

  const value = useMemo(
    () => ({
      session,
      isPreparing,
      prepareError,
      playTorrent,
      closePlayer,
    }),
    [session, isPreparing, prepareError, playTorrent, closePlayer],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within PlayerProvider');
  }
  return context;
}
