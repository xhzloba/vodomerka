import type { ReactNode } from 'react';

type SettingsGlyphTone =
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'pink'
  | 'orange'
  | 'green'
  | 'teal'
  | 'gray'
  | 'red';

interface SettingsGlyphProps {
  tone?: SettingsGlyphTone;
  children: ReactNode;
}

export function SettingsGlyph({ tone = 'blue', children }: SettingsGlyphProps) {
  return (
    <span className={`settings-glyph settings-glyph--${tone}`} aria-hidden="true">
      {children}
    </span>
  );
}
