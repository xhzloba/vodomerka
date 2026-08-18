import { useCallback, useEffect, useState } from 'react';
import { fetchMediaById, isSparseMediaItem } from '@/shared/api/vokino/media';
import type { MediaItem } from '@/shared/domain/media';
import { ensureMediaOverridesLoaded, hydrateMediaItem } from '@/shared/domain/overridesStore';
import { closeMediaDetailWindow } from '@/shared/platform/mediaDetailWindow';
import { MediaDetail } from '@/components/MediaDetail/MediaDetail';
import { PageError } from '@/shared/ui/PageState';
import { useToast } from '@/shared/ui/Toast/ToastContext';

export function DetailWindowShell({ mediaId }: { mediaId: string }) {
  const { showToast } = useToast();
  const [item, setItem] = useState<MediaItem | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setItem(null);
    setLoadFailed(false);

    void ensureMediaOverridesLoaded()
      .then(async () => {
        const payload = await window.electronAPI?.detail.get(mediaId);
        if (!payload) {
          throw new Error('Detail payload not found');
        }

        let next = hydrateMediaItem(payload);
        if (isSparseMediaItem(next) || next.related === undefined || next.similars === undefined) {
          const full = await fetchMediaById(mediaId);
          if (full) {
            next = hydrateMediaItem(full);
          }
        }

        if (!cancelled) {
          setItem(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mediaId]);

  useEffect(() => {
    if (!item && !loadFailed) {
      return;
    }

    window.electronAPI?.detail.notifyReady(mediaId);
  }, [item, loadFailed, mediaId]);

  const handleClose = useCallback(() => {
    closeMediaDetailWindow();
  }, []);

  const handlePlay = useCallback(
    (media: MediaItem) => {
      showToast(media.title, { kind: 'play', title: 'Воспроизведение' });
    },
    [showToast],
  );

  const handleSelect = useCallback((media: MediaItem) => {
    if (media.id === item?.id) {
      return;
    }

    setItem(hydrateMediaItem(media));

    void ensureMediaOverridesLoaded()
      .then(() => fetchMediaById(media.id))
      .then((full) => {
        if (full) {
          setItem(hydrateMediaItem(full));
        }
      })
      .catch(() => {
        showToast('Не удалось открыть карточку', { kind: 'error', title: 'Ошибка' });
      });
  }, [item?.id, showToast]);

  if (loadFailed) {
    return (
      <div className="detail-window-shell page-state-shell">
        <div className="titlebar" aria-hidden="true" />
        <PageError title="Не удалось открыть карточку" text="Попробуйте открыть фильм снова из приложения." />
      </div>
    );
  }

  if (!item) {
    return <div className="detail-window-shell" />;
  }

  return (
    <div className="detail-window-shell">
      <MediaDetail
        key={item.id}
        variant="window"
        item={item}
        onClose={handleClose}
        onPlay={handlePlay}
        onSelect={handleSelect}
      />
      <div className="titlebar" aria-hidden="true" />
    </div>
  );
}
