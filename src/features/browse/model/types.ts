import type { BrowseFilterKey, BrowseFilters } from '@/shared/api/vokino/browseQuery';

export interface BrowseFilterOption {
  value: string;
  label: string;
}

export interface BrowseFilterFieldDefinition {
  id: BrowseFilterKey;
  label: string;
  placeholder: string;
  kind: 'select' | 'rating' | 'chips';
  options: BrowseFilterOption[];
}

export interface BrowseFilterOptionsResponse {
  genres: BrowseFilterOption[];
  countries: BrowseFilterOption[];
  years: BrowseFilterOption[];
  ratings: BrowseFilterOption[];
}

export const EMPTY_BROWSE_FILTERS: BrowseFilters = {};
