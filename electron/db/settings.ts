import Database from 'better-sqlite3';
import type { AppSettings, AppTheme } from '../../contracts/ipc';
import { getDatabase } from './database';

export type { AppSettings, AppTheme } from '../../contracts/ipc';

export const DEFAULT_SETTINGS: AppSettings = {
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
  hiddenHomeSections: [
    { id: '__home_serial_updates__', title: 'Обновление сериалов' },
    { id: '__home_movie_updates__', title: 'Обновление фильмов' },
    { id: '__home_multfilm__', title: 'Мультфильмы' },
  ],
  homeSectionRestoreOrder: [],
  homeFavoritesSection: 'auto',
  homeRecentlyViewedSection: 'auto',
  setupWelcomeDismissed: false,
  browseCategoryHintDismissed: false,
  autoTipsEnabled: true,
  uiSoundsEnabled: true,
  dismissedTipIds: [],
  tipShownAt: {},
};

const DEFAULT_HIDDEN_BUILTIN_HOME_SECTIONS = DEFAULT_SETTINGS.hiddenHomeSections;

const THEME_BACKGROUNDS: Record<AppTheme, string> = {
  obsidian: '#0a0a0e',
  onyx: '#050508',
  nocturne: '#07060c',
  ember: '#0b0907',
  aurora: '#060a0c',
};

const SETTING_KEYS = {
  theme: 'theme',
  heroEnabled: 'hero_enabled',
  heroAutoSlide: 'hero_auto_slide',
  heroSlideIntervalSec: 'hero_slide_interval_sec',
  heroSourceSectionIds: 'hero_source_section_ids',
  cardShowInfo: 'card_show_info',
  catalogRowGap: 'catalog_row_gap',
  posterSize: 'poster_size',
  sidebarCollapsed: 'sidebar_collapsed',
  sidebarMenuAnimation: 'sidebar_menu_animation',
  hiddenHomeSections: 'hidden_home_sections',
  homeSectionRestoreOrder: 'home_section_restore_order',
  homeFavoritesSection: 'home_favorites_section',
  homeRecentlyViewedSection: 'home_recently_viewed_section',
  setupWelcomeDismissed: 'setup_welcome_dismissed',
  browseCategoryHintDismissed: 'browse_category_hint_dismissed',
  autoTipsEnabled: 'auto_tips_enabled',
  uiSoundsEnabled: 'ui_sounds_enabled',
  dismissedTipIds: 'dismissed_tip_ids',
  tipShownAt: 'tip_shown_at',
} as const;

const LEGACY_CARD_KEYS = ['card_show_title', 'card_show_year', 'card_show_rating'] as const;

function openDatabase() {
  const database = getDatabase();
  seedDefaults(database);
  return database;
}

function seedDefaults(database: Database.Database) {
  migrateSetupWelcomeDismissed(database);

  const insert = database.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (@key, @value)
  `);

  for (const entry of getDefaultSettingEntries()) {
    insert.run(entry);
  }
}

function migrateSetupWelcomeDismissed(database: Database.Database): void {
  const existing = readSetting(database, SETTING_KEYS.setupWelcomeDismissed);
  if (existing !== undefined) {
    return;
  }

  const row = database.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
  if (row.count === 0) {
    return;
  }

  database
    .prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (@key, '1', strftime('%s', 'now'))
    `)
    .run({ key: SETTING_KEYS.setupWelcomeDismissed });
}

