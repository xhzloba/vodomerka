import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon } from '@/shared/ui/icons';
import './ContextMenu.css';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  active?: boolean;
  tone?: 'default' | 'danger';
  separatorBefore?: boolean;
}

interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  title?: string;
  header?: ReactNode;
  items: ContextMenuItem[];
  className?: string;
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
  header,
  items,
  className,
  onClose,
  onItemClick,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });
  const [focusIndex, setFocusIndex] = useState(0);

  const enabledItems = items.filter((item) => !item.disabled);

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
  }, [open, x, y, title, header, items.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setFocusIndex(0);
  }, [open, items]);

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
        return;
      }

      if (enabledItems.length === 0) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setFocusIndex((current) => (current + 1) % enabledItems.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setFocusIndex((current) => (current - 1 + enabledItems.length) % enabledItems.length);
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const item = enabledItems[focusIndex];
        if (item) {
          onItemClick?.(item.id);
          onClose();
        }
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
  }, [enabledItems, focusIndex, onClose, onItemClick, open]);

  if (!open) {
    return null;
  }

  const menuClassName = ['context-menu', className].filter(Boolean).join(' ');

  return createPortal(
    <div
      ref={menuRef}
      className={menuClassName}
      style={{
        top: position.y + MENU_OFFSET,
        left: position.x + MENU_OFFSET,
      }}
      role="menu"
      aria-label={title ?? 'Контекстное меню'}
      onContextMenu={(event) => event.preventDefault()}
    >
      {header ? <div className="context-menu__header">{header}</div> : null}
      {!header && title ? <p className="context-menu__title">{title}</p> : null}

      <ul className="context-menu__list">
        {items.map((item) => {
          const enabledIndex = enabledItems.findIndex((entry) => entry.id === item.id);
          const isFocused = enabledIndex === focusIndex;

          return (
            <li key={item.id} className="context-menu__item" role="none">
              {item.separatorBefore ? <div className="context-menu__separator" role="separator" /> : null}
              <button
                type="button"
                className={[
                  'context-menu__button',
                  item.active ? 'context-menu__button--active' : '',
                  item.tone === 'danger' ? 'context-menu__button--danger' : '',
                  isFocused ? 'context-menu__button--focused' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
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
                {item.active ? (
                  <span className="context-menu__check" aria-hidden="true">
                    <CheckIcon size={12} strokeWidth={2.5} />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>,
    document.body,
  );
}
