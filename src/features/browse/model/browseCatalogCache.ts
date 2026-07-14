import type { MediaItem } from '@/shared/domain/media';
import type { BrowseTab } from '@/shared/api/vokino/browse';
import type { VokinoCategory } from '@/shared/api/vokino/types';

export interface BrowseCatalogCache {
  categories: VokinoCategory[];
  category: VokinoCategory;
  tabs: BrowseTab[];
  activeTab: BrowseTab | null;
  items: MediaItem[];
  nextPageUrl: string | null;
}

let browseCatalogCache: BrowseCatalogCache | null = null;

export function getBrowseCatalogCache(): BrowseCatalogCache | null {
  return browseCatalogCache;
}

export function setBrowseCatalogCache(cache: BrowseCatalogCache | null): void {
  browseCatalogCache = cache;
}

export function clearBrowseCatalogCache(): void {
  browseCatalogCache = null;
}