function writeDefaultSettings(database: Database.Database) {
  const upsert = database.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (@key, @value, strftime('%s', 'now'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);

  for (const entry of getDefaultSettingEntries()) {
    upsert.run(entry);
  }
}

function getDefaultSettingEntries(): Array<{ key: string; value: string }> {
  return [
    { key: SETTING_KEYS.theme, value: DEFAULT_SETTINGS.theme },
    { key: SETTING_KEYS.heroEnabled, value: DEFAULT_SETTINGS.heroEnabled ? '1' : '0' },
    { key: SETTING_KEYS.heroAutoSlide, value: DEFAULT_SETTINGS.heroAutoSlide ? '1' : '0' },
    {
      key: SETTING_KEYS.heroSlideIntervalSec,
      value: String(DEFAULT_SETTINGS.heroSlideIntervalSec),
    },
    {
      key: SETTING_KEYS.heroSourceSectionIds,
      value: JSON.stringify(DEFAULT_SETTINGS.heroSourceSectionIds),
    },
    { key: SETTING_KEYS.cardShowInfo, value: DEFAULT_SETTINGS.cardShowInfo ? '1' : '0' },
    { key: SETTING_KEYS.catalogRowGap, value: DEFAULT_SETTINGS.catalogRowGap },
    { key: SETTING_KEYS.posterSize, value: DEFAULT_SETTINGS.posterSize },
    {
      key: SETTING_KEYS.sidebarCollapsed,
      value: DEFAULT_SETTINGS.sidebarCollapsed ? '1' : '0',
    },
    {
      key: SETTING_KEYS.sidebarMenuAnimation,
      value: DEFAULT_SETTINGS.sidebarMenuAnimation,
    },
    {
      key: SETTING_KEYS.hiddenHomeSections,
      value: JSON.stringify(DEFAULT_SETTINGS.hiddenHomeSections),
    },
    {
      key: SETTING_KEYS.homeSectionRestoreOrder,
      value: JSON.stringify(DEFAULT_SETTINGS.homeSectionRestoreOrder),
    },
    {
      key: SETTING_KEYS.homeFavoritesSection,
      value: DEFAULT_SETTINGS.homeFavoritesSection,
    },
    {
      key: SETTING_KEYS.homeRecentlyViewedSection,
      value: DEFAULT_SETTINGS.homeRecentlyViewedSection,
    },
    {
      key: SETTING_KEYS.setupWelcomeDismissed,
      value: DEFAULT_SETTINGS.setupWelcomeDismissed ? '1' : '0',
    },
    {
      key: SETTING_KEYS.browseCategoryHintDismissed,
      value: DEFAULT_SETTINGS.browseCategoryHintDismissed ? '1' : '0',
    },
    {
      key: SETTING_KEYS.autoTipsEnabled,
      value: DEFAULT_SETTINGS.autoTipsEnabled ? '1' : '0',
    },
    {
      key: SETTING_KEYS.uiSoundsEnabled,
      value: DEFAULT_SETTINGS.uiSoundsEnabled ? '1' : '0',
    },
    {
      key: SETTING_KEYS.dismissedTipIds,
      value: JSON.stringify(DEFAULT_SETTINGS.dismissedTipIds),
    },
    {
      key: SETTING_KEYS.tipShownAt,
      value: JSON.stringify(DEFAULT_SETTINGS.tipShownAt),
    },
  ];
}

function readSetting(database: Database.Database, key: string): string | undefined {
  const row = database.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;

  return row?.value;
}

function readCardShowInfo(database: Database.Database): boolean {
  const cardShowInfoRaw = readSetting(database, SETTING_KEYS.cardShowInfo);
  if (cardShowInfoRaw !== undefined) {
    return cardShowInfoRaw !== '0';
  }

  const legacyValues = LEGACY_CARD_KEYS.map((key) => readSetting(database, key));
  if (legacyValues.some((value) => value !== undefined)) {
    return legacyValues.every((value) => value !== '0');
  }

  return DEFAULT_SETTINGS.cardShowInfo;
}

function normalizeTheme(value: string | undefined): AppTheme {
  if (
    value === 'onyx' ||
    value === 'nocturne' ||
    value === 'ember' ||
    value === 'aurora'
  ) {
    return value;
  }

  return DEFAULT_SETTINGS.theme;
}

export function getThemeBackgroundColor(theme: AppTheme): string {
  return THEME_BACKGROUNDS[theme];
}

function normalizeHomeFavoritesSection(value: string | undefined): AppSettings['homeFavoritesSection'] {
  if (value === 'on' || value === 'off') {
    return value;
  }

  return DEFAULT_SETTINGS.homeFavoritesSection;
}

function normalizeHomeRecentlyViewedSection(
  value: string | undefined,
): AppSettings['homeRecentlyViewedSection'] {
  if (value === 'on' || value === 'off') {
    return value;
  }

  return DEFAULT_SETTINGS.homeRecentlyViewedSection;
}

function normalizeCatalogRowGap(value: string | undefined): AppSettings['catalogRowGap'] {
  if (value === 'compact' || value === 'relaxed' || value === 'spacious') {
    return value;
  }

  return DEFAULT_SETTINGS.catalogRowGap;
}

function normalizePosterSize(value: string | undefined): AppSettings['posterSize'] {
  if (value === 'small' || value === 'large') {
    return value;
  }

  return DEFAULT_SETTINGS.posterSize;
}

function normalizeSidebarMenuAnimation(
  value: string | undefined,
): AppSettings['sidebarMenuAnimation'] {
  if (
    value === 'liquid' ||
    value === 'snake' ||
    value === 'magnetic' ||
    value === 'magnetic-water' ||
    value === 'edge-pulse'
  ) {
    return value;
  }

  if (value === 'orbit' || value === 'comet' || value === 'pearl') {
    return 'magnetic-water';
  }

  return DEFAULT_SETTINGS.sidebarMenuAnimation;
}

function normalizeHiddenHomeSectionsArray(
  value: AppSettings['hiddenHomeSections'],
): AppSettings['hiddenHomeSections'] {
  return value.filter(
    (item): item is AppSettings['hiddenHomeSections'][number] =>
      typeof item.id === 'string' &&
      item.id.length > 0 &&
      typeof item.title === 'string' &&
      item.title.length > 0,
  );
}

function parseHiddenHomeSections(value: string | undefined): AppSettings['hiddenHomeSections'] {
  if (!value) {
    return DEFAULT_SETTINGS.hiddenHomeSections;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return DEFAULT_SETTINGS.hiddenHomeSections;
    }

    return normalizeHiddenHomeSectionsArray(
      parsed as AppSettings['hiddenHomeSections'],
    );
  } catch {
    return DEFAULT_SETTINGS.hiddenHomeSections;
  }
}

