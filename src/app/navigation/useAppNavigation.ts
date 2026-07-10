import { useCallback, useState } from 'react';
import type { NavItem } from '@/types';

export function useAppNavigation() {
  const [activeNav, setActiveNav] = useState<NavItem>('home');
  const [searchQuery, setSearchQuery] = useState('');

  const navigate = useCallback((nav: NavItem) => {
    setActiveNav(nav);
    if (nav !== 'search') {
      setSearchQuery('');
    }
  }, []);

  return {
    activeNav,
    searchQuery,
    setSearchQuery,
    navigate,
  };
}
