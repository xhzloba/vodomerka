import type { MediaItem } from '@/shared/domain/media';
import type { CompilationFilters } from './types';

function compareRatings(
  left: MediaItem,
  right: MediaItem,
  direction: 'asc' | 'desc',
): number {
  const leftRating = left.rating;
  const rightRating = right.rating;

  if (leftRating == null && rightRating == null) {
    return 0;
  }

  if (leftRating == null) {
    return 1;
  }

  if (rightRating == null) {
    return -1;
  }

  return direction === 'asc' ? leftRating - rightRating : rightRating - leftRating;
}

export function applyCompilationFilters(
  items: MediaItem[],
  filters: CompilationFilters,
): MediaItem[] {
  let result = items;

  if (filters.year !== undefined) {
    result = result.filter((item) => item.year === filters.year);
  }

  if (filters.ratingSort === 'default') {
    return result;
  }

  const direction = filters.ratingSort;
  return [...result].sort((left, right) => compareRatings(left, right, direction));
}
