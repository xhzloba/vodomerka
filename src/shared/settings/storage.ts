import { migrateBuiltinHiddenHomeSections } from '@/shared/domain/homeSections';
import { normalizeHiddenMediatekaItemIds } from '@/shared/domain/mediatekaMenu';
import {
  clampHeroSlideIntervalSec,
  DEFAULT_APP_SETTINGS,
  normalizeCatalogRowGap,
  normalizeDismissedTipIds,
  normalizeApiServer,
  normalizeHeroSourceSectionIds,
  normalizeHiddenHomeSections,
  normalizeHomeSectionRestoreOrder,
  normalizeHomeFavoritesSection,
  normalizeHomeRecentlyViewedSection,
  normalizePosterSize,
  normalizeSidebarMenuAnimation,
  normalizeSidebarStyle,
  normalizeTipShownAt,
  type AppSettings,
} from './types';
import { normalizeAppTheme } from './themes';

const STORAGE_KEY = 'tv-leonid-settings';
const LEGACY_SIDEBAR_COLLAPSED_KEY = 'tv-leonid-sidebar-collapsed';
const FAVORITES_STORAGE_KEY = 'tv-leonid-favorites';
const RECENTLY_VIEWED_STORAGE_KEY = 'tv-leonid-recently-viewed';
const WATCHED_STORAGE_KEY = 'tv-leonid-watched';

function readLocalSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_APP_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return normalizeSettings(parsed);
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

function writeLocalSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function readCardShowInfo(value: Partial<AppSettings> & Record<string, unknown>): boolean {
  if (typeof value.cardShowInfo === 'boolean') {
    return value.cardShowInfo;
  }

  const hasLegacy =
    'cardShowTitle' in value || 'cardShowYear' in value || 'cardShowRating' in value;

  if (hasLegacy) {
    return (
      value.cardShowTitle !== false &&
      value.cardShowYear !== false &&
      value.cardShowRating !== false
    );
  }

  return DEFAULT_APP_SETTINGS.cardShowInfo;
}

function readSidebarCollapsed(value: Partial<AppSettings>): boolean {
  if (typeof value.sidebarCollapsed === 'boolean') {
    return value.sidebarCollapsed;
  }

  try {
    const legacy = localStorage.getItem(LEGACY_SIDEBAR_COLLAPSED_KEY);
    if (legacy === '1') {
      return true;
    }
    if (legacy === '0') {
      return false;
    }
  } catch {
    // ignore storage errors
  }

  return DEFAULT_APP_SETTINGS.sidebarCollapsed;
}

function applySettingsMigrations(settings: AppSettings): {
  settings: AppSettings;
  changed: boolean;
} {
  const migrated = migrateBuiltinHiddenHomeSections(settings);

  if (!migrated.changed) {
    return { settings, changed: false };
  }

  return {
    settings: {
      ...settings,
      hiddenHomeSections: migrated.hiddenHomeSections,
    },
    changed: true,
  };
}

