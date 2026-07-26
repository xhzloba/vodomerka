import type { TorrentDownloadFile } from '../../../contracts/ipc';

const VIDEO_EXT = /\.(mkv|mp4|avi|mov|wmv|m4v|webm|ts)$/i;

const EPISODE_PATTERNS: RegExp[] = [
  /[Ss](\d{1,2})[ ._-]*[Ee](\d{1,3})/,
  /(\d{1,2})x(\d{1,3})\b/,
  /[Ss]eason[ ._-]*(\d{1,2}).*?[Ee]p(?:isode)?[ ._-]*(\d{1,3})/i,
  /сезон[ ._-]*(\d{1,2}).*?сери[яи][ ._-]*(\d{1,3})/i,
];

export interface TorrentEpisode {
  file: TorrentDownloadFile;
  season: number | null;
  episode: number | null;
  label: string;
  sortKey: number;
}

export interface TorrentSeasonGroup {
  season: number | null;
  title: string;
  episodes: TorrentEpisode[];
}

export function isVideoTorrentFile(file: TorrentDownloadFile): boolean {
  return VIDEO_EXT.test(file.name);
}

export function listVideoTorrentFiles(files: TorrentDownloadFile[]): TorrentDownloadFile[] {
  return files.filter(isVideoTorrentFile).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export function parseEpisodeFromName(name: string): { season: number | null; episode: number | null } {
  for (const pattern of EPISODE_PATTERNS) {
    const match = name.match(pattern);
    if (!match) {
      continue;
    }
    const season = Number(match[1]);
    const episode = Number(match[2]);
    if (Number.isFinite(season) && Number.isFinite(episode)) {
      return { season, episode };
    }
  }
  return { season: null, episode: null };
}

export function formatEpisodeLabel(
  season: number | null,
  episode: number | null,
  fileName: string,
): string {
  if (season != null && episode != null) {
    return `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
  }
  return fileName.replace(VIDEO_EXT, '');
}

export function buildTorrentEpisodes(files: TorrentDownloadFile[]): TorrentEpisode[] {
  return listVideoTorrentFiles(files).map((file, index) => {
    const { season, episode } = parseEpisodeFromName(file.name);
    const sortKey =
      season != null && episode != null ? season * 1000 + episode : 100_000 + index;
    return {
      file,
      season,
      episode,
      label: formatEpisodeLabel(season, episode, file.name),
      sortKey,
    };
  });
}

export function groupTorrentEpisodes(files: TorrentDownloadFile[]): TorrentSeasonGroup[] {
  const episodes = buildTorrentEpisodes(files).sort((a, b) => {
    if (a.sortKey !== b.sortKey) {
      return a.sortKey - b.sortKey;
    }
    return a.file.name.localeCompare(b.file.name, 'ru');
  });

  const bySeason = new Map<number | 'other', TorrentEpisode[]>();
  for (const item of episodes) {
    const key = item.season == null ? 'other' : item.season;
    const bucket = bySeason.get(key) ?? [];
    bucket.push(item);
    bySeason.set(key, bucket);
  }

  const seasons = [...bySeason.keys()].sort((a, b) => {
    if (a === 'other') {
      return 1;
    }
    if (b === 'other') {
      return -1;
    }
    return a - b;
  });

  return seasons.map((key) => ({
    season: key === 'other' ? null : key,
    title: key === 'other' ? 'Файлы' : `Сезон ${key}`,
    episodes: bySeason.get(key) ?? [],
  }));
}

export function hasMultipleEpisodes(files: TorrentDownloadFile[]): boolean {
  return listVideoTorrentFiles(files).length > 1;
}

export function getFileProgress(file: TorrentDownloadFile): number {
  return Math.min(1, Math.max(0, file.progress ?? 0));
}

export function formatFileProgressLabel(file: TorrentDownloadFile): string {
  const progress = getFileProgress(file);
  if (progress >= 0.999) {
    return 'Готово';
  }
  if (progress <= 0) {
    return 'Ожидает';
  }
  return `${Math.round(progress * 100)}%`;
}
