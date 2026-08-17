import { useCallback, useEffect, useState, useRef } from 'react';
import type {
  InstalledSidebarAnimationPlugin,
  InstalledThemePlugin,
  SidebarAnimationCatalogEntry,
  ThemeCatalogEntry,
} from '../../../contracts/ipc';
import { DEFAULT_SIDEBAR_ANIMATION_ID, DEFAULT_THEME_ID } from '../../../contracts/ipc';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import {
  fetchThemeCatalog,
  installThemePlugin,
  listInstalledThemePlugins,
  uninstallThemePlugin,
} from '@/shared/plugins/themePlugins';
import {
  getSidebarCatalogEntries,
  installSidebarAnimationPlugin,
  listInstalledSidebarAnimations,
  uninstallSidebarAnimationPlugin,
} from '@/shared/plugins/sidebarPlugins';
import { AiPluginsPanel } from '@/features/ai/ui/AiPluginsPanel';
import { AI_OPEN_PLUGINS_EVENT, consumeOpenAiPluginsTab } from '@/shared/ai/navigation';
import { useToast } from '@/shared/ui/Toast/ToastContext';
import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import { useAppTopProgress } from '@/shared/ui/AppTopProgress/AppTopProgressContext';
import { PageLoading } from '@/shared/ui/PageState';
import { Tabs } from '@/shared/ui/Tabs';
import { SettingsCheckbox } from '@/shared/ui/SettingsControls/SettingsCheckbox';
import { SettingsGlyph } from '@/shared/ui/SettingsControls/SettingsGlyph';
import { HistoryIcon, TrashIcon } from '@/shared/ui/icons';
import '../SettingsView/SettingsView.css';
import './PluginsView.css';

const PLUGIN_TABS = [
  { id: 'themes', label: 'Темы' },
  { id: 'sidebar', label: 'Меню' },
  { id: 'ai', label: 'ИИ' },
] as const;

type PluginTabId = (typeof PLUGIN_TABS)[number]['id'];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function PluginPreview({ bg, accent }: { bg: string; accent: string }) {
  return (
    <span className="settings-theme-card__preview" aria-hidden="true">
      <span
        className="settings-theme-card__swatch settings-theme-card__swatch--bg"
        style={{ background: bg }}
      />
      <span
        className="settings-theme-card__swatch settings-theme-card__swatch--accent"
        style={{ background: accent }}
      />
    </span>
  );
}

