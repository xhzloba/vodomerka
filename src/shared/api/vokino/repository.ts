import type { ContentRow, MediaItem } from '@/shared/domain/media';
import { isMovieMedia, isSerialMedia, mapChannelItem } from '@/shared/domain/media';
import { ensureMediaOverridesLoaded, hydrateMediaItems } from '@/shared/domain/overridesStore';
import {
  HOME_MOVIE_UPDATES_SECTION_ID,
  HOME_MOVIE_UPDATES_SECTION_TITLE,
  HOME_MULTFILM_SECTION_ID,
  HOME_MULTFILM_SECTION_TITLE,
  HOME_SERIAL_UPDATES_SECTION_ID,
  HOME_SERIAL_UPDATES_SECTION_TITLE,
  HOME_TOP250_SECTION_ID,
  HOME_TOP250_SECTION_TITLE,
  isBuiltinHomeSectionId,
} from '@/shared/domain/homeSections';
import { httpGet } from '@/shared/api/httpClient';
import { getTop250PlaylistUrl } from '@/shared/api/vokino/top250';
import { HOME_ROW_LIMIT, HOME_TRENDING_ROW_LIMIT, resolveVokinoUrl } from '@/shared/config/api';
import { getVokinoMainUrl } from '@/shared/api/vokino/endpoints';
import type {
  VokinoCategory,
  VokinoListResponse,
  VokinoMainResponse,
  VokinoMainSection,
} from '@/shared/api/vokino/types';

export interface HomePageData {
  featured: MediaItem | null;
  rows: ContentRow[];
  categories: VokinoCategory[];
}

const HOME_UPDATES_FETCH_LIMIT = HOME_ROW_LIMIT * 4;

function getHomeUpdatesPlaylistUrl(): string {
  return resolveVokinoUrl('/list?sort=updatings&display=grid');
}

function getHomeMultfilmPlaylistUrl(): string {
  return resolveVokinoUrl('/list?sort=popular&type=multfilm');
}

function isExcludedHomeRow(row: ContentRow): boolean {
  if (isBuiltinHomeSectionId(row.id)) {
    return false;
  }

  return row.playlistUrl.includes('sort=updatings') || /обновления/i.test(row.title);
}

export function sanitizeHomePageData(data: HomePageData): HomePageData {
  const rows = data.rows.filter((row) => !isExcludedHomeRow(row));

  return hydrateHomePageData({
    ...data,
    rows,
    featured: rows[0]?.items[0] ?? data.featured,
  });
}

export function hydrateHomePageData(data: HomePageData): HomePageData {
  return {
    ...data,
    featured: data.featured ? hydrateMediaItems([data.featured])[0] : null,
    rows: data.rows.map((row) => ({
      ...row,
      items: hydrateMediaItems(row.items),
    })),
  };
}

function normalizePlaylistUrl(url: string): string {
  return new URL(url).href;
}

function isHomeSection(section: VokinoMainSection): boolean {
  return (
    section.is_present !== false &&
    !section.playlist_url.includes('continue-watching') &&
    !section.playlist_url.includes('sort=updatings') &&
    !section.playlist_url.includes('type=multfilm') &&
    !/обновления/i.test(section.title)
  );
}

function isTrendingSection(section: VokinoMainSection): boolean {
  return (
    /тренд/i.test(section.title) ||
    (section.playlist_url.includes('sort=popular') && !section.playlist_url.includes('type='))
  );
}

function isWatchingSection(section: VokinoMainSection): boolean {
  return (
    section.playlist_url.includes('sort=watching') ||
    /просматриваемых|топ\s*100/i.test(section.title)
  );
}

function getHomeSectionTitle(section: VokinoMainSection): string {
  if (isWatchingSection(section)) {
    return 'Сейчас смотрят';
  }

  return section.title;
}

function sortHomeSections(sections: VokinoMainSection[]): VokinoMainSection[] {
  const trending = sections.filter(isTrendingSection);
  const watching = sections.filter(isWatchingSection);
  const rest = sections.filter(
    (section) => !isTrendingSection(section) && !isWatchingSection(section),
  );

  return [...trending, ...watching, ...rest];
}

function sortHomeRows(rows: ContentRow[]): ContentRow[] {
  const priority = (row: ContentRow): number => {
    if (row.playlistUrl.includes('sort=popular') && !row.playlistUrl.includes('type=')) {
      return 0;
    }
    if (row.playlistUrl.includes('sort=watching') || row.title === 'Сейчас смотрят') {
      return 1;
    }
    if (row.id === HOME_TOP250_SECTION_ID) {
      return 2;
    }
    return 3;
  };

  return [...rows]
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const byPriority = priority(a.row) - priority(b.row);
      return byPriority !== 0 ? byPriority : a.index - b.index;
    })
    .map(({ row }) => row);
}

class VokinoRepository {
  private mainCache: VokinoMainResponse | null = null;
  private playlistCache = new Map<string, MediaItem[]>();

  clearCache() {
    this.mainCache = null;
    this.playlistCache.clear();
  }

  async getMain(force = false): Promise<VokinoMainResponse> {
    if (this.mainCache && !force) {
      return this.mainCache;
    }

    const data = await httpGet<VokinoMainResponse>(getVokinoMainUrl());
    this.mainCache = data;
    return data;
  }

