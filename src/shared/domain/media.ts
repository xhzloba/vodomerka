import type { VokinoChannelItem } from '@/shared/api/vokino/types';
import { resolveVokinoUrl } from '@/shared/config/api';
import { applyMediaOverrides } from '@/shared/domain/overrides';
import { getMediaOverrides } from '@/shared/domain/overridesStore';
import {
  isMovieMediaType,
  isSerialMediaType,
  normalizeMediaType,
  resolveMediaTypeFromDetails,
} from '../../../contracts/mediaType';

export type MediaType = 'movie' | 'serial' | string;

export interface MediaItem {
  id: string;
  title: string;
  subtitle?: string;
  year?: number;
  type: MediaType;
  genres: string[];
  rating?: number;
  duration?: string;
  description?: string;
  poster: string;
  backdrop: string;
  backdrops?: string[];
  logo?: string;
  related?: MediaItem[];
  similars?: MediaItem[];
  viewUrl: string;
  country?: string;
  director?: string;
  age?: number;
  trailerUrl?: string;
}

export interface ContentRow {
  id: string;
  title: string;
  playlistUrl: string;
  items: MediaItem[];
}

function parseRating(kp?: string, imdb?: string): number | undefined {
  const kpValue = kp ? Number.parseFloat(kp) : Number.NaN;
  if (Number.isFinite(kpValue) && kpValue > 0) return kpValue;

  const imdbValue = imdb ? Number.parseFloat(imdb) : Number.NaN;
  if (Number.isFinite(imdbValue) && imdbValue > 0) return imdbValue;

  return undefined;
}

function formatDuration(runtime?: number, duration?: string): string | undefined {
  if (runtime && runtime > 0) {
    const hours = Math.floor(runtime / 60);
    const minutes = runtime % 60;
    if (hours > 0) return `${hours}ч ${minutes}м`;
    return `${minutes}м`;
  }

  if (!duration) return undefined;

  const [hours = '0', minutes = '0'] = duration.split(':');
  const h = Number.parseInt(hours, 10);
  const m = Number.parseInt(minutes, 10);
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м`;
  return undefined;
}

function uniqueUrls(...groups: Array<string | string[] | null | undefined>): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    const list = Array.isArray(group) ? group : group ? [group] : [];
    for (const raw of list) {
      const url = raw.trim();
      if (!url || seen.has(url)) {
        continue;
      }
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}

function mapBackdropGallery(details: VokinoChannelItem['details']): {
  backdrop: string;
  backdrops: string[];
} {
  const pattern = details.bg_poster?.pattern;
  const fromIds = (details.bg_poster?.ids ?? []).map((id) => {
    if (!pattern || typeof id !== 'string' || !id) {
      return '';
    }
    return pattern.replace(/\{id\}/g, id);
  });

  const gallery = uniqueUrls(details.bg_poster?.backdrop, fromIds);
  const backdrop = gallery[0] ?? details.wide_poster ?? details.poster ?? '';

  return {
    backdrop,
    backdrops: gallery.length > 0 ? gallery : backdrop ? [backdrop] : [],
  };
}

export function mapChannelItem(channel: VokinoChannelItem): MediaItem | null {
  if (!channel?.details?.id) {
    return null;
  }

  const details = channel.details;

  return applyMediaOverrides(
    {
    id: details.id,
    title: details.name,
    subtitle:
      details.originalname && details.originalname !== details.name
        ? details.originalname
        : undefined,
    year: details.released,
    type: resolveMediaTypeFromDetails(details.type, details.is_tv) ?? details.type,
    genres: details.genre
      ? details.genre.split(',').map((genre) => genre.trim()).filter(Boolean)
      : [],
    rating: parseRating(details.rating_kp, details.rating_imdb),
    duration: formatDuration(details.runtime, details.duration),
    description: details.about,
    poster: details.poster ?? '',
    ...mapBackdropGallery(details),
    logo: details.logo_poster || undefined,
    viewUrl: channel.playlist_url,
    country: details.country,
    director: details.director,
    age: details.age,
    trailerUrl: details.trailer_url ? resolveVokinoUrl(details.trailer_url) : undefined,
    },
    getMediaOverrides(),
  );
}

export function mapVokinoChannelToMediaItem(channel: VokinoChannelItem): MediaItem {
  const item = mapChannelItem(channel);
  if (!item) {
    throw new Error('Invalid Vokino channel item');
  }
  return item;
}

function mapRelatedChannels(
  itemId: string,
  channels: VokinoChannelItem[] | 0 | undefined,
): MediaItem[] {
  if (!Array.isArray(channels) || channels.length === 0) {
    return [];
  }

  return channels
    .map(mapChannelItem)
    .filter((row): row is MediaItem => row != null && row.id !== itemId);
}

export function attachViewRelations(
  item: MediaItem,
  sequelsAndPrequels: VokinoChannelItem[] | 0 | undefined,
  similars: VokinoChannelItem[] | 0 | undefined,
): MediaItem {
  const related = mapRelatedChannels(item.id, sequelsAndPrequels).sort(
    (left, right) => (left.year ?? 99999) - (right.year ?? 99999),
  );

  return {
    ...item,
    related,
    similars: mapRelatedChannels(item.id, similars),
  };
}

export function getMediaTypeLabel(type: MediaType): string {
  switch (normalizeMediaType(type) ?? type) {
    case 'movie':
      return 'Фильм';
    case 'serial':
      return 'Сериал';
    case 'multfilm':
      return 'Мультфильм';
    case 'multserial':
      return 'Мультсериал';
    case 'anime':
      return 'Аниме';
    default:
      return 'Контент';
  }
}

export function isMovieMedia(item: Pick<MediaItem, 'type'>): boolean {
  return isMovieMediaType(item.type);
}

export function isSerialMedia(item: Pick<MediaItem, 'type'>): boolean {
  return isSerialMediaType(item.type);
}
