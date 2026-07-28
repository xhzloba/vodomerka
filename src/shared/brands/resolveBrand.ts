import { listStreamingBrandPresets } from './registry';
import type {
  ResolveStreamingBrandInput,
  ResolveStreamingBrandOptions,
  StreamingBrandPreset,
} from './types';

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Resolve a streaming/studio brand for a compilation (or any titled entity).
 * Match order: exact compilation id → nameIncludes substring.
 */
export function resolveStreamingBrand(
  input: ResolveStreamingBrandInput,
  options: ResolveStreamingBrandOptions = {},
): StreamingBrandPreset | null {
  const presets = listStreamingBrandPresets(options.extraPresets);
  const enabled = options.enabledBrandIds
    ? new Set(options.enabledBrandIds.map((id) => id.trim()).filter(Boolean))
    : null;

  const candidates = enabled
    ? presets.filter((preset) => enabled.has(preset.id))
    : presets;

  const id = normalizeText(input.id);
  if (id) {
    const byId = candidates.find((preset) =>
      preset.compilationIds?.some((compilationId) => normalizeText(compilationId) === id),
    );
    if (byId) {
      return byId;
    }
  }

  const name = normalizeText(input.name);
  if (!name) {
    return null;
  }

  return (
    candidates.find((preset) =>
      preset.nameIncludes?.some((fragment) => name.includes(normalizeText(fragment))),
    ) ?? null
  );
}

export function getStreamingBrandById(
  brandId: string,
  options: ResolveStreamingBrandOptions = {},
): StreamingBrandPreset | null {
  const id = brandId.trim();
  if (!id) {
    return null;
  }
  return (
    listStreamingBrandPresets(options.extraPresets).find((preset) => preset.id === id) ?? null
  );
}
