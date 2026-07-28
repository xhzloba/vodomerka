import type { CSSProperties } from 'react';
import type { StreamingBrandPreset } from '../types';
import './StreamingBrandMark.css';

interface StreamingBrandMarkProps {
  brand: StreamingBrandPreset;
  /** Visual size. `sm` for breadcrumbs / dense chrome. */
  size?: 'sm' | 'md';
  className?: string;
}

/** Reusable streaming/studio mark — compilations header, cards, filters, etc. */
export function StreamingBrandMark({
  brand,
  size = 'sm',
  className = '',
}: StreamingBrandMarkProps) {
  return (
    <span
      className={`streaming-brand-mark streaming-brand-mark--${size}${
        className ? ` ${className}` : ''
      }`}
      style={
        brand.accent
          ? ({ '--streaming-brand-accent': brand.accent } as CSSProperties)
          : undefined
      }
      title={brand.label}
      aria-label={brand.label}
    >
      <img src={brand.assetUrl} alt="" draggable={false} decoding="async" loading="lazy" />
    </span>
  );
}
