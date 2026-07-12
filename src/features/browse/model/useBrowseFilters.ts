import { useCallback, useState } from 'react';
import {
  countActiveBrowseFilters,
  mergeBrowseFilters,
  pickActiveFilters,
  type BrowseFilters,
} from '@/shared/api/vokino/browseQuery';
import { EMPTY_BROWSE_FILTERS } from './types';

export function useBrowseFilters() {
  const [filters, setFiltersState] = useState<BrowseFilters>(EMPTY_BROWSE_FILTERS);

  const activeFilters = pickActiveFilters(filters);
  const activeCount = countActiveBrowseFilters(activeFilters);

  const setFilter = useCallback((patch: Partial<BrowseFilters>) => {
    setFiltersState((current) => mergeBrowseFilters(current, patch));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(EMPTY_BROWSE_FILTERS);
  }, []);

  return {
    filters: activeFilters,
    activeCount,
    setFilter,
    resetFilters,
  };
}
