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

/** 1 серия / 2 серии / 5 серий */
function formatEpisodeWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return 'серия';
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return 'серии';
  }
  return 'серий';
}

export function formatEpisodeLabel(
  season: number | null,
  episode: number | null,
  fileName: string,
): string {
  if (episode != null) {
    return `${episode} ${formatEpisodeWord(episode)}`;
  }
  if (season != null) {
    return `Сезон ${season}`;
  }
  return fileName.replace(VIDEO_EXT, '');
}

/** «Пацаны · Сезон 1 · 2 серия» — same language as the episode picker. */
export function formatPlaybackTitle(mediaTitle: string, fileName?: string | null): string {
  const base = mediaTitle.trim() || 'Видео';
  if (!fileName) {
    return base;
  }
  const { season, episode } = parseEpisodeFromName(fileName);
  if (season == null && episode == null) {
    return base;
  }
  const parts = [base];
  if (season != null) {
    parts.push(`Сезон ${season}`);
  }
  if (episode != null) {
    parts.push(formatEpisodeLabel(season, episode, fileName));
  }
  return parts.join(' · ');
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

/** 0–100 with hundredths (1.05), not whole percents. */
export function getProgressPercent(progress01: number): number {
  const pct = Math.min(100, Math.max(0, progress01 * 100));
  if (pct >= 99.995) {
    return 100;
  }
  return Math.round(pct * 100) / 100;
}

export function formatProgressPercent(progress01: number): string {
  const pct = getProgressPercent(progress01);
  if (pct >= 100) {
    return '100';
  }
  return pct.toFixed(2);
}

export function getFileProgressPercent(file: TorrentDownloadFile): number {
  return getProgressPercent(getFileProgress(file));
}

export function formatFileProgressLabel(file: TorrentDownloadFile): string {
  const progress = getFileProgress(file);
  if (progress >= 0.999) {
    return 'Готово';
  }
  const percent = getFileProgressPercent(file);
  // Tiny piece-overlap crumbs stay as waiting.
  if (percent < 0.01) {
    return 'Ожидает';
  }
  return `${formatProgressPercent(progress)}%`;
}
