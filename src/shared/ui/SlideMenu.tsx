import { useEffect, useState } from 'react';
import { CloseIcon } from '@/shared/ui/icons';
import './SlideMenu.css';

const CLOSE_ANIMATION_MS = 320;

interface SlideMenuProps {
  open: boolean;
  title: string;
  onClose: () => void;
  size?: 'default' | 'wide';
  children: React.ReactNode;
}

export function SlideMenu({ open, title, onClose, size = 'default', children }: SlideMenuProps) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }

    if (mounted) {
      setClosing(true);
    }
  }, [open, mounted]);

  useEffect(() => {
    if (!closing) return;

    const timer = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, CLOSE_ANIMATION_MS);

    return () => window.clearTimeout(timer);
  }, [closing]);

  useEffect(() => {
    if (!mounted || closing) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mounted, closing, onClose]);

  if (!mounted) {
    return null;
  }

  return (
    <div
      className={`slide-menu slide-menu--${size}${closing ? ' slide-menu--closing' : ''}`}
      role="presentation"
    >
      <button
        type="button"
        className="slide-menu__backdrop"
        aria-label="Закрыть меню"
        onClick={onClose}
        disabled={closing}
      />

      <aside className="slide-menu__panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="slide-menu__shade" aria-hidden="true" />

        <div className="slide-menu__content">
          <div className="slide-menu__header">
            <h2 className="slide-menu__title">{title}</h2>
            <button
              type="button"
              className="slide-menu__close"
              onClick={onClose}
              aria-label="Закрыть"
              disabled={closing}
            >
              <CloseIcon size={18} />
            </button>
          </div>

          <div className="slide-menu__body scroll-overlay">{children}</div>
        </div>
      </aside>
    </div>
  );
}