function normalizeSettings(value: Partial<AppSettings>): AppSettings {
  return {
    theme: normalizeAppTheme(value.theme),
    heroEnabled: value.heroEnabled ?? DEFAULT_APP_SETTINGS.heroEnabled,
    heroAutoSlide: value.heroAutoSlide ?? DEFAULT_APP_SETTINGS.heroAutoSlide,
    heroSlideIntervalSec: clampHeroSlideIntervalSec(
      value.heroSlideIntervalSec ?? DEFAULT_APP_SETTINGS.heroSlideIntervalSec,
    ),
    heroSourceSectionIds: normalizeHeroSourceSectionIds(value.heroSourceSectionIds),
    cardShowInfo: readCardShowInfo(value),
    catalogRowGap: normalizeCatalogRowGap(value.catalogRowGap),
    posterSize: normalizePosterSize(value.posterSize),
    sidebarCollapsed: readSidebarCollapsed(value),
    sidebarMenuAnimation: normalizeSidebarMenuAnimation(value.sidebarMenuAnimation),
    sidebarStyle: normalizeSidebarStyle(value.sidebarStyle),
    hiddenHomeSections: normalizeHiddenHomeSections(value.hiddenHomeSections),
    hiddenMediatekaItemIds: normalizeHiddenMediatekaItemIds(value.hiddenMediatekaItemIds),
    homeSectionRestoreOrder: normalizeHomeSectionRestoreOrder(value.homeSectionRestoreOrder),
    homeFavoritesSection: normalizeHomeFavoritesSection(value.homeFavoritesSection),
    homeRecentlyViewedSection: normalizeHomeRecentlyViewedSection(value.homeRecentlyViewedSection),
    setupWelcomeDismissed: value.setupWelcomeDismissed ?? true,
    browseCategoryHintDismissed: value.browseCategoryHintDismissed ?? false,
    autoTipsEnabled: value.autoTipsEnabled ?? DEFAULT_APP_SETTINGS.autoTipsEnabled,
    uiSoundsEnabled: value.uiSoundsEnabled ?? DEFAULT_APP_SETTINGS.uiSoundsEnabled,
    dismissedTipIds: normalizeDismissedTipIds(value.dismissedTipIds),
    tipShownAt: normalizeTipShownAt(value.tipShownAt),
    apiServer: normalizeApiServer(value.apiServer),
  };
}

async function migrateLegacySidebarCollapsed(settings: AppSettings): Promise<AppSettings> {
  try {
    const legacy = localStorage.getItem(LEGACY_SIDEBAR_COLLAPSED_KEY);
    if (legacy === null || settings.sidebarCollapsed) {
      return settings;
    }

    if (legacy !== '1') {
      localStorage.removeItem(LEGACY_SIDEBAR_COLLAPSED_KEY);
      return settings;
    }

    localStorage.removeItem(LEGACY_SIDEBAR_COLLAPSED_KEY);

    if (window.electronAPI?.settings) {
      return normalizeSettings(
        await window.electronAPI.settings.set({ sidebarCollapsed: true }),
      );
    }

    const next = { ...settings, sidebarCollapsed: true };
    writeLocalSettings(next);
    return next;
  } catch {
    return settings;
  }
}

export async function loadAppSettings(): Promise<AppSettings> {
  if (window.electronAPI?.settings) {
    const normalized = await migrateLegacySidebarCollapsed(
      normalizeSettings(await window.electronAPI.settings.get()),
    );
    const { settings: loaded, changed } = applySettingsMigrations(normalized);

    if (changed) {
      await window.electronAPI.settings.set({
        hiddenHomeSections: loaded.hiddenHomeSections,
      });
    }

    writeLocalSettings(loaded);
    return loaded;
  }

  const normalized = readLocalSettings();
  const { settings: loaded, changed } = applySettingsMigrations(normalized);

  if (changed) {
    writeLocalSettings(loaded);
  }

  return loaded;
}

export async function resetAppData(): Promise<AppSettings> {
  localStorage.removeItem(FAVORITES_STORAGE_KEY);
  localStorage.removeItem(RECENTLY_VIEWED_STORAGE_KEY);
  localStorage.removeItem(WATCHED_STORAGE_KEY);
  localStorage.removeItem(LEGACY_SIDEBAR_COLLAPSED_KEY);

  if (window.electronAPI?.settings?.reset) {
    const defaults = normalizeSettings(await window.electronAPI.settings.reset());
    writeLocalSettings(defaults);
    return defaults;
  }

  localStorage.removeItem(STORAGE_KEY);
  const { settings: defaults } = applySettingsMigrations({ ...DEFAULT_APP_SETTINGS });
  writeLocalSettings(defaults);
  return defaults;
}

export async function saveAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  if (window.electronAPI?.settings) {
    const saved = normalizeSettings(await window.electronAPI.settings.set(patch));
    const next = normalizeSettings({ ...saved, ...patch });
    writeLocalSettings(next);
    return next;
  }

  const next = normalizeSettings({ ...readLocalSettings(), ...patch });
  writeLocalSettings(next);
  return next;
}
