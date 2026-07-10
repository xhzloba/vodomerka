import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './ContextMenu.css';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  title?: string;
  items: ContextMenuItem[];
  onClose: () => void;
  onItemClick?: (id: string) => void;
}

const MENU_OFFSET = 8;
const VIEWPORT_PADDING = 12;

export function ContextMenu({
  open,
  x,
  y,
  title,
  items,
  onClose,
  onItemClick,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const menu = menuRef.current;
    if (!menu) {
      setPosition({ x, y });
      return;
    }

    const rect = menu.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - VIEWPORT_PADDING;
    const maxY = window.innerHeight - rect.height - VIEWPORT_PADDING;

    setPosition({
      x: Math.max(VIEWPORT_PADDING, Math.min(x, maxX)),
      y: Math.max(VIEWPORT_PADDING, Math.min(y, maxY)),
    });
  }, [open, x, y, title, items.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }

      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    const handleResize = () => {
      onClose();
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        top: position.y + MENU_OFFSET,
        left: position.x + MENU_OFFSET,
      }}
      role="menu"
      aria-label={title ?? 'Контекстное меню'}
      onContextMenu={(event) => event.preventDefault()}
    >
      {title ? <p className="context-menu__title">{title}</p> : null}
      <ul className="context-menu__list">
        {items.map((item) => (
          <li key={item.id} className="context-menu__item" role="none">
            <button
              type="button"
              className="context-menu__button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) {
                  return;
                }

                onItemClick?.(item.id);
                onClose();
              }}
            >
              {item.icon ? <span className="context-menu__icon">{item.icon}</span> : null}
              <span className="context-menu__label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}
