import type { MediaItem } from '@/shared/domain/media';
import { mapChannelItem } from '@/shared/domain/media';
import { ensureMediaOverridesLoaded, hydrateMediaItems } from '@/shared/domain/overridesStore';
import { httpGet } from '@/shared/api/httpClient';
import {
  itemMatchesBrowseGenres,
  normalizeBrowseGenres,
} from '@/shared/api/vokino/browseQuery';
import type {
  VokinoCategory,
  VokinoCategoryResponse,
  VokinoListResponse,
} from '@/shared/api/vokino/types';

export interface BrowseTab {
  id: string;
  title: string;
  playlistUrl: string;
}

export interface PaginatedListResult {
  items: MediaItem[];
  nextUrl: string | null;
}

export const BROWSE_GENRE_AND_MIN_ITEMS = 24;
export const BROWSE_GENRE_AND_MAX_EXTRA_PAGES = 5;

export function filterBrowseItemsByGenres(
  items: MediaItem[],
  requiredGenres: string[] | undefined,
): MediaItem[] {
  const genres = normalizeBrowseGenres(requiredGenres);

  if (genres.length === 0) {
    return items;
  }

  return items.filter((item) => itemMatchesBrowseGenres(item.genres, genres));
}

async function fetchPaginatedListRaw(
  playlistUrl: string,
  pageUrl?: string | null,
): Promise<PaginatedListResult> {
  const requestUrl = pageUrl ?? withPage(playlistUrl, 1);
  const data = await httpGet<VokinoListResponse>(requestUrl);
  await ensureMediaOverridesLoaded();

  return {
    items: hydrateMediaItems(mapListItems(data)),
    nextUrl: data.page?.next ? normalizeUrl(data.page.next) : null,
  };
}

function normalizeUrl(url: string): string {
  return new URL(url).href;
}

function withPage(url: string, page = 1): string {
  const parsed = new URL(url);
  parsed.searchParams.set('page', String(page));
  return parsed.toString();
}

function mapListItems(data: VokinoListResponse): MediaItem[] {
  return (data.channels ?? [])
    .map(mapChannelItem)
    .filter((item): item is MediaItem => item !== null);
}

function isVokinoBrowseCategoryUrl(url: string): boolean {
  return /\/category(?:4k|\?)/i.test(url) || url.includes('/compilations/category');
}

export function normalizeBrowseCategory(category: VokinoCategory): VokinoCategory {
  if (category.is_category === 1 || !isVokinoBrowseCategoryUrl(category.playlist_url)) {
    return category;
  }

  return {
    ...category,
    is_category: 1,
  };
}

export function normalizeBrowseCategories(categories: VokinoCategory[]): VokinoCategory[] {
  return categories.map(normalizeBrowseCategory);
}

export function sortBrowseCategories(categories: VokinoCategory[]): VokinoCategory[] {
  const priority = (category: VokinoCategory): number => {
    if (category.playlist_url.includes('type=movie') && /^фильмы$/i.test(category.title)) {
      return 0;
    }

    if (category.playlist_url.includes('type=serial') && /^сериалы$/i.test(category.title)) {
      return 1;
    }

    if (category.playlist_url.includes('type=multfilm') && /^мультфильмы$/i.test(category.title)) {
      return 2;
    }

    if (category.playlist_url.includes('type=multserial') && /^мультсериалы$/i.test(category.title)) {
      return 3;
    }

    return 4;
  };

  return normalizeBrowseCategories(categories)
    .map((category, index) => ({ category, index }))
    .sort((a, b) => {
      const byPriority = priority(a.category) - priority(b.category);
      return byPriority !== 0 ? byPriority : a.index - b.index;
    })
    .map(({ category }) => category);
}

export function getDefaultBrowseCategory(categories: VokinoCategory[]): VokinoCategory | null {
  const sorted = sortBrowseCategories(categories);
  return sorted.find((category) => category.playlist_url.includes('type=movie')) ?? sorted[0] ?? null;
}

