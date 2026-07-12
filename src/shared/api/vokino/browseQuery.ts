import { resolveVokinoUrl } from '@/shared/config/api';
import type { VokinoCategory } from '@/shared/api/vokino/types';
import type { BrowseTab } from '@/shared/api/vokino/browse';

export const BROWSE_SORTS = ['updatings', 'new', 'popular', 'rating'] as const;

export type BrowseSort = (typeof BROWSE_SORTS)[number];

export type BrowseFilterKey = 'year' | 'genre' | 'country' | 'rating';

export interface BrowseFilters {
  year?: number;
  genre?: string[];
  country?: string;
  rating?: number;
}

export interface BrowseListQuery extends BrowseFilters {
  type: string;
  sort: BrowseSort;
}

export interface BrowseScope {
  type: string;
  sort: BrowseSort;
  categoryKey: string;
  tabKey: string;
}

const DEFAULT_SORT: BrowseSort = 'popular';

function parseUrl(rawUrl: string): URL {
  return new URL(rawUrl.startsWith('http') ? rawUrl : resolveVokinoUrl(rawUrl));
}

export function normalizeBrowseSort(value: string | null | undefined): BrowseSort | null {
  if (value === 'updatings' || value === 'new' || value === 'popular' || value === 'rating') {
    return value;
  }

  return null;
}

export function extractBrowseType(category: VokinoCategory): string | null {
  const type = parseUrl(category.playlist_url).searchParams.get('type');
  return type && type.length > 0 ? type : null;
}

export function extractBrowseSort(tab: BrowseTab): BrowseSort {
  return normalizeBrowseSort(parseUrl(tab.playlistUrl).searchParams.get('sort')) ?? DEFAULT_SORT;
}

export function buildBrowseScope(
  category: VokinoCategory,
  tab: BrowseTab | null,
): BrowseScope | null {
  const type = extractBrowseType(category);
  if (!type || !tab) {
    return null;
  }

  return {
    type,
    sort: extractBrowseSort(tab),
    categoryKey: category.playlist_url,
    tabKey: tab.id,
  };
}

export function buildBrowseScopeKey(scope: BrowseScope): string {
  return `${scope.type}::${scope.sort}`;
}

export function buildBrowseFiltersKey(scope: BrowseScope): string {
  return scope.type;
}

export function buildBrowseListQuery(scope: BrowseScope, filters: BrowseFilters = {}): BrowseListQuery {
  return {
    type: scope.type,
    sort: scope.sort,
    ...pickActiveFilters(filters),
  };
}

export function normalizeBrowseGenres(value: string[] | string | null | undefined): string[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  const seen = new Set<string>();
  const next: string[] = [];

  for (const item of items) {
    const genre = item.trim();
    if (!genre || seen.has(genre)) {
      continue;
    }

    seen.add(genre);
    next.push(genre);
  }

  return next;
}

export function pickActiveFilters(filters: BrowseFilters): BrowseFilters {
  const next: BrowseFilters = {};

  if (typeof filters.year === 'number' && Number.isFinite(filters.year)) {
    next.year = filters.year;
  }

  const genres = normalizeBrowseGenres(filters.genre);
  if (genres.length > 0) {
    next.genre = genres;
  }

  if (typeof filters.country === 'string' && filters.country.trim().length > 0) {
    next.country = filters.country.trim();
  }

  if (typeof filters.rating === 'number' && Number.isFinite(filters.rating)) {
    next.rating = filters.rating;
  }

  return next;
}

export function countActiveBrowseFilters(filters: BrowseFilters): number {
  const active = pickActiveFilters(filters);
  let count = 0;

  if (active.year !== undefined) {
    count += 1;
  }

  if (active.genre?.length) {
    count += active.genre.length;
  }

  if (active.country) {
    count += 1;
  }

  if (active.rating !== undefined) {
    count += 1;
  }

  return count;
}

export function buildBrowseListUrl(query: BrowseListQuery, page = 1): string {
  const params = new URLSearchParams();

  params.set('sort', query.sort);
  params.set('type', query.type);

  if (query.year !== undefined) {
    params.set('year', String(query.year));
  }

  if (query.genre?.length) {
    params.set('genre', query.genre.join(','));
  }

  if (query.country) {
    params.set('country', query.country);
  }

  if (query.rating !== undefined) {
    params.set('rating', String(query.rating));
  }

  if (page > 1) {
    params.set('page', String(page));
  }

  return resolveVokinoUrl(`/list?${params.toString()}`);
}

export function buildBrowseListUrlFromContext(
  category: VokinoCategory,
  tab: BrowseTab | null,
  filters: BrowseFilters = {},
  page = 1,
): string | null {
  const scope = buildBrowseScope(category, tab);
  if (!scope) {
    return null;
  }

  return buildBrowseListUrl(buildBrowseListQuery(scope, filters), page);
}

export function mergeBrowseFilters(
  current: BrowseFilters,
  patch: Partial<BrowseFilters>,
): BrowseFilters {
  const next: BrowseFilters = { ...current };

  for (const key of ['year', 'genre', 'country', 'rating'] as const) {
    if (!(key in patch)) {
      continue;
    }

    const value = patch[key];

    if (value === undefined || value === null || value === '') {
      delete next[key];
      continue;
    }

    if (key === 'genre') {
      const genres = normalizeBrowseGenres(Array.isArray(value) ? value : String(value));
      if (genres.length === 0) {
        delete next.genre;
      } else {
        next.genre = genres;
      }
      continue;
    }

    if (key === 'year' || key === 'rating') {
      if (typeof value === 'number') {
        next[key] = value;
      }
      continue;
    }

    if (typeof value === 'string') {
      next[key] = value;
    }
  }

  return pickActiveFilters(next);
}

export function isSameBrowseScope(a: BrowseScope | null, b: BrowseScope | null): boolean {
  if (!a || !b) {
    return false;
  }

  return a.type === b.type && a.sort === b.sort;
}
