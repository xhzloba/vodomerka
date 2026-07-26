const VIDEO_EXT = /\.(mkv|mp4|avi|mov|wmv|m4v|webm|ts)$/i;

const EPISODE_PATTERNS: RegExp[] = [
  /[Ss](\d{1,2})[ ._-]*[Ee](\d{1,3})/,
  /(\d{1,2})x(\d{1,3})\b/,
  /[Ss]eason[ ._-]*(\d{1,2}).*?[Ee]p(?:isode)?[ ._-]*(\d{1,3})/i,
  /сезон[ ._-]*(\d{1,2}).*?сери[яи][ ._-]*(\d{1,3})/i,
];

export function isVideoFileName(name: string): boolean {
  return VIDEO_EXT.test(name) && !/\b(sample|trailer|promo)\b/i.test(name);
}

export function parseEpisodeFromName(name: string): {
  season: number | null;
  episode: number | null;
} {
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

/** Season → episode order (S01E01 before S01E02 before S02E01). Fallback: name. */
export function compareEpisodeNames(a: string, b: string): number {
  const ea = parseEpisodeFromName(a);
  const eb = parseEpisodeFromName(b);
  const aKey =
    ea.season != null && ea.episode != null ? ea.season * 1000 + ea.episode : null;
  const bKey =
    eb.season != null && eb.episode != null ? eb.season * 1000 + eb.episode : null;

  if (aKey != null && bKey != null && aKey !== bKey) {
    return aKey - bKey;
  }
  if (aKey != null && bKey == null) {
    return -1;
  }
  if (aKey == null && bKey != null) {
    return 1;
  }
  return a.localeCompare(b, 'ru', { numeric: true, sensitivity: 'base' });
}

export function sortVideoFilesByEpisode<T extends { name: string }>(files: T[]): T[] {
  return files.filter((file) => isVideoFileName(file.name)).sort((a, b) => compareEpisodeNames(a.name, b.name));
}

export function isFileDownloadComplete(file: {
  done?: boolean;
  progress?: number;
}): boolean {
  try {
    if (file.done) {
      return true;
    }
    return Math.min(1, Math.max(0, Number(file.progress) || 0)) >= 0.999;
  } catch {
    return false;
  }
}

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

/** «Пацаны · Сезон 1 · 2 серия» */
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
    parts.push(`${episode} ${formatEpisodeWord(episode)}`);
  }
  return parts.join(' · ');
}
