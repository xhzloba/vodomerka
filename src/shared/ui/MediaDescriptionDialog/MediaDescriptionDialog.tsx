import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from '@/shared/ui/icons';
import './MediaDescriptionDialog.css';

interface MediaDescriptionDialogProps {
  open: boolean;
  title: string;
  description?: string;
  genres?: string[];
  onClose: () => void;
}

export function MediaDescriptionDialog({
  open,
  title,
  description,
  genres = [],
  onClose,
}: MediaDescriptionDialogProps) {
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

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const hasDescription = Boolean(description?.trim());
  const hasGenres = genres.length > 0;

  return createPortal(
    <div className="media-desc-dialog" role="presentation">
      <button
        type="button"
        className="media-desc-dialog__backdrop"
        aria-label="Закрыть описание"
        onClick={onClose}
      />
      <div className="media-desc-dialog__snake">
        <div className="media-desc-dialog__snake-ring" aria-hidden="true">
          <div className="media-desc-dialog__snake-beam media-desc-dialog__snake-beam--trail" />
          <div className="media-desc-dialog__snake-beam media-desc-dialog__snake-beam--core" />
        </div>
        <div
          className="media-desc-dialog__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="media-desc-dialog-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className={`media-desc-dialog__header${hasGenres || hasDescription ? ' media-desc-dialog__header--compact' : ''}`}
          >
            <h3 id="media-desc-dialog-title" className="media-desc-dialog__title">
              {title}
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

          <div className="media-desc-dialog__content">
            {hasGenres ? (
              <div
                className={`media-desc-dialog__genres${hasDescription ? ' media-desc-dialog__genres--with-text' : ''}`}
              >
                <span className="media-desc-dialog__genres-label">Жанры</span>
                <p className="media-desc-dialog__genres-value">{genres.join(', ')}</p>
              </div>
            ) : null}

            {hasDescription ? <p className="media-desc-dialog__text">{description}</p> : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
