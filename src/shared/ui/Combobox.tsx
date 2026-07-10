import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDownIcon } from '@/shared/ui/icons';
import './Combobox.css';

export interface ComboboxOption {
  id: string;
  label: string;
}

interface ComboboxProps {
  value: string | null;
  options: ComboboxOption[];
  onChange: (id: string) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
}

export function Combobox({
  value,
  options,
  onChange,
  placeholder = 'Выберите',
  size = 'sm',
}: ComboboxProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((option) => option.id === value);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={rootRef}
      className={`ui-combobox ui-combobox--${size}${isOpen ? ' ui-combobox--open' : ''}`}
    >
      <button
        type="button"
        className="ui-combobox__trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{selected?.label ?? placeholder}</span>
        <ChevronDownIcon size={size === 'sm' ? 16 : 18} />
      </button>

      {isOpen && (
        <ul id={listboxId} className="ui-combobox__list" role="listbox">
          {options.map((option) => {
            const isSelected = option.id === value;

            return (
              <li key={option.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`ui-combobox__option${isSelected ? ' ui-combobox__option--active' : ''}`}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                  }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