function parseHomeSectionRestoreOrder(value: string | undefined): AppSettings['homeSectionRestoreOrder'] {
  if (!value) {
    return DEFAULT_SETTINGS.homeSectionRestoreOrder;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return DEFAULT_SETTINGS.homeSectionRestoreOrder;
    }

    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
  } catch {
    return DEFAULT_SETTINGS.homeSectionRestoreOrder;
  }
}

function parseHeroSourceSectionIds(value: string | undefined): AppSettings['heroSourceSectionIds'] {
  if (!value) {
    return DEFAULT_SETTINGS.heroSourceSectionIds;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return DEFAULT_SETTINGS.heroSourceSectionIds;
    }

    for (const item of parsed) {
      if (typeof item === 'string' && item.length > 0) {
        return [item];
      }
    }

    return DEFAULT_SETTINGS.heroSourceSectionIds;
  } catch {
    return DEFAULT_SETTINGS.heroSourceSectionIds;
  }
}

function parseDismissedTipIds(value: string | undefined): AppSettings['dismissedTipIds'] {
  if (!value) {
    return DEFAULT_SETTINGS.dismissedTipIds;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return DEFAULT_SETTINGS.dismissedTipIds;
    }

    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return DEFAULT_SETTINGS.dismissedTipIds;
  }
}

function parseTipShownAt(value: string | undefined): AppSettings['tipShownAt'] {
  if (!value) {
    return DEFAULT_SETTINGS.tipShownAt;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_SETTINGS.tipShownAt;
    }

    const result: Record<string, number> = {};

    for (const [key, timestamp] of Object.entries(parsed)) {
      if (typeof key === 'string' && key.length > 0 && typeof timestamp === 'number' && Number.isFinite(timestamp)) {
        result[key] = timestamp;
      }
    }

    return result;
  } catch {
    return DEFAULT_SETTINGS.tipShownAt;
  }
}

function migrateBuiltinHiddenHomeSections(settings: AppSettings): AppSettings {
  let hidden = settings.hiddenHomeSections;
  let changed = false;

  for (const section of DEFAULT_HIDDEN_BUILTIN_HOME_SECTIONS) {
    const isHidden = hidden.some((item) => item.id === section.id);
    const isRestored = settings.homeSectionRestoreOrder.includes(section.id);

    if (!isHidden && !isRestored) {
      hidden = [...hidden, section];
      changed = true;
    }
  }

  if (!changed) {
    return settings;
  }

  return {
    ...settings,
    hiddenHomeSections: hidden,
  };
}

