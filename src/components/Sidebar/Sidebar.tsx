import type { CSSProperties, PointerEvent } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { NavItem } from '@/types';
import type { SidebarMenuAnimation } from '@/shared/settings/types';
import { getSearchShortcutLabel } from '@/features/onboarding/tips/platformShortcut';
import { playMenuSound, playSubmenuSound } from '@/shared/audio/uiSounds';
import { useFavorites } from '@/shared/domain/FavoritesContext';
import {
  BookOpenIcon,
  EyeIcon,
  FavoritesIcon,
  GridIcon,
  HomeIcon,
  CoverSpacingIcon,
  SearchIcon,
  SettingsIcon,
} from '@/shared/ui/icons';
import './Sidebar.css';

interface SidebarItemSettingsAction {
  ariaLabel: string;
  onClick: () => void;
  icon?: 'settings' | 'cover-spacing';
}

interface SidebarProps {
  activeNav: NavItem;
  collapsed: boolean;
  menuAnimation?: SidebarMenuAnimation;
  macSidebarChrome?: boolean;
  onNavChange: (nav: NavItem) => void;
  itemSettingsActions?: Partial<Record<NavItem, SidebarItemSettingsAction>>;
}

const navItems: { id: NavItem; label: string; icon: JSX.Element }[] = [
  { id: 'home', label: 'Главная', icon: <HomeIcon size={24} /> },
  { id: 'browse', label: 'Каталог', icon: <GridIcon size={24} /> },
  { id: 'compilations', label: 'Подборки', icon: <BookOpenIcon size={24} /> },
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
  itemSettingsActions,
}: SidebarProps) {
  const navRef = useRef<HTMLElement>(null);
  const { favorites } = useFavorites();
  const favoritesCount = favorites.length;
  const searchShortcutLabel = getSearchShortcutLabel();
  const [magneticIndicator, setMagneticIndicator] = useState<{
    y: number;
    height: number;
    ready: boolean;
  }>({
    y: 0,
    height: 0,
    ready: false,
  });

  const magneticEnabled =
    (menuAnimation === 'magnetic' || menuAnimation === 'magnetic-water') && !collapsed;

  const syncMagneticIndicator = useCallback(() => {
    if (!magneticEnabled) {
      setMagneticIndicator((state) => (state.ready ? { ...state, ready: false } : state));
      return;
    }

    const nav = navRef.current;
    const surface = nav?.querySelector<HTMLElement>('.sidebar__item--active .sidebar__item-surface');

    if (!nav || !surface) {
      setMagneticIndicator((state) => (state.ready ? { ...state, ready: false } : state));
      return;
    }

    const navRect = nav.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();

    setMagneticIndicator({
      y: surfaceRect.top - navRect.top + nav.scrollTop,
      height: surfaceRect.height,
      ready: true,
    });
  }, [collapsed, magneticEnabled]);

  useLayoutEffect(() => {
    syncMagneticIndicator();
  }, [activeNav, collapsed, favoritesCount, magneticEnabled, syncMagneticIndicator]);

  useEffect(() => {
    if (!magneticEnabled) {
      return;
    }

    const nav = navRef.current;
    if (!nav) {
      return;
    }

    const resizeObserver = new ResizeObserver(syncMagneticIndicator);
    resizeObserver.observe(nav);
    window.addEventListener('resize', syncMagneticIndicator);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', syncMagneticIndicator);
    };
  }, [collapsed, magneticEnabled, syncMagneticIndicator]);

  const handleNavPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>, nav: NavItem) => {
      if (event.button !== 0 || activeNav === nav) {
        return;
      }

      playMenuSound();
    },
    [activeNav],
  );

  const handleNavClick = useCallback(
    (nav: NavItem) => {
      onNavChange(nav);
    },
    [onNavChange],
  );

  const magneticIndicatorStyle = magneticIndicator.ready
    ? ({
        transform: `translateY(${magneticIndicator.y}px)`,
        height: `${magneticIndicator.height}px`,
      } as CSSProperties)
    : undefined;

  return (
    <aside
      className={`sidebar sidebar--menu-${menuAnimation}${collapsed ? ' sidebar--collapsed' : ''}${
        macSidebarChrome ? ' sidebar--mac-chrome' : ''
      }`}
    >
      <div className="sidebar__panel">
        {macSidebarChrome ? <div className="sidebar__chrome" aria-hidden="true" /> : null}
        <nav ref={navRef} className="sidebar__nav">
          {magneticEnabled && magneticIndicator.ready ? (
            <span
              className="sidebar__magnetic-indicator"
              aria-hidden="true"
              style={magneticIndicatorStyle}
            />
          ) : null}
          {navItems.map((item) => {
            const isActive = activeNav === item.id;
            const settingsAction = itemSettingsActions?.[item.id];
            const showItemSettings = isActive && !collapsed && settingsAction;

            const itemButton = (
              <button
                type="button"
                className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}${
                  showItemSettings ? ' sidebar__item--with-action' : ''
                }`}
                onPointerDown={(event) => handleNavPointerDown(event, item.id)}
                onClick={() => handleNavClick(item.id)}
                aria-label={
                  item.id === 'library' && favoritesCount > 0
                    ? `${item.label}, ${favoritesCount} в избранном`
                    : item.label
                }
                title={collapsed ? item.label : undefined}
              >
                <span className="sidebar__item-surface">
                  {menuAnimation === 'liquid' && isActive && !collapsed ? (
                    <>
                      <span
                        key={`liquid-glow-${activeNav}`}
                        className="sidebar__liquid-glow"
                        aria-hidden="true"
                      />
                      <span
                        key={`liquid-bubbles-${activeNav}`}
                        className="sidebar__liquid-bubbles"
                        aria-hidden="true"
                      />
                    </>
                  ) : null}
                  {menuAnimation === 'snake' && isActive && !collapsed ? (
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
            );

            const SettingsActionIcon =
              settingsAction?.icon === 'cover-spacing' ? CoverSpacingIcon : SettingsIcon;

            if (!showItemSettings) {
              return <div key={item.id}>{itemButton}</div>;
            }

            return (
              <div key={item.id} className="sidebar__item-wrap sidebar__item-wrap--with-action">
                {itemButton}
                <button
                  type="button"
                  className="sidebar__item-action"
                  aria-label={settingsAction.ariaLabel}
                  onPointerDown={(event) => {
                    if (event.button === 0) {
                      playSubmenuSound();
                    }
                  }}
                  onClick={settingsAction.onClick}
                >
                  <SettingsActionIcon size={18} strokeWidth={1.75} />
                </button>
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
