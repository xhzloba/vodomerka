interface SettingsSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

export function SettingsSwitch({
  checked,
  onChange,
  disabled = false,
  'aria-label': ariaLabel,
}: SettingsSwitchProps) {
  return (
    <button
      type="button"
      className={`settings-toggle${checked ? ' settings-toggle--on' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="settings-toggle__thumb" />
    </button>
  );
}