  async getPlaylistItems(
    playlistUrl: string,
    limit = HOME_ROW_LIMIT,
    force = false,
  ): Promise<MediaItem[]> {
    const cacheKey = normalizePlaylistUrl(playlistUrl);

    if (!force) {
      const cached = this.playlistCache.get(cacheKey);
      if (cached) {
        return hydrateMediaItems(cached).slice(0, limit);
      }
    }

    const data = await httpGet<VokinoListResponse>(cacheKey);
    await ensureMediaOverridesLoaded();
    const channels = data.channels ?? [];
    const items = hydrateMediaItems(
      channels
        .map(mapChannelItem)
        .filter((item): item is MediaItem => item !== null),
    ).slice(0, limit);

    if (items.length > 0) {
      this.playlistCache.set(cacheKey, items);
    } else {
      this.playlistCache.delete(cacheKey);
    }

    return items;
  }

  async getHomePage(): Promise<HomePageData> {
    const main = await this.getMain();
    const sections = sortHomeSections((main.main ?? []).filter(isHomeSection));
    const rows = await this.loadHomeSections(sections);

    const loadedTitles = new Set(rows.map((row) => row.title));
    const missingSections = sections.filter(
      (section) => !loadedTitles.has(getHomeSectionTitle(section)),
    );

    if (missingSections.length > 0) {
      missingSections.forEach((section) => {
        this.playlistCache.delete(normalizePlaylistUrl(section.playlist_url));
      });

      const retriedRows = await this.loadHomeSections(missingSections, true);
      rows.push(...retriedRows);
    }

    const visibleRows = sortHomeRows(
      rows.filter((row) => row.items.length > 0 && !isExcludedHomeRow(row)),
    );
    const multfilmRow = await this.loadHomeMultfilmSection();
    const top250Row = await this.loadHomeTop250Section();
    const updatesRows = await this.loadHomeUpdatesSections();
    const mergedRows = sortHomeRows([
      ...visibleRows,
      ...(top250Row ? [top250Row] : []),
      ...(multfilmRow ? [multfilmRow] : []),
      ...updatesRows,
    ]);
    const featured = mergedRows[0]?.items[0] ?? null;

    return sanitizeHomePageData({
      featured,
      rows: mergedRows,
      categories: main.channels,
    });
  }

  private async loadHomeSections(
    sections: VokinoMainSection[],
    force = false,
  ): Promise<ContentRow[]> {
    const rowResults = await Promise.allSettled(
      sections.map((section) => this.buildContentRow(section, force)),
    );

    if (import.meta.env.DEV) {
      rowResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn(
            `[vokino] row failed: ${sections[index]?.title}`,
            sections[index]?.playlist_url,
            result.reason,
          );
        }
      });
    }

    return rowResults
      .filter((result): result is PromiseFulfilledResult<ContentRow> => result.status === 'fulfilled')
      .map((result) => result.value)
      .filter((row) => row.items.length > 0);
  }

  private async loadHomeMultfilmSection(): Promise<ContentRow | null> {
    const playlistUrl = getHomeMultfilmPlaylistUrl();
    const items = await this.getPlaylistItems(playlistUrl, HOME_ROW_LIMIT);

    if (items.length === 0) {
      return null;
    }

    return {
      id: HOME_MULTFILM_SECTION_ID,
      title: HOME_MULTFILM_SECTION_TITLE,
      playlistUrl,
      items,
    };
  }

  private async loadHomeTop250Section(): Promise<ContentRow | null> {
    const playlistUrl = getTop250PlaylistUrl();
    const items = await this.getPlaylistItems(playlistUrl, HOME_ROW_LIMIT);

    if (items.length === 0) {
      return null;
    }

    return {
      id: HOME_TOP250_SECTION_ID,
      title: HOME_TOP250_SECTION_TITLE,
      playlistUrl,
      items,
    };
  }

  private async loadHomeUpdatesSections(): Promise<ContentRow[]> {
    const playlistUrl = getHomeUpdatesPlaylistUrl();
    const items = await this.getPlaylistItems(playlistUrl, HOME_UPDATES_FETCH_LIMIT);
    const serials = items.filter(isSerialMedia).slice(0, HOME_ROW_LIMIT);
    const movies = items.filter(isMovieMedia).slice(0, HOME_ROW_LIMIT);
    const rows: ContentRow[] = [];

    if (serials.length > 0) {
      rows.push({
        id: HOME_SERIAL_UPDATES_SECTION_ID,
        title: HOME_SERIAL_UPDATES_SECTION_TITLE,
        playlistUrl,
        items: serials,
      });
    }

    if (movies.length > 0) {
      rows.push({
        id: HOME_MOVIE_UPDATES_SECTION_ID,
        title: HOME_MOVIE_UPDATES_SECTION_TITLE,
        playlistUrl,
        items: movies,
      });
    }

    return rows;
  }

  private async buildContentRow(
    section: VokinoMainSection,
    force = false,
  ): Promise<ContentRow> {
    const limit = isTrendingSection(section) ? HOME_TRENDING_ROW_LIMIT : HOME_ROW_LIMIT;
    const items = await this.getPlaylistItems(section.playlist_url, limit, force);

    return {
      id: normalizePlaylistUrl(section.playlist_url),
      title: getHomeSectionTitle(section),
      playlistUrl: section.playlist_url,
      items,
    };
  }
}

export const vokinoRepository = new VokinoRepository();
