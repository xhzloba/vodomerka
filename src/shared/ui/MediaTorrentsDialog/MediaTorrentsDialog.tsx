import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TorrentConnectivityProbeResult } from '../../../../contracts/ipc';
import {
  fetchTorrents,
  formatTorrentQuality,
  type TorrentOffer,
} from '@/shared/api/vokino/torrents';
import { getMediaTypeLabel } from '@/shared/domain/media';
import { useTorrents } from '@/shared/domain/TorrentsContext';
import { copyText } from '@/shared/lib/copyText';
import { CopyIcon, DownloadIcon } from '@/shared/ui/icons';
import { SlideMenu } from '@/shared/ui/SlideMenu';
import { Tabs } from '@/shared/ui/Tabs';
import { useToast } from '@/shared/ui/Toast/ToastContext';
import './MediaTorrentsDialog.css';

type ProbeUiState = 'idle' | 'checking' | 'ok' | 'fail';

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
  const value = Number(id);
  return Number.isFinite(value) && value > 0 ? value : 'all';
}

function sortTorrents(items: TorrentOffer[]): TorrentOffer[] {
  return [...items].sort((a, b) => {
    if (b.seeds !== a.seeds) {
      return b.seeds - a.seeds;
    }
    return qualityRank(b.quality) - qualityRank(a.quality);
  });
}

