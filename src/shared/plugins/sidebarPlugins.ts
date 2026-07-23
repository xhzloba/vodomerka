import type {
  InstalledSidebarAnimationPlugin,
  PluginResult,
  SidebarAnimationCatalogEntry,
  SidebarAnimationPluginPackage,
  ThemeCatalog,
} from '../../../contracts/ipc';
import {
  BUILTIN_SIDEBAR_ANIMATION_IDS,
  DEFAULT_SIDEBAR_ANIMATION_ID,
  THEME_PLUGIN_ENGINE,
} from '../../../contracts/ipc';
import liquidPackage from '../../../plugins/sidebar/liquid.json';
import snakePackage from '../../../plugins/sidebar/snake.json';
import magneticPackage from '../../../plugins/sidebar/magnetic.json';
import edgePulsePackage from '../../../plugins/sidebar/edge-pulse.json';

const LOCAL_STORAGE_KEY = 'tv-leonid-sidebar-animation-plugins';

const LOCAL_PACKAGES: Record<string, SidebarAnimationPluginPackage> = {
  liquid: liquidPackage as SidebarAnimationPluginPackage,
  snake: snakePackage as SidebarAnimationPluginPackage,
  magnetic: magneticPackage as SidebarAnimationPluginPackage,
  'edge-pulse': edgePulsePackage as SidebarAnimationPluginPackage,
};

function canUseElectronPlugins(): boolean {
  return Boolean(window.electronAPI?.plugins?.listSidebarAnimations);
}

function readLocalInstalled(): InstalledSidebarAnimationPlugin[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is InstalledSidebarAnimationPlugin => {
      return (
        !!item &&
        typeof item === 'object' &&
        typeof (item as InstalledSidebarAnimationPlugin).id === 'string' &&
        typeof (item as InstalledSidebarAnimationPlugin).behavior === 'string'
      );
    });
  } catch {
    return [];
  }
}

function writeLocalInstalled(plugins: InstalledSidebarAnimationPlugin[]): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(plugins));
}

export async function listInstalledSidebarAnimations(): Promise<InstalledSidebarAnimationPlugin[]> {
  if (canUseElectronPlugins()) {
    return window.electronAPI!.plugins.listSidebarAnimations();
  }

  return readLocalInstalled();
}

export async function getInstalledSidebarAnimation(
  id: string,
): Promise<InstalledSidebarAnimationPlugin | null> {
  if (canUseElectronPlugins()) {
    return window.electronAPI!.plugins.getSidebarAnimation(id);
  }

  return readLocalInstalled().find((item) => item.id === id) ?? null;
}

export function getSidebarCatalogEntries(catalog: ThemeCatalog): SidebarAnimationCatalogEntry[] {
  return catalog.sidebarAnimations ?? [];
}

export async function installSidebarAnimationPlugin(
  urlOrLocalId: string,
): Promise<PluginResult<InstalledSidebarAnimationPlugin>> {
  if (canUseElectronPlugins()) {
    return window.electronAPI!.plugins.installSidebarAnimation(urlOrLocalId);
  }

  const pkg = LOCAL_PACKAGES[urlOrLocalId];
  if (!pkg || pkg.engine !== THEME_PLUGIN_ENGINE) {
    return { ok: false, error: 'Анимация недоступна без Electron (только локальный каталог)' };
  }

  const installed: InstalledSidebarAnimationPlugin = {
    ...pkg,
    installedAt: Date.now(),
    sourceUrl: `local://${pkg.id}`,
  };

  const next = [...readLocalInstalled().filter((item) => item.id !== installed.id), installed];
  writeLocalInstalled(next);
  return { ok: true, data: installed };
}

export async function uninstallSidebarAnimationPlugin(
  id: string,
): Promise<PluginResult<{ removed: boolean }>> {
  if (canUseElectronPlugins()) {
    return window.electronAPI!.plugins.uninstallSidebarAnimation(id);
  }

  const current = readLocalInstalled();
  const next = current.filter((item) => item.id !== id);
  writeLocalInstalled(next);
  return { ok: true, data: { removed: next.length !== current.length } };
}

export async function resolveSidebarMenuBehavior(
  animationId: string,
): Promise<string> {
  if ((BUILTIN_SIDEBAR_ANIMATION_IDS as readonly string[]).includes(animationId)) {
    return animationId;
  }

  const installed = await getInstalledSidebarAnimation(animationId);
  if (installed) {
    return installed.behavior;
  }

  return DEFAULT_SIDEBAR_ANIMATION_ID;
}
