import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { MediaItem } from '@/shared/domain/media';
import { MediaCard } from '@/components/MediaCard/MediaCard';
import { CloseIcon } from '@/shared/ui/icons';
import '@/shared/ui/MediaDescriptionDialog/MediaDescriptionDialog.css';
import './RelatedTitlesDialog.css';

interface RelatedTitlesDialogProps {
  open: boolean;
  title: string;
  items: MediaItem[];
  currentId?: string;
  onClose: () => void;
  onSelect: (item: MediaItem) => void;
}

export function RelatedTitlesDialog({
  open,
  title,
  items,
  currentId,
  onClose,
  onSelect,
}: RelatedTitlesDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open || items.length === 0) {
    return null;
  }

  const handleSelect = (item: MediaItem) => {
    onClose();
    if (item.id !== currentId) {
      onSelect(item);
    }
  };

  return createPortal(
    <div className="media-desc-dialog related-dialog" role="presentation">
      <button
        type="button"
        className="media-desc-dialog__backdrop"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div className="media-desc-dialog__snake related-dialog__snake">
        <div className="media-desc-dialog__snake-ring" aria-hidden="true">
          <div className="media-desc-dialog__snake-beam media-desc-dialog__snake-beam--trail" />
          <div className="media-desc-dialog__snake-beam media-desc-dialog__snake-beam--core" />
        </div>
        <div
          className="media-desc-dialog__panel related-dialog__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="related-dialog-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="media-desc-dialog__header media-desc-dialog__header--compact">
            <h3 id="related-dialog-title" className="media-desc-dialog__title">
              {title}
              <span className="related-dialog__count">{items.length}</span>
            </h3>
            <button
              type="button"
              className="media-desc-dialog__close"
              aria-label="Закрыть"
              onClick={onClose}
            >
              <CloseIcon size={18} />
            </button>
          </div>

          <div className="media-desc-dialog__content related-dialog__content">
            <div className="related-dialog__grid">
              {items.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  isFocused={item.id === currentId}
                  onSelect={handleSelect}
                  onOpenDetails={handleSelect}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
