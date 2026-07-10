export type NavItem = 'home' | 'browse' | 'library' | 'watched' | 'search' | 'settings';

export interface AppState {
  activeNav: NavItem;
  selectedMovieId: string | null;
  searchQuery: string;
}
