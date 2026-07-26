import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchTorrents,
  formatTorrentQuality,
  openMagnetLink,
  type TorrentOffer,
} from '@/shared/api/vokino/torrents';
import { getMediaTypeLabel } from '@/shared/domain/media';
import { copyText } from '@/shared/lib/copyText';
import { CloseIcon, CopyIcon, DownloadIcon } from '@/shared/ui/icons';
import { Tabs } from '@/shared/ui/Tabs';
import { useToast } from '@/shared/ui/Toast/ToastContext';
import './MediaTorrentsDialog.css';

interface MediaTorrentsDialogProps {
  open: boolean;
  mediaId: string;
  title: string;
  subtitle?: string;
  year?: number;
  type?: string;
  posterUrl?: string;
  onClose: () => void;
}

type QualityFilter = 'all' | number;

function qualityRank(quality: number | null): number {
  return quality ?? 0;
}

function seedLabel(seeds: number): string {
  if (seeds >= 1000) {
    return `${(seeds / 1000).toFixed(seeds >= 10000 ? 0 : 1)}k`;
  }
  return String(seeds);
}

function parseQualityFilter(id: string): QualityFilter {
  if (id === 'all') {
    return 'all';
  }
  const value = Number.parseInt(id, 10);
  return Number.isFinite(value) ? value : 'all';
}

