import { useEffect, useState } from 'react';
import type { MediaPlaybackSession } from '../../../contracts/ipc';
import { usePlayer } from '@/shared/domain/PlayerContext';
import { PageError } from '@/shared/ui/PageState';

export function PlayerWindowShell() {
  const { adoptSession, session } = usePlayer();
  const [loadFailed, setLoadFailed] = useState(false);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const next = await window.electronAPI?.player?.get?.();
        if (cancelled) {
          return;
        }
        if (!next) {
          setLoadFailed(true);
          setBooted(true);
          return;
        }
        adoptSession(next);
        setBooted(true);
      } catch {
        if (!cancelled) {
          setLoadFailed(true);
          setBooted(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [adoptSession]);

  useEffect(() => {
    return window.electronAPI?.player?.onSession?.((next: MediaPlaybackSession) => {
      adoptSession(next);
      setLoadFailed(false);
      setBooted(true);
    });
  }, [adoptSession]);

  useEffect(() => {
    if (!booted) {
      return;
    }
    window.electronAPI?.player?.notifyReady?.();
  }, [booted, session?.torrentId, session?.url]);

  if (loadFailed) {
    return (
      <div className="player-window-shell page-state-shell">
        <div className="titlebar" aria-hidden="true" />
        <PageError
          title="Не удалось открыть плеер"
          text="Попробуйте запустить воспроизведение снова из приложения."
        />
      </div>
    );
  }

  return (
    <div className="player-window-shell">
      <div className="titlebar" aria-hidden="true" />
    </div>
  );
}
