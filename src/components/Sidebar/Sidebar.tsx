import type { NavItem } from '@/types';
import type { SidebarMenuAnimation } from '@/shared/settings/types';
import { getSearchShortcutLabel } from '@/features/onboarding/tips/platformShortcut';
import { useFavorites } from '@/shared/domain/FavoritesContext';
import {
  EyeIcon,
  FavoritesIcon,
  GridIcon,
  HomeIcon,
  SearchIcon,
  SettingsIcon,
} from '@/shared/ui/icons';
import './Sidebar.css';

interface SidebarProps {
  activeNav: NavItem;
  collapsed: boolean;
  menuAnimation?: SidebarMenuAnimation;
  macSidebarChrome?: boolean;
  onNavChange: (nav: NavItem) => void;
}

const navItems: { id: NavItem; label: string; icon: JSX.Element }[] = [
  { id: 'home', label: 'Главная', icon: <HomeIcon size={24} /> },
  { id: 'browse', label: 'Каталог', icon: <GridIcon size={24} /> },
  { id: 'library', label: 'Избранное', icon: <FavoritesIcon size={24} /> },
  { id: 'watched', label: 'Просмотренное', icon: <EyeIcon size={24} /> },
  { id: 'search', label: 'Поиск', icon: <SearchIcon size={24} /> },
  { id: 'settings', label: 'Настройки', icon: <SettingsIcon size={24} /> },
];

export function Sidebar({
  activeNav,
  collapsed,
  menuAnimation = 'liquid',
  macSidebarChrome = false,
  onNavChange,
}: SidebarProps) {
  const { favorites } = useFavorites();
  const favoritesCount = favorites.length;
  const searchShortcutLabel = getSearchShortcutLabel();

  return (
    <aside
      className={`sidebar sidebar--menu-${menuAnimation}${collapsed ? ' sidebar--collapsed' : ''}${
        macSidebarChrome ? ' sidebar--mac-chrome' : ''
      }`}
    >
      <div className="sidebar__panel">
        {macSidebarChrome ? <div className="sidebar__chrome" aria-hidden="true" /> : null}
        <nav className="sidebar__nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar__item ${activeNav === item.id ? 'sidebar__item--active' : ''}`}
              onClick={() => onNavChange(item.id)}
              aria-label={
                item.id === 'library' && favoritesCount > 0
                  ? `${item.label}, ${favoritesCount} в избранном`
                  : item.label
              }
              title={collapsed ? item.label : undefined}
            >
              <span className="sidebar__item-surface">
                {menuAnimation === 'snake' && activeNav === item.id && !collapsed ? (
                  <span className="sidebar__snake-ring" aria-hidden="true">
                    <span className="sidebar__snake-beam sidebar__snake-beam--trail" />
                    <span className="sidebar__snake-beam sidebar__snake-beam--core" />
                  </span>
                ) : null}
                <span className="sidebar__item-icon">{item.icon}</span>
                <span className="sidebar__item-label">{item.label}</span>
                {item.id === 'library' && favoritesCount > 0 ? (
                  <span className="sidebar__item-badge" aria-hidden="true">
                    {favoritesCount}
                  </span>
                ) : null}
                {item.id === 'search' && !collapsed ? (
                  <span className="sidebar__item-shortcut" aria-hidden="true">
                    {searchShortcutLabel}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
