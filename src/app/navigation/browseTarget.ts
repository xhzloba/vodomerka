export type BrowseTabMarker = 'top250';

export interface BrowseNavigationTarget {
  categoryType: string;
  tabMarker?: BrowseTabMarker;
}

export const BROWSE_MOVIES_TOP250_TARGET: BrowseNavigationTarget = {
  categoryType: 'movie',
  tabMarker: 'top250',
};
