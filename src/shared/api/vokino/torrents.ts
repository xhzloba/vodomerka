import { httpGet } from '@/shared/api/httpClient';
import { resolveVokinoUrl } from '@/shared/config/api';
import type { VokinoTorrentsResponse } from '@/shared/api/vokino/types';

export interface TorrentOffer {
  id: string;
  title: string;
  quality: number | null;
  sizeName: string;
  size: number;
  voice: string;
  trackerName: string;
  seeds: number;
  peers: number;
  bitrate: string;
  magnet: string;
  createTime?: string;
}

function parseQuality(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
}

function formatQuality(quality: number | null | undefined): string | null {
  if (quality == null || !Number.isFinite(quality) || quality <= 0) {
    return null;
  }
  if (quality >= 2160) {
    return '4K';
  }
  return `${quality}p`;
}

export function formatTorrentQuality(quality: number | null | undefined): string {
  return formatQuality(quality) ?? '—';
}

const FALLBACK_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'http://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'http://bt3.t-ru.org/ann?magnet',
  'http://bt4.t-ru.org/ann?magnet',
];

/** API often returns bare btih magnets — append public trackers for WebTorrent. */
export function enrichMagnetUri(magnet: string): string {
  const trimmed = magnet.trim();
  if (!trimmed.startsWith('magnet:')) {
    return trimmed;
  }

  // Avoid URL.toString() — it breaks xt=urn:btih for parse-torrent.
  const existing = new Set<string>();
  for (const match of trimmed.matchAll(/[?&]tr=([^&]*)/gi)) {
    try {
      existing.add(decodeURIComponent(match[1] ?? ''));
    } catch {
      existing.add(match[1] ?? '');
    }
  }

  const extras = FALLBACK_TRACKERS.filter((tracker) => !existing.has(tracker))
    .map((tracker) => `tr=${encodeURIComponent(tracker)}`)
    .join('&');

  if (!extras) {
    return trimmed;
  }
  return trimmed.includes('?') ? `${trimmed}&${extras}` : `${trimmed}?${extras}`;
}

export function mapTorrentChannels(response: VokinoTorrentsResponse): TorrentOffer[] {
  return (response.channels ?? [])
    .filter((channel) => Boolean(channel.magnet?.startsWith('magnet:')))
    .map((channel, index) => ({
      id: `${channel.magnet}-${channel.sid ?? index}-${channel.trackerName ?? 'tracker'}`,
      title: channel.title?.trim() || 'Без названия',
      quality: parseQuality(channel.quality),
      sizeName: channel.sizeName?.trim() || '—',
      size: typeof channel.size === 'number' ? channel.size : Number(channel.size) || 0,
      voice: channel.voice?.trim() || '',
      trackerName: channel.trackerName?.trim() || 'tracker',
      seeds: typeof channel.sid === 'number' ? channel.sid : Number(channel.sid) || 0,
      peers: typeof channel.pir === 'number' ? channel.pir : Number(channel.pir) || 0,
      bitrate: channel.bitrate?.trim() || '',
      magnet: enrichMagnetUri(channel.magnet),
      createTime: channel.createTime,
    }));
}

export async function fetchTorrents(
  mediaId: string,
  options?: { quality?: number },
): Promise<TorrentOffer[]> {
  const params = new URLSearchParams({ sort: 'seed_desc' });
  if (options?.quality != null) {
    params.set('quality', String(options.quality));
  }
  const url = resolveVokinoUrl(`/torrents/${encodeURIComponent(mediaId)}?${params.toString()}`);
  const response = await httpGet<VokinoTorrentsResponse>(url);
  return mapTorrentChannels(response);
}

export async function openMagnetLink(magnet: string): Promise<{ ok: boolean; error?: string; via?: string }> {
  if (!magnet.startsWith('magnet:')) {
    return { ok: false, error: 'Некорректная magnet-ссылка' };
  }

  if (window.electronAPI?.system?.openExternal) {
    const result = await window.electronAPI.system.openExternal(magnet);
    if (result.ok) {
      return { ok: true, via: result.via };
    }
    return { ok: false, error: result.error };
  }

  try {
    const opened = window.open(magnet, '_blank', 'noopener,noreferrer');
    if (opened) {
      return { ok: true, via: 'browser' };
    }
  } catch {
    // fall through
  }

  try {
    const link = document.createElement('a');
    link.href = magnet;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return { ok: true, via: 'anchor' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Не удалось открыть magnet',
    };
  }
}
