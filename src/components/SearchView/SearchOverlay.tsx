import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { MediaItem } from '@/shared/domain/media';
import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import { SearchPanel } from './SearchPanel';
import './SearchOverlay.css';

interface SearchOverlayProps {
  open: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  onMediaSelect: (item: MediaItem) => void;
  onClose: () => void;
}

export function SearchOverlay({
  open,
  query,
  onQueryChange,
  onMediaSelect,
  onClose,
}: SearchOverlayProps) {
  const scrollRef = useOverlayScroll<HTMLDivElement>();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleMediaSelect = (item: MediaItem) => {
    onClose();
    onMediaSelect(item);
  };

  return createPortal(
    <div className="search-overlay" role="presentation">
      <button
        type="button"
        className="search-overlay__backdrop"
        aria-label="Закрыть поиск"
        onClick={onClose}
      />

      <div
        className="search-overlay__panel scroll-overlay"
        ref={scrollRef}
        role="dialog"
        aria-modal="true"
        aria-label="Быстрый поиск"
      >
        <SearchPanel
          query={query}
          onQueryChange={onQueryChange}
          onMediaSelect={handleMediaSelect}
          autoFocus
          variant="overlay"
          inputId="search-overlay-input"
        />
      </div>
    </div>,
    document.body,
  );
}
