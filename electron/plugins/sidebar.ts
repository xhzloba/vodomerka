import { existsSync } from 'fs';
import { app } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import {
  BUILTIN_SIDEBAR_ANIMATION_IDS,
  THEME_PLUGIN_ENGINE,
  type InstalledSidebarAnimationPlugin,
  type PluginResult,
  type SidebarAnimationBehavior,
  type SidebarAnimationCatalogEntry,
  type SidebarAnimationPluginPackage,
  type ThemeCatalog,
} from '../../contracts/ipc';
import { fetchJsonWithProgress, type DownloadProgressCallback } from './download';
import { fetchThemeCatalog } from './themes';

const ALLOWED_HOSTS = new Set(['raw.githubusercontent.com', 'cdn.jsdelivr.net']);
const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9-]{1,47}$/;

const SIDEBAR_BEHAVIORS: SidebarAnimationBehavior[] = [
  'liquid',
  'snake',
  'magnetic',
  'magnetic-water',
  'edge-pulse',
];

function getSidebarPluginsRoot(): string {
  return path.join(app.getPath('userData'), 'plugins', 'sidebar');
}

function getBundledPluginsRoot(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'plugins');
  }

  const candidates = [
    path.join(process.cwd(), 'plugins'),
    path.join(app.getAppPath(), 'plugins'),
    path.join(app.getAppPath(), '..', 'plugins'),
    path.join(__dirname, '..', '..', 'plugins'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return path.join(process.cwd(), 'plugins');
}

async function ensureDir(): Promise<string> {
  const dir = getSidebarPluginsRoot();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function pluginFilePath(id: string): string {
  return path.join(getSidebarPluginsRoot(), `${id}.json`);
}

function isBuiltinId(id: string): boolean {
  return (BUILTIN_SIDEBAR_ANIMATION_IDS as readonly string[]).includes(id);
}

function isValidPluginId(id: string): boolean {
  return PLUGIN_ID_PATTERN.test(id) && !isBuiltinId(id);
}

function isAllowedPackageUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function isBehavior(value: unknown): value is SidebarAnimationBehavior {
  return typeof value === 'string' && SIDEBAR_BEHAVIORS.includes(value as SidebarAnimationBehavior);
}

function normalizePreview(
  value: unknown,
): SidebarAnimationPluginPackage['preview'] | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.bg !== 'string' || typeof record.accent !== 'string') {
    return null;
  }

  return { bg: record.bg, accent: record.accent };
}

export function parseSidebarAnimationPackage(
  value: unknown,
): SidebarAnimationPluginPackage | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const preview = normalizePreview(record.preview);

  if (
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.description !== 'string' ||
    typeof record.version !== 'string' ||
    typeof record.engine !== 'number' ||
    record.kind !== 'sidebar-animation' ||
    !isBehavior(record.behavior) ||
    !preview ||
    !isValidPluginId(record.id) ||
    record.engine !== THEME_PLUGIN_ENGINE
  ) {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    description: record.description,
    version: record.version,
    engine: record.engine,
    kind: 'sidebar-animation',
    behavior: record.behavior,
    preview,
  };
}

function toInstalled(
  pkg: SidebarAnimationPluginPackage,
  sourceUrl?: string,
  installedAt = Date.now(),
): InstalledSidebarAnimationPlugin {
  return {
    ...pkg,
    installedAt,
    sourceUrl,
  };
}

