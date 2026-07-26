import { useEffect, useMemo } from 'react';
import type { TorrentDownloadRecord } from '../../../contracts/ipc';
import { useTorrents } from '@/shared/domain/TorrentsContext';
import { formatTorrentQuality } from '@/shared/api/vokino/torrents';
import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import { useToast } from '@/shared/ui/Toast/ToastContext';
import { DownloadIcon, FolderIcon, PlayIcon, TrashIcon } from '@/shared/ui/icons';
import { PageLoading } from '@/shared/ui/PageState';
import '../BrowseView/BrowseView.css';
import './TorrentsView.css';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatSpeed(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) {
    return '';
  }
  return `${formatBytes(bytesPerSec)}/с`;
}

function statusLabel(item: TorrentDownloadRecord): string {
  switch (item.status) {
    case 'queued':
      return 'В очереди';
    case 'downloading':
      return 'Качается';
    case 'done':
      return 'Готово';
    case 'paused':
      return 'Пауза';
    case 'error':
      return item.error || 'Ошибка';
  }
}

export function TorrentsView({ isActive = true }: { isActive?: boolean }) {
  const {
    torrents,
    isLoading,
    folderPath,
    removeTorrent,
    openTorrentFile,
    openTorrentsFolder,
  } = useTorrents();
  const { showToast } = useToast();
  const scrollRef = useOverlayScroll<HTMLDivElement>();

  const sorted = useMemo(
    () => [...torrents].sort((a, b) => b.addedAt - a.addedAt),
    [torrents],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [isActive, scrollRef]);

  const handleOpen = async (id: string) => {
    const result = await openTorrentFile(id);
    if (!result.ok) {
      showToast(result.error ?? 'Не удалось открыть файл', {
        kind: 'hide',
        title: 'Ошибка',
      });
    }
  };

  const handleOpenFolder = async () => {
    const result = await openTorrentsFolder();
    if (!result.ok) {
      showToast(result.error ?? 'Не удалось открыть папку', {
        kind: 'hide',
        title: 'Ошибка',
      });
    }
  };

  return (
    <div className="library-view torrents-view">
      <div className="library-view__header">
        <div className="library-view__title-group">
          <h1 className="library-view__title">Торренты</h1>
          <button
            type="button"
            className="library-view__clear-btn torrents-view__folder-btn"
            onClick={() => void handleOpenFolder()}
            aria-label="Открыть папку Torrents"
            title={folderPath ?? 'Папка Torrents'}
          >
            <FolderIcon size={18} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="library-view__scroll scroll-overlay">
        {isLoading ? (
          <PageLoading title="Загрузка торрентов..." centered />
        ) : sorted.length === 0 ? (
          <div className="library-view__empty">
            <div className="library-view__empty-icon">
              <DownloadIcon size={48} strokeWidth={1.5} />
            </div>
            <p className="library-view__empty-text">
              Раздачи появятся здесь после «Скачать» в меню постера
            </p>
          </div>
        ) : (
          <ul className="torrents-view__list">
            {sorted.map((item) => {
              const percent = Math.round(Math.min(1, Math.max(0, item.progress)) * 100);
              const meta = [
                item.quality != null ? formatTorrentQuality(item.quality) : null,
                item.sizeName || (item.length > 0 ? formatBytes(item.length) : null),
                item.trackerName,
                statusLabel(item),
                item.status === 'downloading' ? formatSpeed(item.downloadSpeed) : null,
              ].filter(Boolean);

              return (
                <li key={item.id} className="torrents-view__item">
                  <div className="torrents-view__poster" aria-hidden="true">
                    {item.posterUrl ? (
                      <img src={item.posterUrl} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <span>{item.title.slice(0, 1)}</span>
                    )}
                  </div>

                  <div className="torrents-view__body">
                    <div className="torrents-view__topline">
                      <h2 className="torrents-view__name">{item.mediaTitle || item.title}</h2>
                      <span className="torrents-view__percent">{percent}%</span>
                    </div>
                    {item.mediaTitle && item.title !== item.mediaTitle ? (
                      <p className="torrents-view__subtitle">{item.title}</p>
                    ) : null}
                    <p className="torrents-view__meta">{meta.join(' · ')}</p>
                    <div className="torrents-view__progress" aria-hidden="true">
                      <span style={{ width: `${percent}%` }} />
                    </div>
                  </div>

                  <div className="torrents-view__actions">
                    <button
                      type="button"
                      className="torrents-view__action torrents-view__action--primary"
                      aria-label="Открыть"
                      title="Открыть"
                      disabled={item.status !== 'done' && item.progress < 0.05}
                      onClick={() => void handleOpen(item.id)}
                    >
                      <PlayIcon size={15} />
                    </button>
                    <button
                      type="button"
                      className="torrents-view__action"
                      aria-label="Удалить"
                      title="Удалить"
                      onClick={() => void removeTorrent(item.id, false)}
                    >
                      <TrashIcon size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
