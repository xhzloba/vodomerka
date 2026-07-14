import { useCallback, useState } from 'react';
import type { NavItem } from '@/types';
import type { BrowseNavigationTarget } from '@/app/navigation/browseTarget';
import type { CompilationNavigationTarget } from '@/app/navigation/compilationTarget';

export function useAppNavigation() {
  const [activeNav, setActiveNav] = useState<NavItem>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [browseTarget, setBrowseTarget] = useState<BrowseNavigationTarget | null>(null);
  const [compilationTarget, setCompilationTarget] = useState<CompilationNavigationTarget | null>(null);

  const navigate = useCallback((nav: NavItem) => {
    setActiveNav(nav);
    setBrowseTarget(null);
    setCompilationTarget(null);
    if (nav !== 'search') {
      setSearchQuery('');
    }
  }, []);

  const openBrowse = useCallback((target: BrowseNavigationTarget) => {
    setBrowseTarget(target);
    setCompilationTarget(null);
    setActiveNav('browse');
    setSearchQuery('');
  }, []);

  const openCompilation = useCallback((target: CompilationNavigationTarget) => {
    setCompilationTarget(target);
    setBrowseTarget(null);
    setActiveNav('compilations');
    setSearchQuery('');
  }, []);

  const clearBrowseTarget = useCallback(() => {
    setBrowseTarget(null);
  }, []);

  const clearCompilationTarget = useCallback(() => {
    setCompilationTarget(null);
  }, []);

  return {
    activeNav,
    searchQuery,
    setSearchQuery,
    navigate,
    openBrowse,
    openCompilation,
    browseTarget,
    compilationTarget,
    clearBrowseTarget,
    clearCompilationTarget,
  };
}