async function readInstalledFile(id: string): Promise<InstalledSidebarAnimationPlugin | null> {
  try {
    const raw = await fs.readFile(pluginFilePath(id), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const pkg = parseSidebarAnimationPackage(parsed);
    if (!pkg || pkg.id !== id) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    return toInstalled(
      pkg,
      typeof record.sourceUrl === 'string' ? record.sourceUrl : undefined,
      typeof record.installedAt === 'number' ? record.installedAt : Date.now(),
    );
  } catch {
    return null;
  }
}

export async function listInstalledSidebarAnimations(): Promise<InstalledSidebarAnimationPlugin[]> {
  try {
    const dir = await ensureDir();
    const entries = await fs.readdir(dir);
    const plugins: InstalledSidebarAnimationPlugin[] = [];

    for (const entry of entries) {
      if (!entry.endsWith('.json')) {
        continue;
      }

      const plugin = await readInstalledFile(entry.slice(0, -'.json'.length));
      if (plugin) {
        plugins.push(plugin);
      }
    }

    return plugins.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  } catch {
    return [];
  }
}

export async function getInstalledSidebarAnimation(
  id: string,
): Promise<InstalledSidebarAnimationPlugin | null> {
  if (!PLUGIN_ID_PATTERN.test(id) || isBuiltinId(id)) {
    return null;
  }

  return readInstalledFile(id);
}

async function writeInstalled(plugin: InstalledSidebarAnimationPlugin): Promise<void> {
  await ensureDir();
  await fs.writeFile(pluginFilePath(plugin.id), JSON.stringify(plugin, null, 2), 'utf8');
}

async function fetchJson(url: string, onProgress?: DownloadProgressCallback): Promise<unknown> {
  return fetchJsonWithProgress(url, onProgress);
}

async function readBundledFile(relativePath: string): Promise<unknown | null> {
  try {
    const fullPath = path.join(getBundledPluginsRoot(), relativePath);
    const raw = await fs.readFile(fullPath, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function getSidebarEntries(catalog: ThemeCatalog): SidebarAnimationCatalogEntry[] {
  return catalog.sidebarAnimations ?? [];
}

function reportProgress(onProgress: DownloadProgressCallback | undefined, value: number): void {
  onProgress?.(Math.min(1, Math.max(0, value)));
}

async function loadPackageFromCatalogEntry(
  entry: SidebarAnimationCatalogEntry,
  onProgress?: DownloadProgressCallback,
): Promise<SidebarAnimationPluginPackage | null> {
  if (isAllowedPackageUrl(entry.url)) {
    try {
      const pkg = parseSidebarAnimationPackage(await fetchJson(entry.url, onProgress));
      if (pkg && pkg.id === entry.id) {
        return pkg;
      }
    } catch {
      // local fallback
    }
  }

  if (entry.localPath) {
    onProgress?.(0.45);
    const local = parseSidebarAnimationPackage(await readBundledFile(entry.localPath));
    onProgress?.(1);
    if (local && local.id === entry.id) {
      return local;
    }
  }

  return null;
}

export async function installSidebarAnimation(
  urlOrLocalId: string,
  onProgress?: DownloadProgressCallback,
): Promise<PluginResult<InstalledSidebarAnimationPlugin>> {
  const target = urlOrLocalId.trim();
  if (!target) {
    return { ok: false, error: 'Пустой идентификатор анимации' };
  }

  reportProgress(onProgress, 0.02);

  let pkg: SidebarAnimationPluginPackage | null = null;
  let sourceUrl: string | undefined;

  if (isAllowedPackageUrl(target)) {
    try {
      pkg = parseSidebarAnimationPackage(
        await fetchJson(target, (progress) => reportProgress(onProgress, 0.05 + progress * 0.85)),
      );
      sourceUrl = target;
    } catch {
      return { ok: false, error: 'Не удалось скачать анимацию меню' };
    }
  } else if (PLUGIN_ID_PATTERN.test(target)) {
    reportProgress(onProgress, 0.06);
    const catalog = await fetchThemeCatalog();
    if (!catalog.ok) {
      return catalog;
    }

    reportProgress(onProgress, 0.12);
    const entry = getSidebarEntries(catalog.data).find((item) => item.id === target);
    if (!entry) {
      return { ok: false, error: 'Анимация не найдена в каталоге' };
    }

    pkg = await loadPackageFromCatalogEntry(entry, (progress) =>
      reportProgress(onProgress, 0.12 + progress * 0.8),
    );
    sourceUrl = entry.url;
  } else {
    return { ok: false, error: 'Недопустимый источник анимации' };
  }

  if (!pkg) {
    return { ok: false, error: 'Пакет анимации повреждён или несовместим' };
  }

  reportProgress(onProgress, 0.95);
  const installed = toInstalled(pkg, sourceUrl);
  await writeInstalled(installed);
  reportProgress(onProgress, 1);
  return { ok: true, data: installed };
}

export async function uninstallSidebarAnimation(
  id: string,
): Promise<PluginResult<{ removed: boolean }>> {
  if (!isValidPluginId(id)) {
    return { ok: false, error: 'Нельзя удалить встроенную анимацию' };
  }

  try {
    await fs.unlink(pluginFilePath(id));
    return { ok: true, data: { removed: true } };
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    if (code === 'ENOENT') {
      return { ok: true, data: { removed: false } };
    }

    return { ok: false, error: 'Не удалось удалить анимацию' };
  }
}
