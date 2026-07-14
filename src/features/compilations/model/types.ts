export type CompilationRatingSort = 'default' | 'asc' | 'desc';

export interface CompilationFilters {
  year?: number;
  ratingSort: CompilationRatingSort;
}

export const EMPTY_COMPILATION_FILTERS: CompilationFilters = {
  ratingSort: 'default',
};

export function countActiveCompilationFilters(filters: CompilationFilters): number {
  let count = 0;

  if (filters.year !== undefined) {
    count += 1;
  }

  if (filters.ratingSort !== 'default') {
    count += 1;
  }

  return count;
}
