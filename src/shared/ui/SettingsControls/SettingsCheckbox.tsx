import { CheckIcon } from '@/shared/ui/icons';

interface SettingsCheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Visual-only mark inside a parent row/button (no nested control). */
  decorative?: boolean;
  'aria-label'?: string;
}

export function SettingsCheckbox({
  checked,
  onChange,
  disabled = false,
  decorative = false,
  'aria-label': ariaLabel,
}: SettingsCheckboxProps) {
  const className = `settings-checkbox${checked ? ' settings-checkbox--on' : ''}${
    disabled ? ' settings-checkbox--disabled' : ''
  }`;

  if (decorative) {
    return (
      <span className={className} aria-hidden="true">
        {checked ? <CheckIcon size={12} strokeWidth={2.5} /> : null}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
    >
      {checked ? <CheckIcon size={12} strokeWidth={2.5} /> : null}
    </button>
  );
}
