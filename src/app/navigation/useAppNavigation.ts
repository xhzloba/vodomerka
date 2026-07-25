import { useCallback, useState } from 'react';
import type { NavItem } from '@/types';
import type { BrowseNavigationTarget, BrowseSidebarEntry } from '@/app/navigation/browseTarget';
import type { CompilationNavigationTarget } from '@/app/navigation/compilationTarget';

export function useAppNavigation() {
  const [activeNav, setActiveNav] = useState<NavItem>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [browseTarget, setBrowseTarget] = useState<BrowseNavigationTarget | null>(null);
  const [browseCategoryType, setBrowseCategoryType] = useState<string | null>(null);
  const [browseSidebarEntry, setBrowseSidebarEntry] = useState<BrowseSidebarEntry | null>(null);
  const [compilationTarget, setCompilationTarget] = useState<CompilationNavigationTarget | null>(null);

  const navigate = useCallback((nav: NavItem) => {
    setActiveNav(nav);
    setBrowseTarget(null);
    setBrowseCategoryType(null);
    setBrowseSidebarEntry(null);
    setCompilationTarget(null);
    if (nav !== 'search') {
      setSearchQuery('');
    }
  }, []);

  const openBrowse = useCallback((target: BrowseNavigationTarget) => {
    setBrowseTarget(target);
    setBrowseCategoryType(target.categoryType);
    setBrowseSidebarEntry(target.entry ?? 'mediateka');
    setCompilationTarget(null);
    setActiveNav('browse');
    setSearchQuery('');
  }, []);

  const openCompilation = useCallback((target: CompilationNavigationTarget) => {
    setCompilationTarget(target);
    setBrowseTarget(null);
    setBrowseCategoryType(null);
    setBrowseSidebarEntry(null);
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
    browseCategoryType,
    browseSidebarEntry,
    compilationTarget,
    clearBrowseTarget,
    clearCompilationTarget,
  };
}
