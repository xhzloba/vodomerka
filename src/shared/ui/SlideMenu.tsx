import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from '@/shared/ui/icons';
import './SlideMenu.css';

const CLOSE_ANIMATION_MS = 320;

interface SlideMenuProps {
  open: boolean;
  title: string;
  onClose: () => void;
  placement?: 'side' | 'bottom';
  size?: 'default' | 'wide' | 'xlarge';
  anchorSelector?: string;
  children: React.ReactNode;
}

export function SlideMenu({
  open,
  title,
  onClose,
  placement = 'side',
  size = 'default',
  anchorSelector,
  children,
}: SlideMenuProps) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [anchorStyle, setAnchorStyle] = useState<CSSProperties>({});

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

  useLayoutEffect(() => {
    if (placement !== 'bottom' || !anchorSelector || !mounted) {
      setAnchorStyle({});
      return;
    }

    const update = () => {
      const anchor = document.querySelector(anchorSelector);
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      setAnchorStyle({
        '--slide-menu-anchor-left': `${rect.left}px`,
        '--slide-menu-anchor-width': `${rect.width}px`,
      } as CSSProperties);
    };

    update();

    window.addEventListener('resize', update);

    const observed = new Set<Element>();
    const ro = new ResizeObserver(update);

    const anchor = document.querySelector(anchorSelector);
    if (anchor) {
      ro.observe(anchor);
      observed.add(anchor);
    }

    const shell = document.querySelector('.app-shell');
    if (shell) {
      ro.observe(shell);
      observed.add(shell);
    }

    return () => {
      window.removeEventListener('resize', update);
      ro.disconnect();
      observed.clear();
    };
  }, [placement, anchorSelector, mounted, open]);

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

  return createPortal(
    <div
      className={`slide-menu slide-menu--${placement} slide-menu--${size}${closing ? ' slide-menu--closing' : ''}`}
      style={anchorStyle}
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
          {placement === 'bottom' ? <div className="slide-menu__handle" aria-hidden="true" /> : null}
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
    </div>,
    document.body,
  );
}
