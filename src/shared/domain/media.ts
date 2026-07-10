import type { VokinoChannelItem } from '@/shared/api/vokino/types';
import { applyMediaOverrides } from '@/shared/domain/overrides';
import { getMediaOverrides } from '@/shared/domain/overridesStore';

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
  logo?: string;
  viewUrl: string;
  country?: string;
  director?: string;
  age?: number;
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
    type: details.type,
    genres: details.genre
      ? details.genre.split(',').map((genre) => genre.trim()).filter(Boolean)
      : [],
    rating: parseRating(details.rating_kp, details.rating_imdb),
    duration: formatDuration(details.runtime, details.duration),
    description: details.about,
    poster: details.poster ?? '',
    backdrop: details.bg_poster?.backdrop ?? details.wide_poster ?? details.poster ?? '',
    viewUrl: channel.playlist_url,
    country: details.country,
    director: details.director,
    age: details.age,
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

export function getMediaTypeLabel(type: MediaType): string {
  switch (type) {
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
  return item.type === 'movie' || item.type === 'multfilm';
}

export function isSerialMedia(item: Pick<MediaItem, 'type'>): boolean {
  return item.type === 'serial' || item.type === 'multserial' || item.type === 'anime';
}
