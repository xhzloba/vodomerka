import type {
  InstalledThemePlugin,
  PluginResult,
  ThemeCatalog,
  ThemePluginPackage,
} from '../../../contracts/ipc';
import { THEME_PLUGIN_ENGINE } from '../../../contracts/ipc';
import {
  readLocalInstalledThemes,
  writeLocalInstalledThemes,
} from '@/shared/settings/themes';
import bundledRegistry from '../../../plugins/registry.json';
import onyxPackage from '../../../plugins/themes/onyx.json';
import nocturnePackage from '../../../plugins/themes/nocturne.json';
import emberPackage from '../../../plugins/themes/ember.json';
import auroraPackage from '../../../plugins/themes/aurora.json';
import crimsonPackage from '../../../plugins/themes/crimson.json';
import mistPackage from '../../../plugins/themes/mist.json';

const LOCAL_PACKAGES: Record<string, ThemePluginPackage> = {
  onyx: onyxPackage as ThemePluginPackage,
  nocturne: nocturnePackage as ThemePluginPackage,
  ember: emberPackage as ThemePluginPackage,
  aurora: auroraPackage as ThemePluginPackage,
  crimson: crimsonPackage as ThemePluginPackage,
  mist: mistPackage as ThemePluginPackage,
};

function canUseElectronPlugins(): boolean {
  return Boolean(window.electronAPI?.plugins);
}

export async function listInstalledThemePlugins(): Promise<InstalledThemePlugin[]> {
  if (canUseElectronPlugins()) {
    return window.electronAPI!.plugins.listThemes();
  }

  return readLocalInstalledThemes();
}

export async function getInstalledThemePlugin(
  id: string,
): Promise<InstalledThemePlugin | null> {
  if (canUseElectronPlugins()) {
    return window.electronAPI!.plugins.getTheme(id);
  }

  return readLocalInstalledThemes().find((theme) => theme.id === id) ?? null;
}

export async function fetchThemeCatalog(): Promise<PluginResult<ThemeCatalog>> {
  if (canUseElectronPlugins()) {
    return window.electronAPI!.plugins.fetchCatalog();
  }

  const catalog = bundledRegistry as ThemeCatalog;
  if (catalog.engine !== THEME_PLUGIN_ENGINE) {
    return { ok: false, error: 'Несовместимый каталог тем' };
  }

  return { ok: true, data: catalog };
}

export async function installThemePlugin(
  urlOrLocalId: string,
): Promise<PluginResult<InstalledThemePlugin>> {
  if (canUseElectronPlugins()) {
    return window.electronAPI!.plugins.installTheme(urlOrLocalId);
  }

  const pkg = LOCAL_PACKAGES[urlOrLocalId];
  if (!pkg || pkg.engine !== THEME_PLUGIN_ENGINE) {
    return { ok: false, error: 'Тема недоступна без Electron (только локальный каталог)' };
  }

  const installed: InstalledThemePlugin = {
    ...pkg,
    installedAt: Date.now(),
    sourceUrl: `local://${pkg.id}`,
  };

  const next = [
    ...readLocalInstalledThemes().filter((theme) => theme.id !== installed.id),
    installed,
  ];
  writeLocalInstalledThemes(next);
  return { ok: true, data: installed };
}

export async function uninstallThemePlugin(
  id: string,
): Promise<PluginResult<{ removed: boolean }>> {
  if (canUseElectronPlugins()) {
    return window.electronAPI!.plugins.uninstallTheme(id);
  }

  const current = readLocalInstalledThemes();
  const next = current.filter((theme) => theme.id !== id);
  writeLocalInstalledThemes(next);
  return { ok: true, data: { removed: next.length !== current.length } };
}
