import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon, ChevronRightIcon } from '@/shared/ui/icons';
import './ContextMenu.css';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  active?: boolean;
  tone?: 'default' | 'danger';
  separatorBefore?: boolean;
  children?: ContextMenuItem[];
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
const SUBMENU_MIN_WIDTH = 220;

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submenuSide, setSubmenuSide] = useState<'right' | 'left'>('right');

  const enabledItems = items.filter((item) => !item.disabled);

  const toggleExpanded = (itemId: string) => {
    const root = menuRef.current;
    const anchor = root?.querySelector<HTMLButtonElement>(`[data-menu-item-id="${itemId}"]`);
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      const freeRight = window.innerWidth - rect.right - VIEWPORT_PADDING;
      const freeLeft = rect.left - VIEWPORT_PADDING;
      setSubmenuSide(freeRight >= SUBMENU_MIN_WIDTH || freeRight >= freeLeft ? 'right' : 'left');
    }
    setExpandedId((current) => (current === itemId ? null : itemId));
  };

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
    setExpandedId(null);
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
          if (item.children?.length) {
            toggleExpanded(item.id);
            return;
          }
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
                  item.children?.length ? 'context-menu__button--expandable' : '',
                  expandedId === item.id ? 'context-menu__button--expanded' : '',
                  item.active ? 'context-menu__button--active' : '',
                  item.tone === 'danger' ? 'context-menu__button--danger' : '',
                  isFocused ? 'context-menu__button--focused' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                role="menuitem"
                data-menu-item-id={item.id}
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) {
                    return;
                  }

                  if (item.children?.length) {
                    toggleExpanded(item.id);
                    return;
                  }

                  onItemClick?.(item.id);
                  onClose();
                }}
              >
                {item.icon ? <span className="context-menu__icon">{item.icon}</span> : null}
                <span className="context-menu__label">{item.label}</span>
                {item.children?.length ? (
                  <span className="context-menu__expand" aria-hidden="true">
                    <ChevronRightIcon size={14} />
                  </span>
                ) : null}
                {item.active ? (
                  <span className="context-menu__check" aria-hidden="true">
                    <CheckIcon size={12} strokeWidth={2.5} />
                  </span>
                ) : null}
              </button>
              {item.children?.length && expandedId === item.id ? (
                <ul className={`context-menu__sublist context-menu__sublist--${submenuSide}`} role="menu">
                  {item.children.map((child) => (
                    <li key={child.id} className="context-menu__item" role="none">
                      <button
                        type="button"
                        className={[
                          'context-menu__button',
                          'context-menu__button--subitem',
                          child.active ? 'context-menu__button--active' : '',
                          child.tone === 'danger' ? 'context-menu__button--danger' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        role="menuitem"
                        disabled={child.disabled}
                        onClick={() => {
                          if (child.disabled) {
                            return;
                          }
                          onItemClick?.(child.id);
                          onClose();
                        }}
                      >
                        {child.icon ? <span className="context-menu__icon">{child.icon}</span> : null}
                        <span className="context-menu__label">{child.label}</span>
                        {child.active ? (
                          <span className="context-menu__check" aria-hidden="true">
                            <CheckIcon size={12} strokeWidth={2.5} />
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>,
    document.body,
  );
}
