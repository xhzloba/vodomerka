/** Canonical Vokino / app media types used in filters & collection rows. */
export const CANONICAL_MEDIA_TYPES = [
  'movie',
  'serial',
  'multfilm',
  'multserial',
  'anime',
] as const;

export type CanonicalMediaType = (typeof CANONICAL_MEDIA_TYPES)[number];

const CANONICAL_SET = new Set<string>(CANONICAL_MEDIA_TYPES);

/** Map Vokino aliases / noisy labels onto canonical types. */
const TYPE_ALIASES: Record<string, CanonicalMediaType> = {
  movie: 'movie',
  film: 'movie',
  documovie: 'movie',
  documentary: 'movie',
  serial: 'serial',
  series: 'serial',
  tvshow: 'serial',
  tv_show: 'serial',
  'tv-show': 'serial',
  show: 'serial',
  docuserial: 'serial',
  docuseries: 'serial',
  multfilm: 'multfilm',
  cartoon: 'multfilm',
  multserial: 'multserial',
  anime: 'anime',
};

export function normalizeMediaType(value: unknown): CanonicalMediaType | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const raw = value.trim().toLowerCase();
  if (!raw) {
    return undefined;
  }

  const aliased = TYPE_ALIASES[raw];
  if (aliased) {
    return aliased;
  }

  if (CANONICAL_SET.has(raw)) {
    return raw as CanonicalMediaType;
  }

  // e.g. "tv_serial", "mini-serial", Cyrillic labels
  if (/serial|сериал|tvshow|tv.?show/.test(raw)) {
    return 'serial';
  }
  if (/multserial|мультсериал/.test(raw)) {
    return 'multserial';
  }
  if (/multfilm|мультфильм|cartoon/.test(raw)) {
    return 'multfilm';
  }
  if (/anime|аниме/.test(raw)) {
    return 'anime';
  }
  if (/movie|film|фильм|documovie/.test(raw)) {
    return 'movie';
  }

  return undefined;
}

/** Resolve type from Vokino details, using is_tv as a last resort. */
export function resolveMediaTypeFromDetails(
  type: unknown,
  isTv?: boolean | null,
): CanonicalMediaType | undefined {
  return normalizeMediaType(type) ?? (isTv ? 'serial' : undefined);
}

export function isMovieMediaType(type: unknown): boolean {
  const normalized = normalizeMediaType(type);
  return normalized === 'movie' || normalized === 'multfilm';
}

export function isSerialMediaType(type: unknown): boolean {
  const normalized = normalizeMediaType(type);
  return (
    normalized === 'serial' || normalized === 'multserial' || normalized === 'anime'
  );
}

/** Coerce a stored/API type for persistence — never leave blank. */
export function coerceStoredMediaType(type: unknown, fallback: CanonicalMediaType = 'movie'): string {
  return normalizeMediaType(type) ?? (typeof type === 'string' && type.trim() ? type.trim() : fallback);
}
