export interface VokinoMainSection {
  title: string;
  is_present?: boolean;
  playlist_url: string;
}

export interface VokinoCategory {
  title: string;
  ico?: string;
  is_category?: number;
  playlist_url: string;
}

export interface VokinoCategoryResponse {
  type: 'category';
  channels: VokinoCategory[];
}

export interface VokinoListPage {
  current: number;
  next?: string;
}

export interface VokinoMainResponse {
  type: 'main';
  search: string;
  main: VokinoMainSection[];
  channels: VokinoCategory[];
}

export interface VokinoContentDetails {
  id: string;
  type: string;
  name: string;
  originalname?: string;
  released?: number;
  runtime?: number;
  duration?: string;
  release_date?: string;
  about?: string;
  director?: string;
  country?: string;
  genre?: string;
  poster?: string;
  is_tv?: boolean;
  wide_poster?: string | null;
  logo_poster?: string | null;
  bg_poster?: {
    backdrop?: string;
    ids?: string[];
    pattern?: string;
  } | null;
  ident?: string;
  rating_kp?: string;
  rating_imdb?: string;
  age?: number;
  tags?: string[];
  trailers?: boolean;
}

export interface VokinoChannelItem {
  details: VokinoContentDetails;
  playlist_url: string;
}

export interface VokinoListResponse {
  type: 'list';
  title?: string;
  channels: VokinoChannelItem[];
  page?: VokinoListPage;
}

export interface VokinoTorrentChannel {
  title: string;
  subtitle?: string;
  magnet: string;
  quality?: number | string;
  sizeName?: string;
  size?: number | string;
  voice?: string;
  trackerName?: string;
  sid?: number | string;
  pir?: number | string;
  bitrate?: string;
  createTime?: string;
  seasons?: unknown[];
  videoInfo?: { video?: string; audio?: string };
}

export interface VokinoTorrentsResponse {
  type: 'torrents' | string;
  channels: VokinoTorrentChannel[];
  details?: { poster?: string };
}
