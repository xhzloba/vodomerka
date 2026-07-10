import type {
  AppSettings,
  CatalogRowGapPreset,
  HiddenHomeSection,
  HomeSectionMode,
  SidebarMenuAnimation,
} from '../../../contracts/ipc';

export type {
  AppSettings,
  AppTheme,
  CatalogRowGapPreset,
  HiddenHomeSection,
  HomeSectionMode as HomeFavoritesSectionMode,
  SidebarMenuAnimation,
} from '../../../contracts/ipc';

type HomeFavoritesSectionMode = HomeSectionMode;

export const CATALOG_ROW_GAP_OPTIONS: Array<{ id: CatalogRowGapPreset; label: string }> = [
  { id: 'compact', label: 'Компактно' },
  { id: 'normal', label: 'Стандарт' },
  { id: 'relaxed', label: 'Свободно' },
  { id: 'spacious', label: 'Просторно' },
];

export const CATALOG_GAP_VALUES: Record<CatalogRowGapPreset, { row: number; column: number }> = {
  compact: { row: 12, column: 10 },
  normal: { row: 20, column: 16 },
  relaxed: { row: 28, column: 22 },
  spacious: { row: 36, column: 28 },
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'obsidian',
  heroEnabled: true,
  heroAutoSlide: true,
  heroSlideIntervalSec: 5,
  cardShowInfo: false,
  catalogRowGap: 'normal',
  sidebarCollapsed: false,
  sidebarMenuAnimation: 'liquid',
  hiddenHomeSections: [
    { id: '__home_serial_updates__', title: 'Обновление сериалов' },
    { id: '__home_movie_updates__', title: 'Обновление фильмов' },
    { id: '__home_multfilm__', title: 'Мультфильмы' },
  ],
  homeSectionRestoreOrder: [],
  homeFavoritesSection: 'auto',
  homeRecentlyViewedSection: 'auto',
  setupWelcomeDismissed: false,
  autoTipsEnabled: true,
  dismissedTipIds: [],
  tipShownAt: {},
};

export const HERO_SLIDE_INTERVAL_MIN_SEC = 3;
export const HERO_SLIDE_INTERVAL_MAX_SEC = 120;

export function clampHeroSlideIntervalSec(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_APP_SETTINGS.heroSlideIntervalSec;
  }

  return Math.min(HERO_SLIDE_INTERVAL_MAX_SEC, Math.max(HERO_SLIDE_INTERVAL_MIN_SEC, value));
}

export function normalizeCatalogRowGap(value: unknown): CatalogRowGapPreset {
  if (value === 'compact' || value === 'relaxed' || value === 'spacious') {
    return value;
  }

  return DEFAULT_APP_SETTINGS.catalogRowGap;
}

export function normalizeSidebarMenuAnimation(value: unknown): SidebarMenuAnimation {
  if (value === 'snake') {
    return 'snake';
  }

  return DEFAULT_APP_SETTINGS.sidebarMenuAnimation;
}

export function normalizeHiddenHomeSections(value: unknown): HiddenHomeSection[] {
  if (!Array.isArray(value)) {
    return DEFAULT_APP_SETTINGS.hiddenHomeSections;
  }

  return value.filter(
    (item): item is HiddenHomeSection =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'string' &&
      item.id.length > 0 &&
      typeof item.title === 'string' &&
      item.title.length > 0,
  );
}

export function normalizeHomeSectionRestoreOrder(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return DEFAULT_APP_SETTINGS.homeSectionRestoreOrder;
  }

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

export function normalizeHomeFavoritesSection(value: unknown): HomeFavoritesSectionMode {
  if (value === 'on' || value === 'off') {
    return value;
  }

  return DEFAULT_APP_SETTINGS.homeFavoritesSection;
}

export function normalizeHomeRecentlyViewedSection(value: unknown): HomeFavoritesSectionMode {
  if (value === 'on' || value === 'off') {
    return value;
  }

  return DEFAULT_APP_SETTINGS.homeRecentlyViewedSection;
}

export function normalizeDismissedTipIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return DEFAULT_APP_SETTINGS.dismissedTipIds;
  }

  return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export function normalizeTipShownAt(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') {
    return DEFAULT_APP_SETTINGS.tipShownAt;
  }

  const result: Record<string, number> = {};

  for (const [key, timestamp] of Object.entries(value)) {
    if (typeof key === 'string' && key.length > 0 && typeof timestamp === 'number' && Number.isFinite(timestamp)) {
      result[key] = timestamp;
    }
  }

  return result;
}

export const HOME_FAVORITES_SECTION_MODE_OPTIONS: Array<{
  id: HomeFavoritesSectionMode;
  label: string;
  hint: string;
}> = [
  { id: 'auto', label: 'Авто', hint: 'Показывать, если больше 3' },
  { id: 'on', label: 'Всегда', hint: 'Показывать при любом количестве' },
  { id: 'off', label: 'Скрыто', hint: 'Не показывать на главной' },
];

export const HOME_RECENTLY_VIEWED_SECTION_MODE_OPTIONS = HOME_FAVORITES_SECTION_MODE_OPTIONS;

export const SIDEBAR_MENU_ANIMATION_OPTIONS: Array<{
  id: SidebarMenuAnimation;
  label: string;
  hint: string;
}> = [
  {
    id: 'liquid',
    label: 'Жидкое свечение',
    hint: 'Плавное свечение и пузырьки на активном пункте',
  },
  {
    id: 'snake',
    label: 'Змейка',
    hint: 'Вращающаяся рамка как на карточках',
  },
];
