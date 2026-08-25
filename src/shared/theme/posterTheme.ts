import { loadMediaImage } from '@/shared/media/imageLoader';

export interface PosterThemePalette {
  bg: string;
  elevated: string;
  glow1: string;
  glow2: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  accentNav: string;
  focusGlow: string;
  snake1: string;
  snake2: string;
  snake3: string;
  snake4: string;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const POSTER_VAR_KEYS = [
  '--app-bg',
  '--app-elevated',
  '--app-glow-1',
  '--app-glow-2',
  '--app-accent',
  '--app-accent-soft',
  '--app-accent-border',
  '--app-accent-nav',
  '--bg-elevated',
  '--focus-glow',
  '--media-snake-1',
  '--media-snake-2',
  '--media-snake-3',
  '--media-snake-4',
] as const;

const FALLBACK_PRIMARY: Rgb = { r: 36, g: 28, b: 44 };
const FALLBACK_SECONDARY: Rgb = { r: 70, g: 110, b: 140 };

const paletteCache = new Map<string, PosterThemePalette>();

function clamp(value: number, min = 0, max = 255): number {
  return Math.min(max, Math.max(min, value));
}

function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel)).toString(16).padStart(2, '0'))
    .join('')}`;
}

function toRgba({ r, g, b }: Rgb, alpha: number): string {
  return `rgba(${clamp(Math.round(r))}, ${clamp(Math.round(g))}, ${clamp(Math.round(b))}, ${alpha})`;
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function luminance({ r, g, b }: Rgb): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function saturation({ r, g, b }: Rgb): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === min) return 0;
  const light = (max + min) / 2;
  return light > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

function hue({ r, g, b }: Rgb): number {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const delta = max - min;
  if (delta === 0) return 0;
  let h = 0;
  if (max === nr) h = ((ng - nb) / delta) % 6;
  else if (max === ng) h = (nb - nr) / delta + 2;
  else h = (nr - ng) / delta + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

/** Push color away from gray so dark/muted posters still paint visible glows. */
function boostSat(color: Rgb, factor = 1.55): Rgb {
  const avg = (color.r + color.g + color.b) / 3;
  return {
    r: clamp(avg + (color.r - avg) * factor),
    g: clamp(avg + (color.g - avg) * factor),
    b: clamp(avg + (color.b - avg) * factor),
  };
}

function liftForGlow(color: Rgb): Rgb {
  const sat = boostSat(color, saturation(color) < 0.18 ? 2.1 : 1.45);
  // Avoid near-black glows: lift midtones a bit
  const lum = luminance(sat);
  if (lum >= 0.22) return sat;
  return mix(sat, { r: 255, g: 255, b: 255 }, 0.22 - lum);
}

function isReadableSrc(src: string): boolean {
  return (
    src.startsWith('data:') ||
    src.startsWith('blob:') ||
    src.startsWith('/') ||
    src.startsWith('./')
  );
}

async function resolveReadableSrc(imageSrc: string): Promise<string> {
  if (isReadableSrc(imageSrc)) {
    return imageSrc;
  }

  // Always prefer IPC data URL — avoids tainted canvas on cross-origin posters
  if (window.electronAPI?.images?.fetch) {
    try {
      return await window.electronAPI.images.fetch(imageSrc);
    } catch {
      // fall through
    }
  }

  try {
    return await loadMediaImage(imageSrc);
  } catch {
    return imageSrc;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    if (src.startsWith('http')) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image for palette'));
    image.src = src;
  });
}

function sampleRegion(
  data: Uint8ClampedArray,
  size: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { avg: Rgb; vibrant: Rgb; count: number } {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  let best: Rgb | null = null;
  let bestScore = -1;

  const left = Math.max(0, Math.floor(x0));
  const top = Math.max(0, Math.floor(y0));
  const right = Math.min(size, Math.ceil(x1));
  const bottom = Math.min(size, Math.ceil(y1));

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const i = (y * size + x) * 4;
      const alpha = data[i + 3];
      if (alpha < 160) continue;

      const color: Rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
      const lum = luminance(color);
      if (lum < 0.025 || lum > 0.97) continue;

      r += color.r;
      g += color.g;
      b += color.b;
      count += 1;

      const sat = saturation(color);
      const score = sat * 1.8 + (lum > 0.12 && lum < 0.78 ? 0.45 : 0) + lum * 0.15;
      if (score > bestScore) {
        bestScore = score;
        best = color;
      }
    }
  }

  if (count === 0) {
    return { avg: FALLBACK_PRIMARY, vibrant: FALLBACK_SECONDARY, count: 0 };
  }

  const avg = { r: r / count, g: g / count, b: b / count };
  return { avg, vibrant: best ?? avg, count };
}

function pickPaletteColors(image: HTMLImageElement): {
  primary: Rgb;
  secondary: Rgb;
  cornerA: Rgb;
  cornerB: Rgb;
} {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return {
      primary: FALLBACK_PRIMARY,
      secondary: FALLBACK_SECONDARY,
      cornerA: FALLBACK_PRIMARY,
      cornerB: FALLBACK_SECONDARY,
    };
  }

  ctx.drawImage(image, 0, 0, size, size);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    throw new Error('Canvas tainted — cannot sample palette');
  }

  const buckets = new Map<string, { color: Rgb; score: number }>();
  let fallbackR = 0;
  let fallbackG = 0;
  let fallbackB = 0;
  let fallbackCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 160) continue;

    const color: Rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
    const lum = luminance(color);
    if (lum < 0.02 || lum > 0.98) continue;

    fallbackR += color.r;
    fallbackG += color.g;
    fallbackB += color.b;
    fallbackCount += 1;

    const sat = saturation(color);
    // Soft weight: muted colors still count, saturated win
    const key = `${color.r >> 3},${color.g >> 3},${color.b >> 3}`;
    const weight = 0.55 + sat * 1.6 + (lum > 0.1 && lum < 0.85 ? 0.4 : 0);
    const existing = buckets.get(key);
    if (existing) {
      existing.score += weight;
      existing.color = mix(existing.color, color, 0.28);
    } else {
      buckets.set(key, { color, score: weight });
    }
  }

  const ranked = [...buckets.values()].sort((a, b) => b.score - a.score);
  const avgFallback =
    fallbackCount > 0
      ? { r: fallbackR / fallbackCount, g: fallbackG / fallbackCount, b: fallbackB / fallbackCount }
      : FALLBACK_PRIMARY;

  const primary = ranked[0]?.color ?? avgFallback;
  const primaryHue = hue(primary);
  let secondary =
    ranked.find((entry) => hueDistance(hue(entry.color), primaryHue) > 22)?.color ??
    ranked[1]?.color ??
    mix(primary, FALLBACK_SECONDARY, 0.55);

  const topLeft = sampleRegion(data, size, 0, 0, size * 0.42, size * 0.42);
  const bottomRight = sampleRegion(data, size, size * 0.58, size * 0.58, size, size);
  const topRight = sampleRegion(data, size, size * 0.58, 0, size, size * 0.42);
  const bottomLeft = sampleRegion(data, size, 0, size * 0.58, size * 0.42, size);

  const cornerA = liftForGlow(topLeft.count ? topLeft.vibrant : primary);
  // Prefer opposite corner with different hue; else secondary
  const oppositeCandidates = [bottomRight, topRight, bottomLeft]
    .filter((region) => region.count > 0)
    .map((region) => region.vibrant)
    .sort((a, b) => {
      const scoreA = hueDistance(hue(a), hue(cornerA)) + saturation(a);
      const scoreB = hueDistance(hue(b), hue(cornerA)) + saturation(b);
      return scoreB - scoreA;
    });
  const cornerB = liftForGlow(oppositeCandidates[0] ?? secondary);

  return {
    primary: boostSat(primary, 1.2),
    secondary: boostSat(secondary, 1.25),
    cornerA,
    cornerB,
  };
}

export function buildPosterThemePalette(
  primary: Rgb,
  secondary: Rgb,
  cornerA = primary,
  cornerB = secondary,
): PosterThemePalette {
  const black = { r: 5, g: 5, b: 7 };
  const bg = mix(primary, black, 0.78);
  const elevated = mix(primary, black, 0.64);
  const accentBase = mix(secondary, { r: 235, g: 235, b: 240 }, 0.38);
  const accent = mix(accentBase, primary, 0.16);

  return {
    bg: toHex(bg),
    elevated: toHex(elevated),
    glow1: toRgba(cornerA, 0.34),
    glow2: toRgba(cornerB, 0.28),
    accent: toHex(accent),
    accentSoft: toRgba(accent, 0.14),
    accentBorder: toRgba(accent, 0.28),
    accentNav: toRgba(accent, 0.14),
    focusGlow: toRgba(accent, 0.22),
    snake1: toRgba(cornerA, 0.16),
    snake2: toRgba(mix(cornerB, accent, 0.4), 0.55),
    snake3: toRgba(mix(accent, { r: 255, g: 255, b: 255 }, 0.35), 0.92),
    snake4: toRgba(cornerB, 0.72),
  };
}

export async function extractPosterThemePalette(imageSrc: string): Promise<PosterThemePalette | null> {
  if (!imageSrc) return null;

  const cached = paletteCache.get(imageSrc);
  if (cached) return cached;

  try {
    const readable = await resolveReadableSrc(imageSrc);
    const image = await loadImage(readable);
    const { primary, secondary, cornerA, cornerB } = pickPaletteColors(image);
    const palette = buildPosterThemePalette(primary, secondary, cornerA, cornerB);
    paletteCache.set(imageSrc, palette);
    if (readable !== imageSrc) {
      paletteCache.set(readable, palette);
    }
    if (paletteCache.size > 64) {
      const oldest = paletteCache.keys().next().value;
      if (oldest) paletteCache.delete(oldest);
    }
    return palette;
  } catch {
    // Retry via IPC when canvas was tainted on raw http(s)
    if (!isReadableSrc(imageSrc)) {
      try {
        const forced = await loadMediaImage(imageSrc);
        const image = await loadImage(forced);
        const { primary, secondary, cornerA, cornerB } = pickPaletteColors(image);
        const palette = buildPosterThemePalette(primary, secondary, cornerA, cornerB);
        paletteCache.set(imageSrc, palette);
        return palette;
      } catch {
        return null;
      }
    }

    return null;
  }
}

export function applyPosterThemeVars(palette: PosterThemePalette): void {
  const root = document.documentElement;
  root.dataset.homeBackdropTint = '1';

  root.style.setProperty('--app-bg', palette.bg);
  root.style.setProperty('--app-elevated', palette.elevated);
  root.style.setProperty('--app-glow-1', palette.glow1);
  root.style.setProperty('--app-glow-2', palette.glow2);
  root.style.setProperty('--app-accent', palette.accent);
  root.style.setProperty('--app-accent-soft', palette.accentSoft);
  root.style.setProperty('--app-accent-border', palette.accentBorder);
  root.style.setProperty('--app-accent-nav', palette.accentNav);
  root.style.setProperty('--bg-elevated', palette.elevated);
  root.style.setProperty('--focus-glow', palette.focusGlow);
  root.style.setProperty('--media-snake-1', palette.snake1);
  root.style.setProperty('--media-snake-2', palette.snake2);
  root.style.setProperty('--media-snake-3', palette.snake3);
  root.style.setProperty('--media-snake-4', palette.snake4);
}

export function clearPosterThemeVars(): void {
  const root = document.documentElement;
  delete root.dataset.homeBackdropTint;
  for (const key of POSTER_VAR_KEYS) {
    root.style.removeProperty(key);
  }
}
