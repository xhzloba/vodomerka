import type { StreamingBrandPreset } from './types';
import huluMark from './assets/hulu.png';

/**
 * Built-in streaming / studio marks for compilations and reusable surfaces.
 * Drop new assets into `./assets` and register here (or via extraPresets later).
 */
export const STREAMING_BRAND_PRESETS: readonly StreamingBrandPreset[] = [
  {
    id: 'hulu',
    label: 'Hulu',
    nameIncludes: ['hulu'],
    assetUrl: huluMark,
    accent: '#1ce783',
  },
];

export function listStreamingBrandPresets(
  extraPresets?: readonly StreamingBrandPreset[],
): StreamingBrandPreset[] {
  if (!extraPresets?.length) {
    return [...STREAMING_BRAND_PRESETS];
  }
  return [...STREAMING_BRAND_PRESETS, ...extraPresets];
}