export function MediaTorrentsDialog({
  open,
  mediaId,
  title,
  subtitle,
  year,
  type,
  posterUrl,
  onClose,
}: MediaTorrentsDialogProps) {
  const { showToast } = useToast();
  const [torrents, setTorrents] = useState<TorrentOffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all');

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open || !mediaId) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setQualityFilter('all');
    setTorrents([]);

    void fetchTorrents(mediaId)
      .then((items) => {
        if (!cancelled) {
          setTorrents(items);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить торренты');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mediaId, open]);

  const qualities = useMemo(() => {
    const values = new Set<number>();
    for (const torrent of torrents) {
      if (torrent.quality != null && torrent.quality > 0) {
        values.add(torrent.quality);
      }
    }
    return [...values].sort((a, b) => b - a);
  }, [torrents]);

  const qualityTabs = useMemo(
    () => [
      { id: 'all', label: 'Все' },
      ...qualities.map((quality) => ({
        id: String(quality),
        label: formatTorrentQuality(quality),
      })),
    ],
    [qualities],
  );

  const visibleTorrents = useMemo(() => {
    const filtered =
      qualityFilter === 'all'
        ? torrents
        : torrents.filter((torrent) => torrent.quality === qualityFilter);

    return [...filtered].sort((a, b) => {
      if (b.seeds !== a.seeds) {
        return b.seeds - a.seeds;
      }
      return qualityRank(b.quality) - qualityRank(a.quality);
    });
  }, [qualityFilter, torrents]);

  const metaParts = [
    type ? getMediaTypeLabel(type) : null,
    year != null ? String(year) : null,
    !isLoading && !error ? `${visibleTorrents.length} раздач` : null,
  ].filter(Boolean);

  const handleDownload = (torrent: TorrentOffer) => {
    void openMagnetLink(torrent.magnet).then(async (result) => {
      if (result.ok) {
        showToast(`${formatTorrentQuality(torrent.quality)} · ${torrent.sizeName}`, {
          kind: 'restore',
          title:
            result.via &&
            result.via !== 'system' &&
            result.via !== 'browser' &&
            result.via !== 'anchor'
              ? `Открыто в ${result.via}`
              : 'Открыт торрент-клиент',
        });
        onClose();
        return;
      }

      const copied = await copyText(torrent.magnet);
      showToast(
        copied
          ? 'Magnet скопирован — вставь в Transmission / qBittorrent'
          : (result.error ?? 'Нет приложения для magnet'),
        {
          kind: 'hide',
          title: 'Нужен торрент-клиент',
        },
      );
    });
  };

  const handleCopy = async (torrent: TorrentOffer) => {
    const ok = await copyText(torrent.magnet);
    showToast(ok ? 'Magnet скопирован' : 'Не удалось скопировать', {
      kind: 'copy',
      title: ok ? 'Скопировано' : 'Ошибка',
    });
  };

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="media-torrents-dialog" role="presentation">
      <button
        type="button"
        className="media-torrents-dialog__backdrop"
        aria-label="Закрыть список торрентов"
        onClick={onClose}
      />

      <div className="media-torrents-dialog__snake">
        <div className="media-torrents-dialog__snake-ring" aria-hidden="true">
          <div className="media-torrents-dialog__snake-beam media-torrents-dialog__snake-beam--trail" />
          <div className="media-torrents-dialog__snake-beam media-torrents-dialog__snake-beam--core" />
        </div>

        <div
          className="media-torrents-dialog__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="media-torrents-dialog-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="media-torrents-dialog__header">
            <div className="media-torrents-dialog__identity">
              <div className="media-torrents-dialog__poster" aria-hidden="true">
                {posterUrl ? (
                  <img
                    src={posterUrl}
                    alt=""
                    loading="eager"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="media-torrents-dialog__poster-fallback">
                    {title.slice(0, 1)}
                  </span>
                )}
              </div>
              <div className="media-torrents-dialog__heading">
                <p className="media-torrents-dialog__eyebrow">
                  <DownloadIcon size={13} strokeWidth={2} />
                  Скачать
                </p>
                <h3 id="media-torrents-dialog-title" className="media-torrents-dialog__title">
                  {title}
                </h3>
                {subtitle ? (
                  <p className="media-torrents-dialog__original">{subtitle}</p>
                ) : null}
                {metaParts.length > 0 ? (
                  <p className="media-torrents-dialog__meta">{metaParts.join(' · ')}</p>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              className="media-torrents-dialog__close"
              aria-label="Закрыть"
              onClick={onClose}
            >
              <CloseIcon size={18} />
            </button>
          </div>

          {qualities.length > 1 ? (
            <div className="media-torrents-dialog__tabs">
              <Tabs
                items={qualityTabs}
                activeId={qualityFilter === 'all' ? 'all' : String(qualityFilter)}
                onChange={(id) => setQualityFilter(parseQualityFilter(id))}
                ariaLabel="Качество"
                variant="segmented"
              />
            </div>
          ) : null}

          <div className="media-torrents-dialog__body">
            {isLoading ? (
              <div className="media-torrents-dialog__state">
                <span className="media-torrents-dialog__spinner" aria-hidden="true" />
                <p>Ищем раздачи…</p>
              </div>
            ) : null}

            {!isLoading && error ? (
              <div className="media-torrents-dialog__state media-torrents-dialog__state--error">
                <p>{error}</p>
              </div>
            ) : null}

            {!isLoading && !error && visibleTorrents.length === 0 ? (
              <div className="media-torrents-dialog__state">
                <p>Раздач не найдено</p>
              </div>
            ) : null}

            {!isLoading && !error && visibleTorrents.length > 0 ? (
              <ul className="media-torrents-dialog__list">
                {visibleTorrents.map((torrent, index) => (
                  <li key={torrent.id}>
                    <div className="media-torrents-dialog__row">
                      <button
                        type="button"
                        className="media-torrents-dialog__main"
                        onClick={() => handleDownload(torrent)}
                      >
                        <span className="media-torrents-dialog__quality">
                          {formatTorrentQuality(torrent.quality)}
                        </span>
                        <span className="media-torrents-dialog__copy">
                          <span className="media-torrents-dialog__topline">
                            <span className="media-torrents-dialog__size">{torrent.sizeName}</span>
                            {torrent.bitrate ? (
                              <span className="media-torrents-dialog__dot">{torrent.bitrate}</span>
                            ) : null}
                            <span className="media-torrents-dialog__dot">
                              {torrent.trackerName}
                            </span>
                            {index === 0 && qualityFilter === 'all' ? (
                              <span className="media-torrents-dialog__best">топ</span>
                            ) : null}
                          </span>
                          <span className="media-torrents-dialog__name">{torrent.title}</span>
                          <span className="media-torrents-dialog__bottom">
                            <span className="media-torrents-dialog__seeds">
                              ↑ {seedLabel(torrent.seeds)}
                              <span className="media-torrents-dialog__peers">
                                {' '}
                                · ↓ {seedLabel(torrent.peers)}
                              </span>
                            </span>
                            {torrent.voice ? (
                              <span className="media-torrents-dialog__voice">{torrent.voice}</span>
                            ) : null}
                          </span>
                        </span>
                      </button>

                      <div className="media-torrents-dialog__actions">
                        <button
                          type="button"
                          className="media-torrents-dialog__action"
                          aria-label="Скопировать magnet"
                          title="Скопировать magnet"
                          onClick={() => void handleCopy(torrent)}
                        >
                          <CopyIcon size={15} />
                        </button>
                        <button
                          type="button"
                          className="media-torrents-dialog__action media-torrents-dialog__action--primary"
                          aria-label="Скачать"
                          title="Скачать"
                          onClick={() => handleDownload(torrent)}
                        >
                          <DownloadIcon size={15} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <p className="media-torrents-dialog__footnote">
            Откроется в торрент-клиенте (не в VLC)
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
