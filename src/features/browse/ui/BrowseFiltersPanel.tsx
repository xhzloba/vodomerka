import { useMemo } from 'react';
import { Combobox, type ComboboxOption } from '@/shared/ui/Combobox';
import { CloseIcon } from '@/shared/ui/icons';
import type { BrowseFilterFieldDefinition } from '../model/types';
import type { BrowseFilters } from '@/shared/api/vokino/browseQuery';
import '@/components/SettingsView/SettingsView.css';
import './BrowseFiltersPanel.css';

type BrowseFiltersPanelProps = {
  fields: BrowseFilterFieldDefinition[];
  filters: BrowseFilters;
  contextLabel: string;
  onChange: (patch: Partial<BrowseFilters>) => void;
  onReset: () => void;
};

function toComboboxOptions(options: BrowseFilterFieldDefinition['options']): ComboboxOption[] {
  return options.map((option) => ({ id: option.value, label: option.label }));
}

export function BrowseFiltersPanel({
  fields,
  filters,
  contextLabel,
  onChange,
  onReset,
}: BrowseFiltersPanelProps) {
  const genreField = fields.find((field) => field.id === 'genre');
  const countryField = fields.find((field) => field.id === 'country');
  const yearField = fields.find((field) => field.id === 'year');
  const ratingField = fields.find((field) => field.id === 'rating');
  const selectedGenres = filters.genre ?? [];

  const activeItems = useMemo(() => {
    const result: { key: string; label: string; patch: Partial<BrowseFilters> }[] = [];
    const genres = filters.genre ?? [];

    if (filters.country) {
      result.push({ key: 'country', label: filters.country, patch: { country: undefined } });
    }
    if (filters.year !== undefined) {
      result.push({ key: 'year', label: String(filters.year), patch: { year: undefined } });
    }
    if (filters.rating !== undefined) {
      result.push({ key: 'rating', label: `${filters.rating}+`, patch: { rating: undefined } });
    }
    for (const genre of genres) {
      result.push({
        key: `genre-${genre}`,
        label: genre,
        patch: { genre: genres.filter((g) => g !== genre) },
      });
    }
    return result;
  }, [filters]);

  const hasActive = activeItems.length > 0;

  const toggleGenre = (genre: string) => {
    if (genre === '__all__') {
      onChange({ genre: [] });
      return;
    }

    const next = selectedGenres.includes(genre)
      ? selectedGenres.filter((item) => item !== genre)
      : [...selectedGenres, genre];
    onChange({ genre: next });
  };

  return (
    <div className="browse-filters-panels browse-filters-panels--menu">
      <section className="settings-panel" aria-labelledby="browse-filters-params-title">
        <div className="browse-filters-panels__head">
          <div className="settings-panel__intro">
            <h2 id="browse-filters-params-title" className="settings-panel__title">
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

        {countryField || yearField ? (
          <div className="settings-subgroup">
            <p className="settings-subgroup__label">Страна и год</p>
            <div className="browse-filters-panels__combobox-row">
              {countryField ? (
                <Combobox
                  size="sm"
                  options={toComboboxOptions(countryField.options)}
                  value={filters.country ?? null}
                  placeholder="Страна"
                  onChange={(country) => onChange({ country: country || undefined })}
                />
              ) : null}
              {yearField ? (
                <Combobox
                  size="sm"
                  options={toComboboxOptions(yearField.options)}
                  value={filters.year !== undefined ? String(filters.year) : null}
                  placeholder="Год"
                  onChange={(year) => onChange({ year: year ? Number(year) : undefined })}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {ratingField ? (
          <div className="settings-subgroup">
            <p className="settings-subgroup__label">Рейтинг</p>
            <div className="settings-mode-picker browse-filters-panels__rating-picker" role="group" aria-label="Рейтинг">
              {ratingField.options.map((option) => {
                const numericValue = Number(option.value);
                const isActive = filters.rating === numericValue;

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`settings-mode-picker__option${
                      isActive ? ' settings-mode-picker__option--active' : ''
                    }`}
                    aria-pressed={isActive}
                    onClick={() => onChange({ rating: isActive ? undefined : numericValue })}
                  >
                    <span className="settings-mode-picker__label">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      {genreField ? (
        <section className="settings-panel settings-panel--full" aria-labelledby="browse-filters-genres-title">
          <div className="settings-panel__intro">
            <h2 id="browse-filters-genres-title" className="settings-panel__title">
              Жанры
            </h2>
            <p className="settings-panel__description">Можно выбрать несколько жанров</p>
          </div>

          <div className="settings-mode-picker browse-filters-panels__genre-picker" role="group" aria-label="Жанры">
            <button
              type="button"
              className={`settings-mode-picker__option${
                selectedGenres.length === 0 ? ' settings-mode-picker__option--active' : ''
              }`}
              aria-pressed={selectedGenres.length === 0}
              onClick={() => toggleGenre('__all__')}
            >
              <span className="settings-mode-picker__label">Все</span>
            </button>
            {genreField.options.map((option) => {
              const isActive = selectedGenres.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`settings-mode-picker__option${
                    isActive ? ' settings-mode-picker__option--active' : ''
                  }`}
                  aria-pressed={isActive}
                  onClick={() => toggleGenre(option.value)}
                >
                  <span className="settings-mode-picker__label">{option.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
