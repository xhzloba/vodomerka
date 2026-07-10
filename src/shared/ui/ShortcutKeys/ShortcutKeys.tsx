import './ShortcutKeys.css';

interface ShortcutKeysProps {
  keys: string[];
  size?: 'sm' | 'md';
  muted?: boolean;
  className?: string;
}

export function ShortcutKeys({
  keys,
  size = 'sm',
  muted = false,
  className,
}: ShortcutKeysProps) {
  const rootClassName = [
    'shortcut-keys',
    `shortcut-keys--${size}`,
    muted ? 'shortcut-keys--muted' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={rootClassName} aria-hidden="true">
      {keys.map((key, index) => (
        <kbd key={`${key}-${index}`} className="shortcut-keys__key">
          {key}
        </kbd>
      ))}
    </span>
  );
}
