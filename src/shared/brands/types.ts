/** Built-in + future user-selectable streaming / studio brand presets. */

export type StreamingBrandId = string;

export interface StreamingBrandPreset {
  id: StreamingBrandId;
  label: string;
  /** Exact Vokino compilation ids (preferred match). */
  compilationIds?: string[];
  /** Case-insensitive substrings matched against compilation name. */
  nameIncludes?: string[];
  /** Vite-resolved asset URL (png/svg/webp). */
  assetUrl: string;
  /** Optional accent for badge chrome / future tinting. */
  accent?: string;
}

export interface ResolveStreamingBrandInput {
  id?: string | null;
  name?: string | null;
}

export interface ResolveStreamingBrandOptions {
  /** Limit to these ids (future user preset picker). Omit = all registered. */
  enabledBrandIds?: readonly string[] | null;
  /** Extra presets (user-installed / custom). */
  extraPresets?: readonly StreamingBrandPreset[];
}
