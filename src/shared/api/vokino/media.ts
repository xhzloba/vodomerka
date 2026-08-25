import { httpGet } from '@/shared/api/httpClient';
import { resolveVokinoUrl } from '@/shared/config/api';
import type {
  VokinoCastMember,
  VokinoChannelItem,
  VokinoContentDetails,
} from '@/shared/api/vokino/types';
import { attachViewRelations, mapChannelItem, type MediaItem } from '@/shared/domain/media';

interface VokinoViewResponse {
  type: string;
  details: VokinoContentDetails;
  sequelsAndPrequels?: VokinoChannelItem[] | 0;
  similars?: VokinoChannelItem[] | 0;
  casts?: VokinoCastMember[] | 0;
}

/** Catalog card by id — `/v2/view/{id}` (same source as home/slider detail). */
export async function fetchMediaById(mediaId: string): Promise<MediaItem | null> {
  const id = mediaId.trim();
  if (!id || id.startsWith('torrent:')) {
    return null;
  }

  const url = resolveVokinoUrl(`/view/${encodeURIComponent(id)}`);
  const response = await httpGet<VokinoViewResponse>(url);
  if (!response?.details?.id) {
    return null;
  }

  const item = mapChannelItem({
    details: response.details,
    playlist_url: resolveVokinoUrl(`/view/${encodeURIComponent(response.details.id)}`),
  });

  if (!item) {
    return null;
  }

  return attachViewRelations(
    item,
    response.sequelsAndPrequels,
    response.similars,
    response.casts,
  );
}

/** Stub from player/continue/watched — missing catalog fields. */
export function isSparseMediaItem(
  item: Pick<MediaItem, 'description' | 'genres' | 'year' | 'viewUrl' | 'rating' | 'director'>,
): boolean {
  const genres = Array.isArray(item.genres) ? item.genres : [];
  return (
    !item.description &&
    genres.length === 0 &&
    item.year == null &&
    !item.viewUrl &&
    item.rating == null &&
    !item.director
  );
}