function buildBrowseTabId(tab: VokinoCategory): string {
  return `${normalizeUrl(tab.playlist_url)}::${tab.title.trim()}`;
}

function isExcludedBrowseTab(category: VokinoCategory): boolean {
  return /^60\s*fps$/i.test(category.title.trim());
}

function isBrowseTab(category: VokinoCategory): boolean {
  const url = category.playlist_url;
  return (
    url.includes('sort=updatings') ||
    url.includes('sort=new') ||
    url.includes('sort=popular') ||
    url.includes('sort=rating')
  );
}

function tabSortPriority(tab: BrowseTab): number {
  if (tab.playlistUrl.includes('sort=updatings')) {
    return 0;
  }

  if (tab.playlistUrl.includes('sort=new')) {
    return 1;
  }

  if (tab.playlistUrl.includes('sort=popular')) {
    return 2;
  }

  if (tab.playlistUrl.includes('sort=rating')) {
    return 3;
  }

  return 4;
}

export function pickBrowseTabs(tabs: VokinoCategory[]): BrowseTab[] {
  return tabs
    .filter(isBrowseTab)
    .filter((tab) => !isExcludedBrowseTab(tab))
    .map((tab) => ({
      id: buildBrowseTabId(tab),
      title: formatBrowseTabTitle(tab.title),
      playlistUrl: tab.playlist_url,
    }))
    .sort((a, b) => tabSortPriority(a) - tabSortPriority(b));
}

function formatBrowseTabTitle(title: string): string {
  if (/обнов/i.test(title)) {
    return 'Обновления';
  }

  if (/новин/i.test(title)) {
    return 'Новинки';
  }

  if (/популяр/i.test(title)) {
    return 'Популярные';
  }

  if (/лучш/i.test(title)) {
    return 'Лучшее';
  }

  return title;
}

export async function fetchBrowseTabs(category: VokinoCategory): Promise<BrowseTab[]> {
  const normalized = normalizeBrowseCategory(category);

  if (normalized.is_category !== 1) {
    return [];
  }

  const data = await httpGet<VokinoCategoryResponse>(normalized.playlist_url);
  return pickBrowseTabs(data.channels ?? []);
}

export async function fetchPaginatedList(
  playlistUrl: string,
  pageUrl?: string | null,
  options?: { requiredGenres?: string[]; prefetchForGenreAnd?: boolean },
): Promise<PaginatedListResult> {
  const requiredGenres = normalizeBrowseGenres(options?.requiredGenres);
  const shouldPrefetch = options?.prefetchForGenreAnd ?? requiredGenres.length > 1;

  if (!shouldPrefetch || pageUrl) {
    const result = await fetchPaginatedListRaw(playlistUrl, pageUrl);
    return {
      items: filterBrowseItemsByGenres(result.items, requiredGenres),
      nextUrl: result.nextUrl,
    };
  }

  let collectedItems: MediaItem[] = [];
  let nextUrl: string | null = null;
  let pagesFetched = 0;
  const maxPages = 1 + BROWSE_GENRE_AND_MAX_EXTRA_PAGES;

  while (pagesFetched < maxPages) {
    const result = await fetchPaginatedListRaw(playlistUrl, pagesFetched === 0 ? null : nextUrl);
    collectedItems = mergeUniqueItems(collectedItems, result.items);
    nextUrl = result.nextUrl;
    pagesFetched += 1;

    if (
      filterBrowseItemsByGenres(collectedItems, requiredGenres).length >= BROWSE_GENRE_AND_MIN_ITEMS ||
      !nextUrl
    ) {
      break;
    }
  }

  return {
    items: filterBrowseItemsByGenres(collectedItems, requiredGenres),
    nextUrl,
  };
}

export function mergeUniqueItems(current: MediaItem[], incoming: MediaItem[]): MediaItem[] {
  if (incoming.length === 0) {
    return current;
  }

  const seen = new Set(current.map((item) => item.id));
  const nextItems = incoming.filter((item) => !seen.has(item.id));

  return nextItems.length > 0 ? [...current, ...nextItems] : current;
}
