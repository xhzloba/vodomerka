import type { MediaItem } from '@/shared/domain/media';

const REQUIRED_COMPILATION_YEARS = [2024, 2025, 2026] as const;

export function buildCompilationYearOptions(items: MediaItem[]) {
  const currentYear = new Date().getFullYear();
  const yearsSet = new Set<number>([currentYear, ...REQUIRED_COMPILATION_YEARS]);

  for (const item of items) {
    if (typeof item.year === 'number' && Number.isFinite(item.year)) {
      yearsSet.add(item.year);
    }
  }

  return [...yearsSet]
    .sort((left, right) => right - left)
    .map((year) => ({ id: String(year), label: String(year) }));
}
