export type BrowseSidebarEntry = 'catalog' | 'mediateka';

export interface BrowseNavigationTarget {
  categoryType: string;
  /** Where the sidebar selection came from — Catalog vs Медиатека item. */
  entry?: BrowseSidebarEntry;
}
