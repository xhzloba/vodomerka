import { useEffect, useState } from 'react';
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
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [snakeVisible, setSnakeVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setHasStartedTyping(false);
      setSnakeVisible(false);
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setSnakeVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [open]);

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

  const hideSnake = hasStartedTyping;
  const showSnake = snakeVisible && !hideSnake;

  const handleQueryChange = (value: string) => {
    if (value.trim().length > 0) {
      setHasStartedTyping(true);
    }

    onQueryChange(value);
  };

  return createPortal(
    <div className="search-overlay" role="presentation">
      <button
        type="button"
        className="search-overlay__backdrop"
        aria-label="Закрыть поиск"
        onClick={onClose}
      />

      <div className="search-overlay__frame">
        <div
          className={`search-overlay__snake-ring${showSnake ? ' search-overlay__snake-ring--visible' : ''}${
            hideSnake ? ' search-overlay__snake-ring--hidden' : ''
          }`}
          aria-hidden="true"
        >
          <div className="search-overlay__snake-beam search-overlay__snake-beam--trail" />
          <div className="search-overlay__snake-beam search-overlay__snake-beam--core" />
        </div>

        <div
          className="search-overlay__panel scroll-overlay"
          ref={scrollRef}
          role="dialog"
          aria-modal="true"
          aria-label="Поиск"
        >
          <SearchPanel
            query={query}
            onQueryChange={handleQueryChange}
            onMediaSelect={handleMediaSelect}
            autoFocus
            variant="overlay"
            inputId="search-overlay-input"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
