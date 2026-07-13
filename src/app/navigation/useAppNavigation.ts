import { useCallback, useState } from 'react';
import type { NavItem } from '@/types';
import type { BrowseNavigationTarget } from '@/app/navigation/browseTarget';

export function useAppNavigation() {
  const [activeNav, setActiveNav] = useState<NavItem>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [browseTarget, setBrowseTarget] = useState<BrowseNavigationTarget | null>(null);

  const navigate = useCallback((nav: NavItem) => {
    setActiveNav(nav);
    setBrowseTarget(null);
    if (nav !== 'search') {
      setSearchQuery('');
    }
  }, []);

  const openBrowse = useCallback((target: BrowseNavigationTarget) => {
    setBrowseTarget(target);
    setActiveNav('browse');
    setSearchQuery('');
  }, []);

  const clearBrowseTarget = useCallback(() => {
    setBrowseTarget(null);
  }, []);

  return {
    activeNav,
    searchQuery,
    setSearchQuery,
    navigate,
    openBrowse,
    browseTarget,
    clearBrowseTarget,
  };
}
