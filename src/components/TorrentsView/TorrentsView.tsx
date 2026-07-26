import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TorrentDownloadRecord } from '../../../contracts/ipc';
import { useTorrents } from '@/shared/domain/TorrentsContext';
import { usePlayer } from '@/shared/domain/PlayerContext';
import {
  formatProgressPercent,
  getProgressPercent,
  hasMultipleEpisodes,
  listVideoTorrentFiles,
} from '@/shared/domain/torrentEpisodes';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import { formatTorrentQuality } from '@/shared/api/vokino/torrents';
import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import { useToast } from '@/shared/ui/Toast/ToastContext';
import { EpisodePickerDialog } from '@/shared/ui/EpisodePickerDialog/EpisodePickerDialog';
import { PlayerPickerDialog } from '@/shared/ui/PlayerPickerDialog/PlayerPickerDialog';
import {
  DownloadIcon,
  FolderIcon,
  PauseBarsIcon,
  PlayIcon,
  TrashIcon,
} from '@/shared/ui/icons';
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
    pauseTorrent,
    resumeTorrent,
    openTorrentsFolder,
  } = useTorrents();
  const { playTorrent } = usePlayer();
  const { settings, updateSettings } = useAppSettings();
  const { showToast } = useToast();
  const scrollRef = useOverlayScroll<HTMLDivElement>();
  const [episodeTorrentId, setEpisodeTorrentId] = useState<string | null>(null);
  const [pickerTorrentId, setPickerTorrentId] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);

  const sorted = useMemo(
    () => [...torrents].sort((a, b) => b.addedAt - a.addedAt),
    [torrents],
  );

  const episodeTorrent = useMemo(
    () => torrents.find((item) => item.id === episodeTorrentId) ?? null,
    [torrents, episodeTorrentId],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [isActive, scrollRef]);

  const handleOpenFolder = async () => {
    const result = await openTorrentsFolder();
    if (!result.ok) {
      showToast(result.error ?? 'Не удалось открыть папку', {
        kind: 'hide',
        title: 'Ошибка',
      });
    }
  };

  const handlePlayClick = (item: TorrentDownloadRecord) => {
    setSelectedFilePath(null);
    if (hasMultipleEpisodes(item.files)) {
      setEpisodeTorrentId(item.id);
      return;
    }
    setPickerTorrentId(item.id);
  };

  const handleEpisodeConfirm = (filePath: string) => {
    if (!episodeTorrentId) {
      return;
    }
    setSelectedFilePath(filePath);
    setEpisodeTorrentId(null);
    setPickerTorrentId(episodeTorrentId);
  };

  const handlePickerConfirm = useCallback(
    async (playerId: string, remember: boolean) => {
      if (!pickerTorrentId) {
        return;
      }

      const torrentId = pickerTorrentId;
      const filePath = selectedFilePath ?? undefined;

      // Close picker immediately — prepare/remux must not leave a disabled modal on screen.
      setPickerTorrentId(null);
      setSelectedFilePath(null);
      setIsOpening(false);

      try {
        if (remember && playerId !== settings.torrentPlaybackPlayerId) {
          await updateSettings({ torrentPlaybackPlayerId: playerId });
        }

        if (playerId === 'vodomerka') {
          const played = await playTorrent(torrentId, filePath);
          if (!played.ok) {
            showToast(played.error, {
              kind: 'hide',
              title: 'Плеер',
            });
          }
          return;
        }

        const result = await window.electronAPI?.torrents?.openInPlayer?.(
          torrentId,
          playerId,
          filePath,
        );
        if (!result?.ok) {
          showToast(result?.error ?? 'Не удалось открыть в плеере', {
            kind: 'hide',
            title: 'Плеер',
          });
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Не удалось открыть в плеере', {
          kind: 'hide',
          title: 'Плеер',
        });
      }
    },
    [
      pickerTorrentId,
      playTorrent,
      selectedFilePath,
      settings.torrentPlaybackPlayerId,
      showToast,
      updateSettings,
    ],
  );

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
              const percent = getProgressPercent(item.progress);
              const percentLabel = formatProgressPercent(item.progress);
              const meta = [
                item.quality != null ? formatTorrentQuality(item.quality) : null,
                item.sizeName || (item.length > 0 ? formatBytes(item.length) : null),
                item.trackerName,
                statusLabel(item),
                item.status === 'downloading' ? formatSpeed(item.downloadSpeed) : null,
                hasMultipleEpisodes(item.files)
                  ? `${listVideoTorrentFiles(item.files).length} серий`
                  : null,
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
                    <h2 className="torrents-view__name">{item.mediaTitle || item.title}</h2>
                    {item.mediaTitle && item.title !== item.mediaTitle ? (
                      <p className="torrents-view__subtitle">{item.title}</p>
                    ) : null}
                    <p className="torrents-view__meta">{meta.join(' · ')}</p>
                    <div className="torrents-view__progress" aria-hidden="true">
                      <span style={{ width: `${percent}%` }} />
                    </div>
                  </div>

                  <div className="torrents-view__actions">
                    <span className="torrents-view__percent">{percentLabel}%</span>
                    <button
                      type="button"
                      className="torrents-view__action torrents-view__action--primary"
                      aria-label="Смотреть"
                      title="Смотреть"
                      disabled={item.status === 'error'}
                      onClick={() => handlePlayClick(item)}
                    >
                      <PlayIcon size={15} />
                    </button>
                    {item.status === 'downloading' || item.status === 'queued' ? (
                      <button
                        type="button"
                        className="torrents-view__action"
                        aria-label="Пауза загрузки"
                        title="Пауза загрузки"
                        onClick={() => void pauseTorrent(item.id)}
                      >
                        <PauseBarsIcon size={15} />
                      </button>
                    ) : item.status === 'paused' || item.status === 'error' ? (
                      <button
                        type="button"
                        className="torrents-view__action"
                        aria-label="Продолжить загрузку"
                        title={
                          item.status === 'error'
                            ? 'Повторить загрузку'
                            : 'Продолжить загрузку'
                        }
                        onClick={() => void resumeTorrent(item.id)}
                      >
                        <DownloadIcon size={15} strokeWidth={2} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="torrents-view__action"
                      aria-label="Удалить"
                      title={
                        item.status === 'done'
                          ? 'Убрать из списка (файлы останутся)'
                          : 'Отменить и удалить недокачанные файлы'
                      }
                      onClick={() => void removeTorrent(item.id, item.status !== 'done')}
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

      <EpisodePickerDialog
        open={episodeTorrent != null}
        title={episodeTorrent?.mediaTitle || episodeTorrent?.title || 'Выбор серии'}
        files={episodeTorrent?.files ?? []}
        onCancel={() => setEpisodeTorrentId(null)}
        onConfirm={handleEpisodeConfirm}
      />

      <PlayerPickerDialog
        open={pickerTorrentId != null}
        defaultPlayerId={settings.torrentPlaybackPlayerId || 'vodomerka'}
        isOpening={isOpening}
        onCancel={() => {
          if (!isOpening) {
            setPickerTorrentId(null);
            setSelectedFilePath(null);
          }
        }}
        onConfirm={(playerId, remember) => {
          void handlePickerConfirm(playerId, remember);
        }}
      />
    </div>
  );
}
