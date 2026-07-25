export type NavItem =
  | 'home'
  | 'browse'
  | 'compilations'
  | 'library'
  | 'search'
  | 'plugins'
  | 'settings';

export interface AppState {
  activeNav: NavItem;
  selectedMovieId: string | null;
  searchQuery: string;
}
