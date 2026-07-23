import type {
  ApiServerId,
  AppSettings,
  CatalogRowGapPreset,
  HiddenHomeSection,
  HomeSectionMode,
  PosterSizePreset,
  SidebarMenuAnimation,
  SidebarStyle,
} from '../../../contracts/ipc';

export type {
  ApiServerId,
  AppSettings,
  AppTheme,
  CatalogRowGapPreset,
  HiddenHomeSection,
  HomeSectionMode as HomeFavoritesSectionMode,
  PosterSizePreset,
  SidebarMenuAnimation,
  SidebarStyle,
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

export const POSTER_SIZE_OPTIONS: Array<{ id: PosterSizePreset; label: string; hint: string }> = [
  { id: 'small', label: 'Маленькие', hint: 'Больше карточек в ряду и сетке' },
  { id: 'medium', label: 'Средние', hint: 'Текущий размер по умолчанию' },
  { id: 'large', label: 'Большие', hint: 'Крупные постеры, меньше в ряду' },
];

export const POSTER_SIZE_VALUES: Record<PosterSizePreset, { cardWidth: number; gridMin: number }> = {
  small: { cardWidth: 140, gridMin: 132 },
  medium: { cardWidth: 180, gridMin: 168 },
  large: { cardWidth: 220, gridMin: 200 },
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'obsidian',
  heroEnabled: true,
  heroAutoSlide: true,
  heroSlideIntervalSec: 5,
  heroSourceSectionIds: [],
  cardShowInfo: false,
  catalogRowGap: 'normal',
  posterSize: 'medium',
  sidebarCollapsed: false,
  sidebarMenuAnimation: 'magnetic-water',
  sidebarStyle: 'apple',
  hiddenHomeSections: [
    { id: '__home_serial_updates__', title: 'Обновление сериалов' },
    { id: '__home_movie_updates__', title: 'Обновление фильмов' },
    { id: '__home_multfilm__', title: 'Мультфильмы' },
  ],
  hiddenMediatekaItemIds: [],
  homeSectionRestoreOrder: [],
  homeFavoritesSection: 'auto',
  homeRecentlyViewedSection: 'auto',
  setupWelcomeDismissed: false,
  browseCategoryHintDismissed: false,
  autoTipsEnabled: true,
  uiSoundsEnabled: true,
  dismissedTipIds: [],
  tipShownAt: {},
  apiServer: '1',
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

export function normalizePosterSize(value: unknown): PosterSizePreset {
  if (value === 'small' || value === 'large') {
    return value;
  }

  return DEFAULT_APP_SETTINGS.posterSize;
}

export function applyPosterSizeCssVars(posterSize: PosterSizePreset): void {
  const values = POSTER_SIZE_VALUES[posterSize];
  const root = document.documentElement;
  root.style.setProperty('--media-card-width', `${values.cardWidth}px`);
  root.style.setProperty('--media-grid-min', `${values.gridMin}px`);
}

export function normalizeSidebarMenuAnimation(value: unknown): SidebarMenuAnimation {
  if (typeof value === 'string' && /^[a-z][a-z0-9-]{1,47}$/.test(value)) {
    if (value === 'orbit' || value === 'comet' || value === 'pearl') {
      return DEFAULT_APP_SETTINGS.sidebarMenuAnimation;
    }

    return value;
  }

  return DEFAULT_APP_SETTINGS.sidebarMenuAnimation;
}

export function normalizeSidebarStyle(value: unknown): SidebarStyle {
  if (value === 'apple' || value === 'default') {
    return value;
  }

  return DEFAULT_APP_SETTINGS.sidebarStyle;
}

export const SIDEBAR_STYLE_OPTIONS: Array<{
  id: SidebarStyle;
  label: string;
  hint: string;
}> = [
  {
    id: 'apple',
    label: 'Системный',
    hint: 'Как в настройках macOS: скругления, фон или обводка',
  },
  {
    id: 'default',
    label: 'Классика',
    hint: 'Текущий прозрачный сайдбар',
  },
];

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

export function normalizeHeroSourceSectionIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return DEFAULT_APP_SETTINGS.heroSourceSectionIds;
  }

  for (const item of value) {
    if (typeof item === 'string' && item.length > 0) {
      return [item];
    }
  }

  return DEFAULT_APP_SETTINGS.heroSourceSectionIds;
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

export function normalizeApiServer(value: unknown): ApiServerId {
  if (value === '2') {
    return '2';
  }

  return DEFAULT_APP_SETTINGS.apiServer;
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

export const API_SERVER_OPTIONS: Array<{
  id: ApiServerId;
  label: string;
  hint: string;
}> = [
  {
    id: '1',
    label: 'Сервер 1',
    hint: 'Основной',
  },
  {
    id: '2',
    label: 'Сервер 2',
    hint: 'Запасной',
  },
];

export const SIDEBAR_MENU_ANIMATION_OPTIONS: Array<{
  id: SidebarMenuAnimation;
  label: string;
  hint: string;
}> = [
  {
    id: 'highlight',
    label: 'Выделение',
    hint: 'Мягкая подложка активного пункта, как в боковом меню Apple',
  },
  {
    id: 'magnetic-water',
    label: 'Водяной магнит',
    hint: 'Жидкая подложка с пузырьками, плавно переезжает между пунктами',
  },
];
