import { existsSync } from 'fs';
import { app } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import {
  BUILTIN_SIDEBAR_ANIMATION_IDS,
  BUILTIN_THEME_IDS,
  THEME_PLUGIN_ENGINE,
  type InstalledThemePlugin,
  type PluginResult,
  type SidebarAnimationCatalogEntry,
  type ThemeCatalog,
  type ThemeCatalogEntry,
  type ThemePluginPackage,
} from '../../contracts/ipc';
import { fetchJsonWithProgress, type DownloadProgressCallback } from './download';

const REMOTE_REGISTRY_URL =
  'https://raw.githubusercontent.com/xhzloba/vodomerka/main/plugins/registry.json';

const ALLOWED_HOSTS = new Set(['raw.githubusercontent.com', 'cdn.jsdelivr.net']);

const THEME_ID_PATTERN = /^[a-z][a-z0-9-]{1,47}$/;

function getPluginsRoot(): string {
  return path.join(app.getPath('userData'), 'plugins', 'themes');
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

async function ensureThemesDir(): Promise<string> {
  const dir = getPluginsRoot();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function themeFilePath(id: string): string {
  return path.join(getPluginsRoot(), `${id}.json`);
}

function isBuiltinThemeId(id: string): boolean {
  return (BUILTIN_THEME_IDS as readonly string[]).includes(id);
}

function isValidThemeId(id: string): boolean {
  return THEME_ID_PATTERN.test(id) && !isBuiltinThemeId(id);
}

function isAllowedPackageUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function normalizePreview(value: unknown): ThemePluginPackage['preview'] | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.bg !== 'string' || typeof record.accent !== 'string') {
    return null;
  }

  return { bg: record.bg, accent: record.accent };
}

export function parseThemePackage(value: unknown): ThemePluginPackage | null {
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
    typeof record.windowBackground !== 'string' ||
    typeof record.css !== 'string' ||
    !preview
  ) {
    return null;
  }

  if (!isValidThemeId(record.id)) {
    return null;
  }

  if (record.engine !== THEME_PLUGIN_ENGINE) {
    return null;
  }

  if (!record.css.trim()) {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    description: record.description,
    version: record.version,
    engine: record.engine,
    windowBackground: record.windowBackground,
    preview,
    css: record.css,
  };
}

function toInstalled(
  pkg: ThemePluginPackage,
  sourceUrl?: string,
  installedAt = Date.now(),
): InstalledThemePlugin {
  return {
    ...pkg,
    installedAt,
    sourceUrl,
  };
}

async function readInstalledFile(id: string): Promise<InstalledThemePlugin | null> {
  try {
    const raw = await fs.readFile(themeFilePath(id), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const pkg = parseThemePackage(parsed);
    if (!pkg || pkg.id !== id) {
      return null;
    }

    return toInstalled(
      pkg,
      typeof record.sourceUrl === 'string' ? record.sourceUrl : undefined,
      typeof record.installedAt === 'number' ? record.installedAt : Date.now(),
    );
  } catch {
    return null;
  }
}

export async function listInstalledThemes(): Promise<InstalledThemePlugin[]> {
  try {
    const dir = await ensureThemesDir();
    const entries = await fs.readdir(dir);
    const themes: InstalledThemePlugin[] = [];

    for (const entry of entries) {
      if (!entry.endsWith('.json')) {
        continue;
      }

      const id = entry.slice(0, -'.json'.length);
      const theme = await readInstalledFile(id);
      if (theme) {
        themes.push(theme);
      }
    }

    return themes.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  } catch {
    return [];
  }
}

export async function getInstalledTheme(id: string): Promise<InstalledThemePlugin | null> {
  if (!THEME_ID_PATTERN.test(id) || isBuiltinThemeId(id)) {
    return null;
  }

  return readInstalledFile(id);
}

export async function getInstalledThemeWindowBackground(id: string): Promise<string | null> {
  const theme = await getInstalledTheme(id);
  return theme?.windowBackground ?? null;
}

async function writeInstalled(theme: InstalledThemePlugin): Promise<void> {
  await ensureThemesDir();
  await fs.writeFile(themeFilePath(theme.id), JSON.stringify(theme, null, 2), 'utf8');
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

function parseCatalog(value: unknown): ThemeCatalog | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.engine !== 'number' || !Array.isArray(record.themes)) {
    return null;
  }

  const themes: ThemeCatalogEntry[] = [];
  const sidebarAnimations: SidebarAnimationCatalogEntry[] = [];

  for (const item of record.themes) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const entry = item as Record<string, unknown>;
    const preview = normalizePreview(entry.preview);
    if (
      typeof entry.id !== 'string' ||
      typeof entry.name !== 'string' ||
      typeof entry.description !== 'string' ||
      typeof entry.version !== 'string' ||
      typeof entry.url !== 'string' ||
      typeof entry.windowBackground !== 'string' ||
      !preview ||
      !isValidThemeId(entry.id)
    ) {
      continue;
    }

    themes.push({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      version: entry.version,
      url: entry.url,
      localPath: typeof entry.localPath === 'string' ? entry.localPath : undefined,
      preview,
      windowBackground: entry.windowBackground,
    });
  }

  if (Array.isArray(record.sidebarAnimations)) {
    for (const item of record.sidebarAnimations) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const entry = item as Record<string, unknown>;
      const preview = normalizePreview(entry.preview);
      if (
        typeof entry.id !== 'string' ||
        typeof entry.name !== 'string' ||
        typeof entry.description !== 'string' ||
        typeof entry.version !== 'string' ||
        typeof entry.url !== 'string' ||
        typeof entry.behavior !== 'string' ||
        !preview ||
        !THEME_ID_PATTERN.test(entry.id) ||
        (BUILTIN_SIDEBAR_ANIMATION_IDS as readonly string[]).includes(entry.id)
      ) {
        continue;
      }

      const behavior = entry.behavior as SidebarAnimationCatalogEntry['behavior'];
      if (
        behavior !== 'liquid' &&
        behavior !== 'snake' &&
        behavior !== 'magnetic' &&
        behavior !== 'edge-pulse'
      ) {
        continue;
      }

      sidebarAnimations.push({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        version: entry.version,
        url: entry.url,
        localPath: typeof entry.localPath === 'string' ? entry.localPath : undefined,
        preview,
        behavior,
      });
    }
  }

  return {
    engine: record.engine,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
    themes,
    sidebarAnimations,
  };
}

