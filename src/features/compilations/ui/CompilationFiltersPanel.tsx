import { useCallback, useMemo, useState } from 'react';
import { Combobox } from '@/shared/ui/Combobox';
import { CloseIcon } from '@/shared/ui/icons';
import { buildCompilationYearOptions } from '@/features/compilations/model/buildCompilationYearOptions';
import {
  countActiveCompilationFilters,
  EMPTY_COMPILATION_FILTERS,
  type CompilationFilters,
  type CompilationRatingSort,
} from '@/features/compilations/model/types';
import type { MediaItem } from '@/shared/domain/media';
import '@/components/SettingsView/SettingsView.css';
import '@/features/browse/ui/BrowseFiltersPanel.css';

const RATING_SORT_OPTIONS: { value: CompilationRatingSort; label: string }[] = [
  { value: 'default', label: 'Все' },
  { value: 'asc', label: 'По возрастанию' },
  { value: 'desc', label: 'По убыванию' },
];

type CompilationFiltersPanelProps = {
  items: MediaItem[];
  filters: CompilationFilters;
  contextLabel: string;
  onChange: (patch: Partial<CompilationFilters>) => void;
  onReset: () => void;
};

export function CompilationFiltersPanel({
  items,
  filters,
  contextLabel,
  onChange,
  onReset,
}: CompilationFiltersPanelProps) {
  const yearOptions = useMemo(() => buildCompilationYearOptions(items), [items]);

  const activeItems = useMemo(() => {
    const result: { key: string; label: string; patch: Partial<CompilationFilters> }[] = [];

    if (filters.year !== undefined) {
      result.push({ key: 'year', label: String(filters.year), patch: { year: undefined } });
    }

    if (filters.ratingSort !== 'default') {
      const label =
        RATING_SORT_OPTIONS.find((option) => option.value === filters.ratingSort)?.label ??
        filters.ratingSort;
      result.push({ key: 'ratingSort', label, patch: { ratingSort: 'default' } });
    }

    return result;
  }, [filters]);

  const hasActive = activeItems.length > 0;

  return (
    <div className="browse-filters-panels browse-filters-panels--menu">
      <section className="settings-panel" aria-labelledby="compilation-filters-params-title">
        <div className="browse-filters-panels__head">
          <div className="settings-panel__intro">
            <h2 id="compilation-filters-params-title" className="settings-panel__title">
              Параметры
            </h2>
            <p className="settings-panel__description">{contextLabel}</p>
          </div>
          {hasActive ? (
            <button type="button" className="settings-reset-btn" onClick={onReset}>
              Сбросить
            </button>
          ) : null}
        </div>

        {hasActive ? (
          <ul className="browse-filters-panels__active">
            {activeItems.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  className="browse-filters-panels__active-chip"
                  onClick={() => onChange(item.patch)}
                  aria-label={`Убрать фильтр ${item.label}`}
                >
                  <span>{item.label}</span>
                  <CloseIcon size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="settings-subgroup">
          <p className="settings-subgroup__label">Год</p>
          <div className="browse-filters-panels__combobox-row">
            <Combobox
              size="sm"
              options={yearOptions}
              value={filters.year !== undefined ? String(filters.year) : null}
              placeholder="Любой год"
              onChange={(year) => onChange({ year: year ? Number(year) : undefined })}
            />
          </div>
        </div>

        <div className="settings-subgroup">
          <p className="settings-subgroup__label">Рейтинг</p>
          <div
            className="settings-mode-picker browse-filters-panels__sort-picker"
            role="group"
            aria-label="Сортировка по рейтингу"
          >
            {RATING_SORT_OPTIONS.map((option) => {
              const isActive = filters.ratingSort === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`settings-mode-picker__option${
                    isActive ? ' settings-mode-picker__option--active' : ''
                  }`}
                  aria-pressed={isActive}
                  onClick={() => onChange({ ratingSort: option.value })}
                >
                  <span className="settings-mode-picker__label">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

export function useCompilationFilters() {
  const [filters, setFiltersState] = useState<CompilationFilters>(EMPTY_COMPILATION_FILTERS);
  const activeCount = countActiveCompilationFilters(filters);

  const setFilter = useCallback((patch: Partial<CompilationFilters>) => {
    setFiltersState((current) => ({ ...current, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(EMPTY_COMPILATION_FILTERS);
  }, []);

  return {
    filters,
    activeCount,
    setFilter,
    resetFilters,
  };
}
