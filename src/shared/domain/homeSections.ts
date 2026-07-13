import type { ContentRow } from '@/shared/domain/media';
import type { HiddenHomeSection, HomeFavoritesSectionMode } from '@/shared/settings/types';

export const HOME_FAVORITES_SECTION_ID = '__home_favorites__';
export const HOME_FAVORITES_SECTION_TITLE = 'Избранное';
export const HOME_FAVORITES_AUTO_MIN_COUNT = 3;

export const HOME_RECENTLY_VIEWED_SECTION_ID = '__home_recently_viewed__';
export const HOME_RECENTLY_VIEWED_SECTION_TITLE = 'История просмотров';
export const HOME_RECENTLY_VIEWED_AUTO_MIN_COUNT = 3;

export const HOME_SERIAL_UPDATES_SECTION_ID = '__home_serial_updates__';
export const HOME_SERIAL_UPDATES_SECTION_TITLE = 'Обновление сериалов';

export const HOME_MOVIE_UPDATES_SECTION_ID = '__home_movie_updates__';
export const HOME_MOVIE_UPDATES_SECTION_TITLE = 'Обновление фильмов';

export const HOME_MULTFILM_SECTION_ID = '__home_multfilm__';
export const HOME_MULTFILM_SECTION_TITLE = 'Мультфильмы';

export const HOME_TOP250_SECTION_ID = '__home_top250__';
export const HOME_TOP250_SECTION_TITLE = 'Топ 250';

export const DEFAULT_HIDDEN_BUILTIN_HOME_SECTIONS: HiddenHomeSection[] = [
  { id: HOME_SERIAL_UPDATES_SECTION_ID, title: HOME_SERIAL_UPDATES_SECTION_TITLE },
  { id: HOME_MOVIE_UPDATES_SECTION_ID, title: HOME_MOVIE_UPDATES_SECTION_TITLE },
  { id: HOME_MULTFILM_SECTION_ID, title: HOME_MULTFILM_SECTION_TITLE },
];

export function isHomeFavoritesSectionId(id: string): boolean {
  return id === HOME_FAVORITES_SECTION_ID;
}

export function isHomeRecentlyViewedSectionId(id: string): boolean {
  return id === HOME_RECENTLY_VIEWED_SECTION_ID;
}

export function isBuiltinUpdatesHomeSectionId(id: string): boolean {
  return id === HOME_SERIAL_UPDATES_SECTION_ID || id === HOME_MOVIE_UPDATES_SECTION_ID;
}

export function isBuiltinMultfilmHomeSectionId(id: string): boolean {
  return id === HOME_MULTFILM_SECTION_ID;
}

export function isBuiltinTop250HomeSectionId(id: string): boolean {
  return id === HOME_TOP250_SECTION_ID;
}

export function isTop250HomeRow(row: Pick<ContentRow, 'id'>): boolean {
  return row.id === HOME_TOP250_SECTION_ID;
}

export function isBuiltinHomeSectionId(id: string): boolean {
  return (
    isBuiltinUpdatesHomeSectionId(id) ||
    isBuiltinMultfilmHomeSectionId(id) ||
    isBuiltinTop250HomeSectionId(id)
  );
}

export function isMoviesHomeRow(row: Pick<ContentRow, 'title' | 'playlistUrl'>): boolean {
  return /^фильмы$/i.test(row.title.trim()) && row.playlistUrl.includes('type=movie');
}

export function isSerialsHomeRow(row: Pick<ContentRow, 'title' | 'playlistUrl'>): boolean {
  return /^сериалы$/i.test(row.title.trim()) && row.playlistUrl.includes('type=serial');
}

export function isDefaultHiddenCatalogHomeRow(
  row: Pick<ContentRow, 'title' | 'playlistUrl'>,
): boolean {
  return isMoviesHomeRow(row) || isSerialsHomeRow(row);
}

export function isTrendingHomeRow(row: Pick<ContentRow, 'title' | 'playlistUrl'>): boolean {
  return (
    /тренд/i.test(row.title) ||
    (row.playlistUrl.includes('sort=popular') && !row.playlistUrl.includes('type='))
  );
}

export function addHiddenHomeSection(
  hidden: HiddenHomeSection[],
  section: HiddenHomeSection,
): HiddenHomeSection[] {
  if (hidden.some((item) => item.id === section.id)) {
    return hidden;
  }

  return [...hidden, section];
}

export function removeHiddenHomeSection(
  hidden: HiddenHomeSection[],
  id: string,
): HiddenHomeSection[] {
  return hidden.filter((item) => item.id !== id);
}

export function hideHomeSection(
  hidden: HiddenHomeSection[],
  restoreOrder: string[],
  section: HiddenHomeSection,
): { hiddenHomeSections: HiddenHomeSection[]; homeSectionRestoreOrder: string[] } {
  return {
    hiddenHomeSections: addHiddenHomeSection(hidden, section),
    homeSectionRestoreOrder: restoreOrder.filter((itemId) => itemId !== section.id),
  };
}