export async function fetchThemeCatalog(): Promise<PluginResult<ThemeCatalog>> {
  try {
    if (isAllowedPackageUrl(REMOTE_REGISTRY_URL)) {
      const remote = parseCatalog(await fetchJson(REMOTE_REGISTRY_URL));
      if (remote && remote.engine === THEME_PLUGIN_ENGINE) {
        return { ok: true, data: remote };
      }
    }
  } catch {
    // fall through to bundled
  }

  const bundled = parseCatalog(await readBundledFile('registry.json'));
  if (bundled && bundled.engine === THEME_PLUGIN_ENGINE) {
    return { ok: true, data: bundled };
  }

  return { ok: false, error: 'Не удалось загрузить каталог тем' };
}

async function loadPackageFromCatalogEntry(
  entry: ThemeCatalogEntry,
  onProgress?: DownloadProgressCallback,
): Promise<ThemePluginPackage | null> {
  if (isAllowedPackageUrl(entry.url)) {
    try {
      const pkg = parseThemePackage(await fetchJson(entry.url, onProgress));
      if (pkg && pkg.id === entry.id) {
        return pkg;
      }
    } catch {
      // try local
    }
  }

  if (entry.localPath) {
    onProgress?.(0.45);
    const local = parseThemePackage(await readBundledFile(entry.localPath));
    onProgress?.(1);
    if (local && local.id === entry.id) {
      return local;
    }
  }

  return null;
}

function reportProgress(onProgress: DownloadProgressCallback | undefined, value: number): void {
  onProgress?.(Math.min(1, Math.max(0, value)));
}

export async function installTheme(
  urlOrLocalId: string,
  onProgress?: DownloadProgressCallback,
): Promise<PluginResult<InstalledThemePlugin>> {
  const target = urlOrLocalId.trim();
  if (!target) {
    return { ok: false, error: 'Пустой идентификатор темы' };
  }

  reportProgress(onProgress, 0.02);

  let pkg: ThemePluginPackage | null = null;
  let sourceUrl: string | undefined;

  if (isAllowedPackageUrl(target)) {
    try {
      pkg = parseThemePackage(
        await fetchJson(target, (progress) => reportProgress(onProgress, 0.05 + progress * 0.85)),
      );
      sourceUrl = target;
    } catch {
      return { ok: false, error: 'Не удалось скачать тему' };
    }
  } else if (THEME_ID_PATTERN.test(target)) {
    reportProgress(onProgress, 0.06);
    const catalog = await fetchThemeCatalog();
    if (!catalog.ok) {
      return catalog;
    }

    reportProgress(onProgress, 0.12);
    const entry = catalog.data.themes.find((theme) => theme.id === target);
    if (!entry) {
      return { ok: false, error: 'Тема не найдена в каталоге' };
    }

    pkg = await loadPackageFromCatalogEntry(entry, (progress) =>
      reportProgress(onProgress, 0.12 + progress * 0.8),
    );
    sourceUrl = entry.url;
  } else {
    return { ok: false, error: 'Недопустимый источник темы' };
  }

  if (!pkg) {
    return { ok: false, error: 'Пакет темы повреждён или несовместим' };
  }

  reportProgress(onProgress, 0.95);
  const installed = toInstalled(pkg, sourceUrl);
  await writeInstalled(installed);
  reportProgress(onProgress, 1);
  return { ok: true, data: installed };
}

export async function uninstallTheme(
  id: string,
): Promise<PluginResult<{ removed: boolean }>> {
  if (!isValidThemeId(id)) {
    return { ok: false, error: 'Нельзя удалить встроенную тему' };
  }

  try {
    await fs.unlink(themeFilePath(id));
    return { ok: true, data: { removed: true } };
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    if (code === 'ENOENT') {
      return { ok: true, data: { removed: false } };
    }

    return { ok: false, error: 'Не удалось удалить тему' };
  }
}