export function PluginsView() {
  const scrollRef = useOverlayScroll<HTMLDivElement>();
  const { settings, updateSettings, reloadSettings } = useAppSettings();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<PluginTabId>('themes');
  const [themeCatalog, setThemeCatalog] = useState<ThemeCatalogEntry[]>([]);
  const [sidebarCatalog, setSidebarCatalog] = useState<SidebarAnimationCatalogEntry[]>([]);
  const [installedThemes, setInstalledThemes] = useState<InstalledThemePlugin[]>([]);
  const [installedSidebar, setInstalledSidebar] = useState<InstalledSidebarAnimationPlugin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const busyIdRef = useRef<string | null>(null);

  useAppTopProgress('plugins', isLoading || isRefreshing);

  useEffect(() => {
    busyIdRef.current = busyId;
  }, [busyId]);

  useEffect(() => {
    return window.electronAPI?.plugins?.onInstallProgress?.((event) => {
      const expected = event.kind === 'sidebar' ? `sidebar:${event.id}` : event.id;
      if (busyIdRef.current === expected) {
        setInstallProgress(clamp01(event.progress));
      }
    });
  }, []);

  const refresh = useCallback(async (options?: { soft?: boolean }) => {
    const soft = options?.soft ?? false;
    if (soft) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setCatalogError(null);

    try {
      const [catalogResult, themes, sidebars] = await Promise.all([
        fetchThemeCatalog(),
        listInstalledThemePlugins(),
        listInstalledSidebarAnimations(),
      ]);

      setInstalledThemes(themes);
      setInstalledSidebar(sidebars);

      if (!catalogResult.ok) {
        setCatalogError(catalogResult.error);
        setThemeCatalog([]);
        setSidebarCatalog([]);
      } else {
        setThemeCatalog(catalogResult.data.themes);
        setSidebarCatalog(getSidebarCatalogEntries(catalogResult.data));
      }
    } catch {
      setCatalogError('Не удалось загрузить плагины');
      setThemeCatalog([]);
      setSidebarCatalog([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (consumeOpenAiPluginsTab()) {
      setActiveTab('ai');
    }

    const onOpenAi = () => {
      setActiveTab('ai');
    };
    window.addEventListener(AI_OPEN_PLUGINS_EVENT, onOpenAi);
    return () => {
      window.removeEventListener(AI_OPEN_PLUGINS_EVENT, onOpenAi);
    };
  }, []);

  const installedThemeIds = new Set(installedThemes.map((theme) => theme.id));
  const installedSidebarIds = new Set(installedSidebar.map((item) => item.id));
  const availableThemes = themeCatalog.filter((entry) => !installedThemeIds.has(entry.id));
  const availableSidebar = sidebarCatalog.filter((entry) => !installedSidebarIds.has(entry.id));

  const handleInstallTheme = async (entry: ThemeCatalogEntry) => {
    setBusyId(entry.id);
    setInstallProgress(0);
    try {
      const result = await installThemePlugin(entry.id);
      if (!result.ok) {
        showToast(result.error, { kind: 'error', title: 'Плагины' });
        return;
      }

      setInstallProgress(1);
      await sleep(180);
      setInstalledThemes(await listInstalledThemePlugins());
      showToast(`${entry.name} установлен`, { kind: 'success', title: 'Плагины' });
    } finally {
      setBusyId(null);
      setInstallProgress(0);
    }
  };

  const handleApplyTheme = async (themeId: string, label: string) => {
    if (settings.theme === themeId) {
      return;
    }
    setBusyId(themeId);
    try {
      await updateSettings({ theme: themeId });
      showToast(`Тема «${label}» применена`, { kind: 'success', title: 'Плагины' });
    } finally {
      setBusyId(null);
    }
  };

  const handleUninstallTheme = async (theme: InstalledThemePlugin) => {
    setBusyId(theme.id);
    try {
      const result = await uninstallThemePlugin(theme.id);
      if (!result.ok) {
        showToast(result.error, { kind: 'error', title: 'Плагины' });
        return;
      }

      if (settings.theme === theme.id) {
        await updateSettings({ theme: DEFAULT_THEME_ID });
      } else {
        await reloadSettings();
      }

      setInstalledThemes(await listInstalledThemePlugins());
      showToast(`${theme.name} удалён`, { kind: 'success', title: 'Плагины' });
    } finally {
      setBusyId(null);
    }
  };

  const handleInstallSidebar = async (entry: SidebarAnimationCatalogEntry) => {
    setBusyId(`sidebar:${entry.id}`);
    setInstallProgress(0);
    try {
      const result = await installSidebarAnimationPlugin(entry.id);
      if (!result.ok) {
        showToast(result.error, { kind: 'error', title: 'Плагины' });
        return;
      }

      setInstallProgress(1);
      await sleep(180);
      setInstalledSidebar(await listInstalledSidebarAnimations());
      showToast(`${entry.name} установлен`, { kind: 'success', title: 'Плагины' });
    } finally {
      setBusyId(null);
      setInstallProgress(0);
    }
  };

  const handleApplySidebar = async (id: string, label: string) => {
    if (settings.sidebarMenuAnimation === id) {
      return;
    }
    setBusyId(`sidebar:${id}`);
    try {
      await updateSettings({ sidebarMenuAnimation: id });
      showToast(`Анимация «${label}» применена`, { kind: 'success', title: 'Плагины' });
    } finally {
      setBusyId(null);
    }
  };

  const handleUninstallSidebar = async (plugin: InstalledSidebarAnimationPlugin) => {
    setBusyId(`sidebar:${plugin.id}`);
    try {
      const result = await uninstallSidebarAnimationPlugin(plugin.id);
      if (!result.ok) {
        showToast(result.error, { kind: 'error', title: 'Плагины' });
        return;
      }

      if (settings.sidebarMenuAnimation === plugin.id) {
        await updateSettings({ sidebarMenuAnimation: DEFAULT_SIDEBAR_ANIMATION_ID });
      } else {
        await reloadSettings();
      }

      setInstalledSidebar(await listInstalledSidebarAnimations());
      showToast(`${plugin.name} удалён`, { kind: 'success', title: 'Плагины' });
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="settings-view page-state-shell">
        <PageLoading title="Загрузка плагинов..." centered />
      </div>
    );
  }

  return (
    <div className="settings-view">
      <header className="settings-view__header">
        <h1 className="settings-view__title">Плагины</h1>
        <p className="settings-view__subtitle">Темы, анимации меню и локальные ИИ-модели</p>

        <Tabs
          items={[...PLUGIN_TABS]}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as PluginTabId)}
          ariaLabel="Типы плагинов"
          variant="segmented"
        />
      </header>

      <div ref={scrollRef} className="settings-view__content scroll-overlay">
        {activeTab === 'themes' ? (
          <div className="settings-panels-grid">
            <section className="settings-group" aria-labelledby="plugins-installed-themes-title">
              <h2 id="plugins-installed-themes-title" className="settings-group__title">
                Установленные
              </h2>
              <div className="settings-panel">
                {installedThemes.length === 0 ? (
                  <p className="settings-hidden-empty">Нет установленных тем — поставь из каталога ниже</p>
                ) : (
                  <div className="settings-theme-grid" role="radiogroup" aria-label="Установленные темы">
                    {installedThemes.map((theme) => {
                      const isActive = settings.theme === theme.id;
                      const busy = busyId === theme.id;

                      return (
                        <div
                          key={theme.id}
                          className={`plugins-item${isActive ? ' plugins-item--active' : ''}`}
                        >
                          <button
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            className={`settings-theme-card${
                              isActive ? ' settings-theme-card--active' : ''
                            }`}
                            disabled={busy}
                            onClick={() => void handleApplyTheme(theme.id, theme.name)}
                          >
                            <PluginPreview bg={theme.preview.bg} accent={theme.preview.accent} />
                            <span className="settings-theme-card__body">
                              <span className="settings-theme-card__label">{theme.name}</span>
                              <span className="settings-theme-card__description">
                                {theme.description}
                              </span>
                            </span>
                            <span className="settings-theme-card__check">
                              <SettingsCheckbox checked={isActive} decorative />
                            </span>
                          </button>
                          <button
                            type="button"
                            className="plugins-item__remove"
                            disabled={busy}
                            aria-label={`Удалить ${theme.name}`}
                            onClick={() => void handleUninstallTheme(theme)}
                          >
                            <TrashIcon size={15} strokeWidth={1.9} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <p className="settings-group__footer">
                Нажми тему, чтобы применить. Встроенная — Обсидиан, в Настройки → Оформление.
              </p>
            </section>

            <section className="settings-group" aria-labelledby="plugins-theme-catalog-title">
              <h2 id="plugins-theme-catalog-title" className="settings-group__title">
                Каталог
              </h2>
              <div className="settings-panel">
                {catalogError ? (
                  <p className="settings-hidden-empty plugins-error-text">{catalogError}</p>
                ) : null}

                {!catalogError && availableThemes.length === 0 ? (
                  <p className="settings-hidden-empty">Всё установлено — новых тем нет</p>
                ) : null}

                {availableThemes.length > 0 ? (
                  <div className="settings-theme-grid">
                    {availableThemes.map((entry) => {
                      const busy = busyId === entry.id;
                      const percent = Math.round(installProgress * 100);

                      return (
                        <button
                          key={entry.id}
                          type="button"
                          className={`settings-theme-card plugins-catalog-card${
                            busy ? ' plugins-catalog-card--busy' : ''
                          }`}
                          disabled={busy || Boolean(busyId)}
                          onClick={() => void handleInstallTheme(entry)}
                        >
                          {busy ? (
                            <span
                              className="plugins-catalog-card__progress"
                              style={{ width: `${percent}%` }}
                              aria-hidden="true"
                            />
                          ) : null}
                          <PluginPreview bg={entry.preview.bg} accent={entry.preview.accent} />
                          <span className="settings-theme-card__body">
                            <span className="settings-theme-card__label">{entry.name}</span>
                            <span className="settings-theme-card__description">
                              {entry.description}
                            </span>
                          </span>
                          <span className="plugins-catalog-card__action">
                            {busy ? `${percent}%` : 'Установить'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="settings-data-actions">
                  <button
                    type="button"
                    className="settings-action-btn"
                    disabled={isRefreshing}
                    onClick={() => void refresh({ soft: true })}
                  >
                    <SettingsGlyph tone="blue">
                      <HistoryIcon size={15} strokeWidth={1.9} />
                    </SettingsGlyph>
                    {isRefreshing ? 'Обновление…' : 'Обновить каталог'}
                  </button>
                </div>
              </div>
              <p className="settings-group__footer">
                Установка сохраняет тему локально. Офлайн — из встроенного каталога.
              </p>
            </section>
          </div>
        ) : null}

        {activeTab === 'sidebar' ? (
          <div className="settings-panels-grid">
            <section className="settings-group" aria-labelledby="plugins-installed-sidebar-title">
              <h2 id="plugins-installed-sidebar-title" className="settings-group__title">
                Установленные
              </h2>
              <div className="settings-panel">
                {installedSidebar.length === 0 ? (
                  <p className="settings-hidden-empty">
                    Нет доп. анимаций — по умолчанию Водяной магнит
                  </p>
                ) : (
                  <div
                    className="settings-theme-grid"
                    role="radiogroup"
                    aria-label="Установленные анимации"
                  >
                    {installedSidebar.map((plugin) => {
                      const isActive = settings.sidebarMenuAnimation === plugin.id;
                      const busy = busyId === `sidebar:${plugin.id}`;

                      return (
                        <div
                          key={plugin.id}
                          className={`plugins-item${isActive ? ' plugins-item--active' : ''}`}
                        >
                          <button
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            className={`settings-theme-card${
                              isActive ? ' settings-theme-card--active' : ''
                            }`}
                            disabled={busy}
                            onClick={() => void handleApplySidebar(plugin.id, plugin.name)}
                          >
                            <PluginPreview bg={plugin.preview.bg} accent={plugin.preview.accent} />
                            <span className="settings-theme-card__body">
                              <span className="settings-theme-card__label">{plugin.name}</span>
                              <span className="settings-theme-card__description">
                                {plugin.description}
                              </span>
                            </span>
                            <span className="settings-theme-card__check">
                              <SettingsCheckbox checked={isActive} decorative />
                            </span>
                          </button>
                          <button
                            type="button"
                            className="plugins-item__remove"
                            disabled={busy}
                            aria-label={`Удалить ${plugin.name}`}
                            onClick={() => void handleUninstallSidebar(plugin)}
                          >
                            <TrashIcon size={15} strokeWidth={1.9} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <p className="settings-group__footer">
                После установки анимация также появится в Настройки → Интерфейс.
              </p>
            </section>

            <section className="settings-group" aria-labelledby="plugins-sidebar-catalog-title">
              <h2 id="plugins-sidebar-catalog-title" className="settings-group__title">
                Каталог
              </h2>
              <div className="settings-panel">
                {catalogError ? (
                  <p className="settings-hidden-empty plugins-error-text">{catalogError}</p>
                ) : null}

                {!catalogError && availableSidebar.length === 0 ? (
                  <p className="settings-hidden-empty">Всё установлено — новых анимаций нет</p>
                ) : null}

                {availableSidebar.length > 0 ? (
                  <div className="settings-theme-grid">
                    {availableSidebar.map((entry) => {
                      const busy = busyId === `sidebar:${entry.id}`;
                      const percent = Math.round(installProgress * 100);

                      return (
                        <button
                          key={entry.id}
                          type="button"
                          className={`settings-theme-card plugins-catalog-card${
                            busy ? ' plugins-catalog-card--busy' : ''
                          }`}
                          disabled={busy || Boolean(busyId)}
                          onClick={() => void handleInstallSidebar(entry)}
                        >
                          {busy ? (
                            <span
                              className="plugins-catalog-card__progress"
                              style={{ width: `${percent}%` }}
                              aria-hidden="true"
                            />
                          ) : null}
                          <PluginPreview bg={entry.preview.bg} accent={entry.preview.accent} />
                          <span className="settings-theme-card__body">
                            <span className="settings-theme-card__label">{entry.name}</span>
                            <span className="settings-theme-card__description">
                              {entry.description}
                            </span>
                          </span>
                          <span className="plugins-catalog-card__action">
                            {busy ? `${percent}%` : 'Установить'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="settings-data-actions">
                  <button
                    type="button"
                    className="settings-action-btn"
                    disabled={isRefreshing}
                    onClick={() => void refresh({ soft: true })}
                  >
                    <SettingsGlyph tone="blue">
                      <HistoryIcon size={15} strokeWidth={1.9} />
                    </SettingsGlyph>
                    {isRefreshing ? 'Обновление…' : 'Обновить каталог'}
                  </button>
                </div>
              </div>
              <p className="settings-group__footer">
                Жидкое свечение, Змейка, Магнит, Пульс и другие эффекты меню.
              </p>
            </section>
          </div>
        ) : null}

        {activeTab === 'ai' ? <AiPluginsPanel /> : null}
      </div>
    </div>
  );
}