export function restoreHomeSection(
  hidden: HiddenHomeSection[],
  restoreOrder: string[],
  id: string,
): { hiddenHomeSections: HiddenHomeSection[]; homeSectionRestoreOrder: string[] } {
  const nextHidden = removeHiddenHomeSection(hidden, id);

  if (restoreOrder.includes(id)) {
    return {
      hiddenHomeSections: nextHidden,
      homeSectionRestoreOrder: restoreOrder,
    };
  }

  return {
    hiddenHomeSections: nextHidden,
    homeSectionRestoreOrder: [...restoreOrder, id],
  };
}

export function orderVisibleHomeRows(
  rows: ContentRow[],
  hiddenIds: ReadonlySet<string>,
  restoreOrder: string[],
): ContentRow[] {
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const trending = rows.filter((row) => isTrendingHomeRow(row) && !hiddenIds.has(row.id));

  const activeRestoreOrder = restoreOrder.filter(
    (id) => !hiddenIds.has(id) && rowById.has(id),
  );
  const restoredIds = new Set(activeRestoreOrder);
  const restored = activeRestoreOrder
    .map((id) => rowById.get(id))
    .filter((row): row is ContentRow => row !== undefined);

  const natural = rows.filter(
    (row) =>
      !isTrendingHomeRow(row) && !hiddenIds.has(row.id) && !restoredIds.has(row.id),
  );

  return [...trending, ...natural, ...restored];
}

export function shouldShowHomeFavoritesSection(
  mode: HomeFavoritesSectionMode,
  favoritesCount: number,
  hiddenIds: ReadonlySet<string>,
): boolean {
  if (favoritesCount === 0) {
    return false;
  }

  if (hiddenIds.has(HOME_FAVORITES_SECTION_ID)) {
    return false;
  }

  if (mode === 'off') {
    return false;
  }

  if (mode === 'on') {
    return true;
  }

  return favoritesCount > HOME_FAVORITES_AUTO_MIN_COUNT;
}

export function shouldShowHomeRecentlyViewedSection(
  mode: HomeFavoritesSectionMode,
  recentlyViewedCount: number,
  hiddenIds: ReadonlySet<string>,
): boolean {
  if (recentlyViewedCount === 0) {
    return false;
  }

  if (hiddenIds.has(HOME_RECENTLY_VIEWED_SECTION_ID)) {
    return false;
  }

  if (mode === 'off') {
    return false;
  }

  if (mode === 'on') {
    return true;
  }

  return recentlyViewedCount > HOME_RECENTLY_VIEWED_AUTO_MIN_COUNT;
}

export function getEffectiveHiddenHomeSections(
  hidden: HiddenHomeSection[],
  restoreOrder: string[],
  rows: ReadonlyArray<Pick<ContentRow, 'id' | 'title' | 'playlistUrl'>> = [],
): HiddenHomeSection[] {
  let result = hidden;

  for (const section of DEFAULT_HIDDEN_BUILTIN_HOME_SECTIONS) {
    const isRestored = restoreOrder.includes(section.id);
    const isHidden = result.some((item) => item.id === section.id);

    if (!isRestored && !isHidden) {
      result = addHiddenHomeSection(result, section);
    }
  }

  for (const row of rows) {
    if (isDefaultHiddenCatalogHomeRow(row) && !restoreOrder.includes(row.id)) {
      result = addHiddenHomeSection(result, { id: row.id, title: row.title });
    }
  }

  return result;
}

export function getHiddenHomeSectionIds(
  hidden: HiddenHomeSection[],
  restoreOrder: string[],
  rows: ReadonlyArray<Pick<ContentRow, 'id' | 'title' | 'playlistUrl'>> = [],
): Set<string> {
  return new Set(getEffectiveHiddenHomeSections(hidden, restoreOrder, rows).map((section) => section.id));
}

export function migrateBuiltinHiddenHomeSections(settings: {
  hiddenHomeSections: HiddenHomeSection[];
  homeSectionRestoreOrder: string[];
}): {
  hiddenHomeSections: HiddenHomeSection[];
  homeSectionRestoreOrder: string[];
  changed: boolean;
} {
  const hiddenHomeSections = getEffectiveHiddenHomeSections(
    settings.hiddenHomeSections,
    settings.homeSectionRestoreOrder,
  );

  const changed =
    hiddenHomeSections.length !== settings.hiddenHomeSections.length ||
    hiddenHomeSections.some(
      (section, index) => settings.hiddenHomeSections[index]?.id !== section.id,
    );

  return {
    hiddenHomeSections,
    homeSectionRestoreOrder: settings.homeSectionRestoreOrder,
    changed,
  };
}
