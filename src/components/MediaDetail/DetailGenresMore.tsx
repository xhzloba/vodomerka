import { useEffect, useId, useRef, useState } from 'react';

export function DetailGenresMore({ genres }: { genres: string[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (genres.length === 0) {
    return null;
  }

  return (
    <div className="mdw-genres-more" ref={rootRef}>
      <button
        type="button"
        className={`mdw-chip mdw-chip--more${open ? ' mdw-chip--more-open' : ''}`}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((value) => !value)}
      >
        +{genres.length}
      </button>
      {open ? (
        <div
          id={popoverId}
          className="mdw-genres-popover"
          role="dialog"
          aria-label="Остальные жанры"
        >
          <ul className="mdw-genres-popover__list">
            {genres.map((genre) => (
              <li key={genre}>{genre}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