function parseSettings(database: Database.Database): AppSettings {
  const themeRaw = readSetting(database, SETTING_KEYS.theme);
  const heroEnabledRaw = readSetting(database, SETTING_KEYS.heroEnabled);
  const autoSlideRaw = readSetting(database, SETTING_KEYS.heroAutoSlide);
  const intervalRaw = readSetting(database, SETTING_KEYS.heroSlideIntervalSec);
  const heroSourceSectionIdsRaw = readSetting(database, SETTING_KEYS.heroSourceSectionIds);
  const catalogRowGapRaw = readSetting(database, SETTING_KEYS.catalogRowGap);
  const posterSizeRaw = readSetting(database, SETTING_KEYS.posterSize);
  const sidebarCollapsedRaw = readSetting(database, SETTING_KEYS.sidebarCollapsed);
  const sidebarMenuAnimationRaw = readSetting(database, SETTING_KEYS.sidebarMenuAnimation);
  const hiddenHomeSectionsRaw = readSetting(database, SETTING_KEYS.hiddenHomeSections);
  const homeSectionRestoreOrderRaw = readSetting(database, SETTING_KEYS.homeSectionRestoreOrder);
  const homeFavoritesSectionRaw = readSetting(database, SETTING_KEYS.homeFavoritesSection);
  const homeRecentlyViewedSectionRaw = readSetting(database, SETTING_KEYS.homeRecentlyViewedSection);
  const setupWelcomeDismissedRaw = readSetting(database, SETTING_KEYS.setupWelcomeDismissed);
  const browseCategoryHintDismissedRaw = readSetting(database, SETTING_KEYS.browseCategoryHintDismissed);
  const autoTipsEnabledRaw = readSetting(database, SETTING_KEYS.autoTipsEnabled);
  const uiSoundsEnabledRaw = readSetting(database, SETTING_KEYS.uiSoundsEnabled);
  const dismissedTipIdsRaw = readSetting(database, SETTING_KEYS.dismissedTipIds);
  const tipShownAtRaw = readSetting(database, SETTING_KEYS.tipShownAt);

  const heroSlideIntervalSec = clampInterval(Number.parseInt(intervalRaw ?? '', 10));

  return migrateBuiltinHiddenHomeSections({
    theme: normalizeTheme(themeRaw),
    heroEnabled: heroEnabledRaw !== '0',
    heroAutoSlide: autoSlideRaw !== '0',
    heroSlideIntervalSec,
    heroSourceSectionIds: parseHeroSourceSectionIds(heroSourceSectionIdsRaw),
    cardShowInfo: readCardShowInfo(database),
    catalogRowGap: normalizeCatalogRowGap(catalogRowGapRaw),
    posterSize: normalizePosterSize(posterSizeRaw),
    sidebarCollapsed: sidebarCollapsedRaw === '1',
    sidebarMenuAnimation: normalizeSidebarMenuAnimation(sidebarMenuAnimationRaw),
    hiddenHomeSections: parseHiddenHomeSections(hiddenHomeSectionsRaw),
    homeSectionRestoreOrder: parseHomeSectionRestoreOrder(homeSectionRestoreOrderRaw),
    homeFavoritesSection: normalizeHomeFavoritesSection(homeFavoritesSectionRaw),
    homeRecentlyViewedSection: normalizeHomeRecentlyViewedSection(homeRecentlyViewedSectionRaw),
    setupWelcomeDismissed: setupWelcomeDismissedRaw === '1',
    browseCategoryHintDismissed: browseCategoryHintDismissedRaw === '1',
    autoTipsEnabled: autoTipsEnabledRaw !== '0',
    uiSoundsEnabled: uiSoundsEnabledRaw !== '0',
    dismissedTipIds: parseDismissedTipIds(dismissedTipIdsRaw),
    tipShownAt: parseTipShownAt(tipShownAtRaw),
  });
}

function clampInterval(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SETTINGS.heroSlideIntervalSec;
  }

  return Math.min(120, Math.max(3, value));
}

export function getAppSettings(): AppSettings {
  return parseSettings(openDatabase());
}

