export type NavItem =
  | 'home'
  | 'browse'
  | 'compilations'
  | 'library'
  | 'watched'
  | 'search'
  | 'settings';

export interface AppState {
  activeNav: NavItem;
  selectedMovieId: string | null;
  searchQuery: string;
}
