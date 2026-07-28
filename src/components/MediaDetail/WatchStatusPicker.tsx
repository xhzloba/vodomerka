import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  WATCH_STATUS_LABELS,
  WATCH_STATUSES,
  type WatchStatus,
} from '@/shared/domain/watchStatus';
import {
  BanIcon,
  CheckIcon,
  ChevronDownIcon,
  EyeIcon,
  PauseCircleIcon,
  WatchingIcon,
} from '@/shared/ui/icons';
import './WatchStatusPicker.css';

interface WatchStatusPickerProps {
  value: WatchStatus | null;
  onSelect: (status: WatchStatus) => void;
}

interface MenuCoords {
  top: number;
  left: number;
}

function StatusIcon({
  status,
  active = false,
  size = 17,
}: {
  status: WatchStatus;
  active?: boolean;
  size?: number;
}) {
  const stroke = active ? 2 : 1.75;
  if (status === 'watching') {
    return <WatchingIcon size={size} strokeWidth={stroke} />;
  }
  if (status === 'watched') {
    return <EyeIcon size={size} strokeWidth={stroke} />;
  }
  if (status === 'postponed') {
    return <PauseCircleIcon size={size} strokeWidth={stroke} />;
  }
  return <BanIcon size={size} strokeWidth={stroke} />;
}

export function WatchStatusPicker({ value, onSelect }: WatchStatusPickerProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const updatePosition = () => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuWidth = menu?.offsetWidth || 220;
    const menuHeight = menu?.offsetHeight || 200;
    const gap = 8;

    let left = rect.left - menuWidth - gap;
    let top = rect.top;

    if (left < 12) {
      left = Math.min(rect.right + gap, window.innerWidth - menuWidth - 12);
    }
    if (top + menuHeight > window.innerHeight - 12) {
      top = Math.max(12, window.innerHeight - menuHeight - 12);
    }
    if (top < 12) {
      top = 12;
    }

    setCoords({ top, left });
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    updatePosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    const onReposition = () => updatePosition();

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  const menu =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="watch-status-picker__menu"
            id={listId}
            role="listbox"
            aria-label="Статус просмотра"
            style={
              coords
                ? { top: coords.top, left: coords.left, visibility: 'visible' }
                : { top: 0, left: 0, visibility: 'hidden' }
            }
          >
            {WATCH_STATUSES.map((status) => {
              const selected = value === status;
              return (
                <button
                  key={status}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`watch-status-picker__option${
                    selected ? ' watch-status-picker__option--selected' : ''
                  }`}
                  onClick={() => {
                    onSelect(status);
                    setOpen(false);
                  }}
                >
                  <span className="watch-status-picker__option-icon" aria-hidden="true">
                    <StatusIcon status={status} active={selected} />
                  </span>
                  <span className="watch-status-picker__option-label">
                    {WATCH_STATUS_LABELS[status]}
                  </span>
                  {selected ? (
                    <CheckIcon size={15} className="watch-status-picker__check" />
                  ) : (
                    <span className="watch-status-picker__check-spacer" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={`watch-status-picker${open ? ' watch-status-picker--open' : ''}${
        value ? ' watch-status-picker--active' : ''
      }`}
    >
      <button
        ref={triggerRef}
        type="button"
        className="watch-status-picker__trigger"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="watch-status-picker__trigger-icon" aria-hidden="true">
          {value ? <StatusIcon status={value} active /> : <EyeIcon size={17} strokeWidth={1.75} />}
        </span>
        <span className="watch-status-picker__trigger-label">
          {value ? WATCH_STATUS_LABELS[value] : 'Не выбран'}
        </span>
        <ChevronDownIcon size={16} className="watch-status-picker__chevron" />
      </button>
      {menu}
    </div>
  );
}
