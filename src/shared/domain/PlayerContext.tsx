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
import { isPlayerWindow } from '@/shared/platform/mediaPlayerWindow';

interface PlayerContextValue {
  session: MediaPlaybackSession | null;
  isPreparing: boolean;
  prepareError: string | null;
  playTorrent: (
    torrentId: string,
    filePath?: string,
    startSeconds?: number,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  adoptSession: (session: MediaPlaybackSession) => void;
  closePlayer: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

async function prepareLocalSession(
  torrentId: string,
  filePath?: string,
  startSeconds?: number,
): Promise<{ ok: true; session: MediaPlaybackSession } | { ok: false; error: string }> {
  if (!window.electronAPI?.media?.prepareTorrentPlayback) {
    return { ok: false, error: 'Плеер доступен только в приложении' };
  }

  try {
    const result = await window.electronAPI.media.prepareTorrentPlayback(torrentId, filePath);
    if (!result.ok) {
      return result;
    }
    const resumeAt =
      typeof startSeconds === 'number' && Number.isFinite(startSeconds) && startSeconds > 0
        ? startSeconds
        : undefined;
    return {
      ok: true,
      session: resumeAt != null ? { ...result.session, startSeconds: resumeAt } : result.session,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Ошибка плеера',
    };
  }
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<MediaPlaybackSession | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const inPlayerWindow = isPlayerWindow();

  const closePlayer = useCallback(() => {
    setSession(null);
    setIsPreparing(false);
    setPrepareError(null);

    if (typeof document !== 'undefined' && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }

    if (inPlayerWindow) {
      // Closing the dedicated player window also stops playback (main process).
      void window.electronAPI?.player?.close?.();
      return;
    }

    void window.electronAPI?.media?.stopPlayback?.();
    void window.electronAPI?.windowChrome?.setPlayerOpen?.(false);
    void window.electronAPI?.windowChrome?.setFullScreen?.(false);
  }, [inPlayerWindow]);

  useEffect(() => {
    if (inPlayerWindow) {
      // Player BrowserWindow owns chrome; don't mark main overlay open.
      return;
    }
    const open = Boolean(session) || isPreparing || Boolean(prepareError);
    void window.electronAPI?.windowChrome?.setPlayerOpen?.(open);
  }, [session, isPreparing, prepareError, inPlayerWindow]);

  useEffect(() => {
    if (inPlayerWindow) {
      return;
    }
    return window.electronAPI?.windowChrome?.onClosePlayer?.(() => {
      closePlayer();
    });
  }, [closePlayer, inPlayerWindow]);

  const adoptSession = useCallback((next: MediaPlaybackSession) => {
    setPrepareError(null);
    setIsPreparing(false);
    setSession(next);
  }, []);

  const playTorrent = useCallback(
    async (torrentId: string, filePath?: string, startSeconds?: number) => {
      // Inside the player window (episode switch) — replace session locally.
      if (inPlayerWindow) {
        setIsPreparing(true);
        setPrepareError(null);
        setSession(null);

        const prepared = await prepareLocalSession(torrentId, filePath, startSeconds);
        if (!prepared.ok) {
          setPrepareError(prepared.error);
          setIsPreparing(false);
          return prepared;
        }
        setSession(prepared.session);
        setIsPreparing(false);
        return { ok: true as const };
      }

      // Main / detail: open dedicated player BrowserWindow — keep home visible.
      if (window.electronAPI?.player?.openTorrent) {
        setIsPreparing(false);
        setPrepareError(null);
        setSession(null);
        const result = await window.electronAPI.player.openTorrent({
          torrentId,
          filePath,
          startSeconds,
        });
        if (!result.ok) {
          return { ok: false as const, error: result.error };
        }
        return { ok: true as const };
      }

      // Fallback (web / old preload): in-window overlay.
      setIsPreparing(true);
      setPrepareError(null);
      setSession(null);
      const prepared = await prepareLocalSession(torrentId, filePath, startSeconds);
      if (!prepared.ok) {
        setPrepareError(prepared.error);
        setIsPreparing(false);
        return prepared;
      }
      setSession(prepared.session);
      setIsPreparing(false);
      return { ok: true as const };
    },
    [inPlayerWindow],
  );

  const value = useMemo(
    () => ({
      session,
      isPreparing,
      prepareError,
      playTorrent,
      adoptSession,
      closePlayer,
    }),
    [session, isPreparing, prepareError, playTorrent, adoptSession, closePlayer],
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