export function updateAppSettings(patch: Partial<AppSettings>): AppSettings {
  const database = openDatabase();
  const upsert = database.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (@key, @value, strftime('%s', 'now'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);

  if (patch.theme !== undefined) {
    upsert.run({
      key: SETTING_KEYS.theme,
      value: normalizeTheme(patch.theme),
    });
  }

  if (patch.heroEnabled !== undefined) {
    upsert.run({
      key: SETTING_KEYS.heroEnabled,
      value: patch.heroEnabled ? '1' : '0',
    });
  }

  if (patch.heroAutoSlide !== undefined) {
    upsert.run({
      key: SETTING_KEYS.heroAutoSlide,
      value: patch.heroAutoSlide ? '1' : '0',
    });
  }

  if (patch.heroSlideIntervalSec !== undefined) {
    upsert.run({
      key: SETTING_KEYS.heroSlideIntervalSec,
      value: String(clampInterval(patch.heroSlideIntervalSec)),
    });
  }

  if (patch.heroSourceSectionIds !== undefined) {
    const selected = patch.heroSourceSectionIds.find(
      (item): item is string => typeof item === 'string' && item.length > 0,
    );

    upsert.run({
      key: SETTING_KEYS.heroSourceSectionIds,
      value: JSON.stringify(selected ? [selected] : []),
    });
  }

  if (patch.cardShowInfo !== undefined) {
    upsert.run({
      key: SETTING_KEYS.cardShowInfo,
      value: patch.cardShowInfo ? '1' : '0',
    });
  }

  if (patch.catalogRowGap !== undefined) {
    upsert.run({
      key: SETTING_KEYS.catalogRowGap,
      value: normalizeCatalogRowGap(patch.catalogRowGap),
    });
  }

  if (patch.posterSize !== undefined) {
    upsert.run({
      key: SETTING_KEYS.posterSize,
      value: normalizePosterSize(patch.posterSize),
    });
  }

  if (patch.sidebarCollapsed !== undefined) {
    upsert.run({
      key: SETTING_KEYS.sidebarCollapsed,
      value: patch.sidebarCollapsed ? '1' : '0',
    });
  }

  if (patch.sidebarMenuAnimation !== undefined) {
    upsert.run({
      key: SETTING_KEYS.sidebarMenuAnimation,
      value: normalizeSidebarMenuAnimation(patch.sidebarMenuAnimation),
    });
  }

  if (patch.hiddenHomeSections !== undefined) {
    upsert.run({
      key: SETTING_KEYS.hiddenHomeSections,
      value: JSON.stringify(normalizeHiddenHomeSectionsArray(patch.hiddenHomeSections)),
    });
  }

  if (patch.homeSectionRestoreOrder !== undefined) {
    upsert.run({
      key: SETTING_KEYS.homeSectionRestoreOrder,
      value: JSON.stringify(
        patch.homeSectionRestoreOrder.filter(
          (item): item is string => typeof item === 'string' && item.length > 0,
        ),
      ),
    });
  }

  if (patch.homeFavoritesSection !== undefined) {
    upsert.run({
      key: SETTING_KEYS.homeFavoritesSection,
      value: normalizeHomeFavoritesSection(patch.homeFavoritesSection),
    });
  }

  if (patch.homeRecentlyViewedSection !== undefined) {
    upsert.run({
      key: SETTING_KEYS.homeRecentlyViewedSection,
      value: normalizeHomeRecentlyViewedSection(patch.homeRecentlyViewedSection),
    });
  }

  if (patch.setupWelcomeDismissed !== undefined) {
    upsert.run({
      key: SETTING_KEYS.setupWelcomeDismissed,
      value: patch.setupWelcomeDismissed ? '1' : '0',
    });
  }

  if (patch.browseCategoryHintDismissed !== undefined) {
    upsert.run({
      key: SETTING_KEYS.browseCategoryHintDismissed,
      value: patch.browseCategoryHintDismissed ? '1' : '0',
    });
  }

  if (patch.autoTipsEnabled !== undefined) {
    upsert.run({
      key: SETTING_KEYS.autoTipsEnabled,
      value: patch.autoTipsEnabled ? '1' : '0',
    });
  }

  if (patch.uiSoundsEnabled !== undefined) {
    upsert.run({
      key: SETTING_KEYS.uiSoundsEnabled,
      value: patch.uiSoundsEnabled ? '1' : '0',
    });
  }

  if (patch.dismissedTipIds !== undefined) {
    upsert.run({
      key: SETTING_KEYS.dismissedTipIds,
      value: JSON.stringify(
        patch.dismissedTipIds.filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    });
  }

  if (patch.tipShownAt !== undefined) {
    upsert.run({
      key: SETTING_KEYS.tipShownAt,
      value: JSON.stringify(patch.tipShownAt),
    });
  }

  return parseSettings(database);
}

export function resetAppDatabase(): AppSettings {
  const database = getDatabase();
  database.exec('DELETE FROM favorites');
  database.exec('DELETE FROM recently_viewed');
  database.exec('DELETE FROM watched');
  database.prepare('DELETE FROM settings').run();
  writeDefaultSettings(database);
  return parseSettings(database);
}