function filterTorrentsByQuality(items: TorrentOffer[], quality: QualityFilter): TorrentOffer[] {
  if (quality === 'all') {
    return items;
  }
  return items.filter((torrent) => torrent.quality === quality);
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
  const { addTorrent } = useTorrents();
  const [torrents, setTorrents] = useState<TorrentOffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all');
  const [probeState, setProbeState] = useState<ProbeUiState>('idle');
  const [probeMessage, setProbeMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !mediaId) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setQualityFilter('all');
    setTorrents([]);
    setProbeState('idle');
    setProbeMessage(null);

    void fetchTorrents(mediaId)
      .then((items) => {
        if (!cancelled) {
          setTorrents(sortTorrents(items));
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
      if (torrent.quality != null) {
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

  const visibleTorrents = useMemo(
    () => sortTorrents(filterTorrentsByQuality(torrents, qualityFilter)),
    [qualityFilter, torrents],
  );

  const handleQualityChange = useCallback((id: string) => {
    setQualityFilter(parseQualityFilter(id));
  }, []);

  const metaParts = [
    type ? getMediaTypeLabel(type) : null,
    year != null ? String(year) : null,
    !isLoading && !error ? `${visibleTorrents.length} раздач` : null,
  ].filter(Boolean);

  const handleProbeConnectivity = useCallback(async () => {
    if (!window.electronAPI?.torrents?.probeConnectivity) {
      showToast('Проверка доступна только в приложении', {
        kind: 'error',
        title: 'Сеть',
      });
      return;
    }

    setProbeState('checking');
    setProbeMessage('Проверяем DNS и трекеры…');

    try {
      const result: TorrentConnectivityProbeResult =
        await window.electronAPI.torrents.probeConnectivity();
      setProbeState(result.ok ? 'ok' : 'fail');
      setProbeMessage(result.message);
      showToast(result.message, {
        kind: result.ok ? 'success' : 'error',
        title: result.ok ? 'Соединение OK' : 'Проблема с сетью',
      });
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : 'Не удалось проверить соединение';
      setProbeState('fail');
      setProbeMessage(text);
      showToast(text, { kind: 'error', title: 'Сеть' });
    }
  }, [showToast]);

  const startDownload = useCallback(
    (torrent: TorrentOffer) => {
      void addTorrent({
        magnet: torrent.magnet,
        title: torrent.title,
        mediaId,
        mediaTitle: title,
        posterUrl,
        quality: torrent.quality,
        sizeName: torrent.sizeName,
        trackerName: torrent.trackerName,
      }).then((result) => {
        if (result.ok) {
          showToast(`${formatTorrentQuality(torrent.quality)} · ${torrent.sizeName}`, {
            kind: 'restore',
            title: 'Добавлено в Торренты',
          });
          onClose();
          return;
        }

        void copyText(torrent.magnet).then((copied) => {
          showToast(
            copied
              ? `${result.error}. Magnet скопирован`
              : (result.error ?? 'Не удалось добавить торрент'),
            {
              kind: 'hide',
              title: 'Ошибка загрузки',
            },
          );
        });
      });
    },
    [addTorrent, mediaId, onClose, posterUrl, showToast, title],
  );

  const handleDownload = (torrent: TorrentOffer) => {
    if (probeState === 'fail') {
      showToast('Трекеры/сеть недоступны — загрузка может зависнуть на «Ищем пиров»', {
        kind: 'tip',
        title: 'Слабое соединение',
      });
    }
    startDownload(torrent);
  };

  const handleCopy = async (torrent: TorrentOffer) => {
    const ok = await copyText(torrent.magnet);
    showToast(ok ? 'Magnet скопирован' : 'Не удалось скопировать', {
      kind: 'copy',
      title: ok ? 'Скопировано' : 'Ошибка',
    });
  };

  return (
    <SlideMenu open={open} title="Скачать" size="wide" onClose={onClose}>
      <div className="media-torrents-panel">
        <div className="media-torrents-panel__identity">
          <div className="media-torrents-panel__poster" aria-hidden="true">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt=""
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="media-torrents-panel__poster-fallback">{title.slice(0, 1)}</span>
            )}
          </div>
          <div className="media-torrents-panel__heading">
            <h3 className="media-torrents-panel__title">{title}</h3>
            {subtitle ? <p className="media-torrents-panel__original">{subtitle}</p> : null}
            {metaParts.length > 0 ? (
              <p className="media-torrents-panel__meta">{metaParts.join(' · ')}</p>
            ) : null}
          </div>
        </div>

        {qualities.length > 1 ? (
          <div
            className="media-torrents-panel__tabs"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <Tabs
              items={qualityTabs}
              activeId={qualityFilter === 'all' ? 'all' : String(qualityFilter)}
              onChange={handleQualityChange}
              ariaLabel="Качество"
              variant="segmented"
            />
          </div>
        ) : null}

        <div className="media-torrents-panel__body" key={`quality-${qualityFilter}`}>
          {isLoading ? (
            <div className="media-torrents-panel__state">
              <span className="media-torrents-panel__spinner" aria-hidden="true" />
              <p>Ищем раздачи…</p>
            </div>
          ) : null}

          {!isLoading && error ? (
            <div className="media-torrents-panel__state media-torrents-panel__state--error">
              <p>{error}</p>
            </div>
          ) : null}

          {!isLoading && !error && visibleTorrents.length === 0 ? (
            <div className="media-torrents-panel__state">
              <p>Раздач не найдено</p>
            </div>
          ) : null}

          {!isLoading && !error && visibleTorrents.length > 0 ? (
            <ul className="media-torrents-panel__list">
              {visibleTorrents.map((torrent, index) => (
                <li key={`${qualityFilter}-${torrent.id}`}>
                  <div className="media-torrents-panel__row">
                    <button
                      type="button"
                      className="media-torrents-panel__main"
                      onClick={() => handleDownload(torrent)}
                    >
                      <span className="media-torrents-panel__quality">
                        {formatTorrentQuality(torrent.quality)}
                      </span>
                      <span className="media-torrents-panel__copy">
                        <span className="media-torrents-panel__topline">
                          <span className="media-torrents-panel__size">{torrent.sizeName}</span>
                          {torrent.bitrate ? (
                            <span className="media-torrents-panel__dot">{torrent.bitrate}</span>
                          ) : null}
                          <span className="media-torrents-panel__dot">{torrent.trackerName}</span>
                          {index === 0 && qualityFilter === 'all' ? (
                            <span className="media-torrents-panel__best">топ</span>
                          ) : null}
                        </span>
                        <span className="media-torrents-panel__name">{torrent.title}</span>
                        <span className="media-torrents-panel__bottom">
                          <span className="media-torrents-panel__seeds">
                            ↑ {seedLabel(torrent.seeds)}
                            <span className="media-torrents-panel__peers">
                              {' '}
                              · ↓ {seedLabel(torrent.peers)}
                            </span>
                          </span>
                          {torrent.voice ? (
                            <span className="media-torrents-panel__voice">{torrent.voice}</span>
                          ) : null}
                        </span>
                      </span>
                    </button>

                    <div className="media-torrents-panel__actions">
                      <button
                        type="button"
                        className="media-torrents-panel__action"
                        aria-label="Скопировать magnet"
                        title="Скопировать magnet"
                        onClick={() => void handleCopy(torrent)}
                      >
                        <CopyIcon size={15} />
                      </button>
                      <button
                        type="button"
                        className="media-torrents-panel__action media-torrents-panel__action--primary"
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

        <div className="media-torrents-panel__footer">
          <button
            type="button"
            className="media-torrents-panel__probe"
            disabled={probeState === 'checking'}
            onClick={() => void handleProbeConnectivity()}
          >
            {probeState === 'checking' ? 'Проверка…' : 'Проверить соединение'}
          </button>
          <p
            className={`media-torrents-panel__footnote${
              probeState === 'ok'
                ? ' media-torrents-panel__footnote--ok'
                : probeState === 'fail'
                  ? ' media-torrents-panel__footnote--fail'
                  : ''
            }`}
          >
            {probeMessage ??
              '↑↓ из каталога — не live. Перед скачиванием лучше проверить трекеры.'}
          </p>
        </div>
      </div>
    </SlideMenu>
  );
}
