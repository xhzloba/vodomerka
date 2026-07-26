type MediaTypeFilter = 'all' | 'movie' | 'serial';

const OPTIONS: Array<{ id: MediaTypeFilter; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'movie', label: 'Фильмы' },
  { id: 'serial', label: 'Сериалы' },
];

interface ContentRowTypeFilterProps {
  value: MediaTypeFilter;
  onChange: (value: MediaTypeFilter) => void;
  ariaLabel: string;
}

/** Lightweight segmented filter — no ResizeObserver / animated indicator. */
export function ContentRowTypeFilter({ value, onChange, ariaLabel }: ContentRowTypeFilterProps) {
  return (
    <div className="content-row__type-filter" role="radiogroup" aria-label={ariaLabel}>
      {OPTIONS.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`content-row__type-filter-btn${active ? ' content-row__type-filter-btn--active' : ''}`}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export type { MediaTypeFilter };
