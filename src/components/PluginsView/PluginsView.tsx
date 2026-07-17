import { useCallback, useEffect, useState } from 'react';
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
import { useToast } from '@/shared/ui/Toast/ToastContext';
import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import { PageLoading } from '@/shared/ui/PageState';
import { Tabs } from '@/shared/ui/Tabs';
import './PluginsView.css';

const PLUGIN_TABS = [
  { id: 'themes', label: 'Темы' },
  { id: 'sidebar', label: 'Меню' },
] as const;

type PluginTabId = (typeof PLUGIN_TABS)[number]['id'];

function ThemePreview({ bg, accent }: { bg: string; accent: string }) {
  return (
    <span className="plugins-card__preview" aria-hidden="true">
      <span className="plugins-card__preview-field" style={{ background: bg }} />
      <span className="plugins-card__preview-accent" style={{ background: accent }} />
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

  const installedThemeIds = new Set(installedThemes.map((theme) => theme.id));
  const installedSidebarIds = new Set(installedSidebar.map((item) => item.id));
  const availableThemes = themeCatalog.filter((entry) => !installedThemeIds.has(entry.id));
  const availableSidebar = sidebarCatalog.filter((entry) => !installedSidebarIds.has(entry.id));

  const handleInstallTheme = async (entry: ThemeCatalogEntry) => {
    setBusyId(entry.id);
    try {
      const result = await installThemePlugin(entry.id);
      if (!result.ok) {
        showToast(result.error, { kind: 'error', title: 'Плагины' });
        return;
      }

      setInstalledThemes(await listInstalledThemePlugins());
      showToast(`${entry.name} установлен`, { kind: 'success', title: 'Плагины' });
    } finally {
      setBusyId(null);
    }
  };

  const handleApplyTheme = async (themeId: string, label: string) => {
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
    try {
      const result = await installSidebarAnimationPlugin(entry.id);
      if (!result.ok) {
        showToast(result.error, { kind: 'error', title: 'Плагины' });
        return;
      }

      setInstalledSidebar(await listInstalledSidebarAnimations());
      showToast(`${entry.name} установлен`, { kind: 'success', title: 'Плагины' });
    } finally {
      setBusyId(null);
    }
  };

  const handleApplySidebar = async (id: string, label: string) => {
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
      <div className="plugins-view page-state-shell">
        <PageLoading title="Загрузка плагинов..." centered />
      </div>
    );
  }

  return (
    <div className="plugins-view">
      <header className="plugins-view__header">
        <div className="plugins-view__heading">
          <h1 className="plugins-view__title">Плагины</h1>
          <p className="plugins-view__subtitle">
            Темы и анимации меню с GitHub. По умолчанию — Обсидиан и Водяной магнит.
          </p>

          <div className="plugins-view__tabs">
            <Tabs
              items={[...PLUGIN_TABS]}
              activeId={activeTab}
              onChange={(id) => setActiveTab(id as PluginTabId)}
              ariaLabel="Типы плагинов"
              variant="settings"
            />
          </div>
        </div>

        <button
          type="button"
          className="plugins-btn plugins-btn--ghost"
          disabled={isRefreshing}
          onClick={() => void refresh({ soft: true })}
        >
          {isRefreshing ? 'Обновление…' : 'Обновить каталог'}
        </button>
      </header>

      <div ref={scrollRef} className="plugins-view__content scroll-overlay">
        {activeTab === 'themes' ? (
          <>
            <section className="plugins-section" aria-labelledby="plugins-installed-themes-title">
              <div className="plugins-section__head">
                <div>
                  <h2 id="plugins-installed-themes-title" className="plugins-section__title">
                    Установленные темы
                  </h2>
                  <p className="plugins-section__hint">
                    {installedThemes.length === 0
                      ? 'Пока пусто — поставь тему из каталога ниже'
                      : `${installedThemes.length} ${installedThemes.length === 1 ? 'тема' : 'тем'}`}
                  </p>
                </div>
              </div>

              {installedThemes.length === 0 ? (
                <div className="plugins-empty">
                  <p className="plugins-empty__title">Нет установленных тем</p>
                  <p className="plugins-empty__text">
                    В каталоге ниже можно скачать Оникс, Ноктюрн, Янтарь и другие.
                  </p>
                </div>
              ) : (
                <div className="plugins-grid">
                  {installedThemes.map((theme) => {
                    const isActive = settings.theme === theme.id;
                    const busy = busyId === theme.id;

                    return (
                      <article
                        key={theme.id}
                        className={`plugins-card${isActive ? ' plugins-card--active' : ''}`}
                      >
                        <ThemePreview bg={theme.preview.bg} accent={theme.preview.accent} />
                        <div className="plugins-card__body">
                          <div className="plugins-card__top">
                            <h3 className="plugins-card__name">{theme.name}</h3>
                            {isActive ? (
                              <span className="plugins-card__badge">Активна</span>
                            ) : (
                              <span className="plugins-card__badge plugins-card__badge--muted">
                                v{theme.version}
                              </span>
                            )}
                          </div>
                          <p className="plugins-card__description">{theme.description}</p>
                        </div>
                        <div className="plugins-card__actions">
                          <button
                            type="button"
                            className="plugins-btn plugins-btn--primary"
                            disabled={busy || isActive}
                            onClick={() => void handleApplyTheme(theme.id, theme.name)}
                          >
                            {isActive ? 'Выбрана' : 'Применить'}
                          </button>
                          <button
                            type="button"
                            className="plugins-btn plugins-btn--ghost"
                            disabled={busy}
                            onClick={() => void handleUninstallTheme(theme)}
                          >
                            Удалить
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="plugins-section" aria-labelledby="plugins-theme-catalog-title">
              <div className="plugins-section__head">
                <div>
                  <h2 id="plugins-theme-catalog-title" className="plugins-section__title">
                    Каталог тем
                  </h2>
                  <p className="plugins-section__hint">
                    Установка сохраняет тему локально. Офлайн — из встроенного каталога.
                  </p>
                </div>
              </div>

              {catalogError ? <p className="plugins-error">{catalogError}</p> : null}

              {availableThemes.length === 0 && !catalogError ? (
                <div className="plugins-empty">
                  <p className="plugins-empty__title">Всё установлено</p>
                  <p className="plugins-empty__text">В каталоге больше нет новых тем.</p>
                </div>
              ) : (
                <div className="plugins-grid">
                  {availableThemes.map((entry) => {
                    const busy = busyId === entry.id;

                    return (
                      <article key={entry.id} className="plugins-card">
                        <ThemePreview bg={entry.preview.bg} accent={entry.preview.accent} />
                        <div className="plugins-card__body">
                          <div className="plugins-card__top">
                            <h3 className="plugins-card__name">{entry.name}</h3>
                            <span className="plugins-card__badge plugins-card__badge--muted">
                              v{entry.version}
                            </span>
                          </div>
                          <p className="plugins-card__description">{entry.description}</p>
                        </div>
                        <div className="plugins-card__actions">
                          <button
                            type="button"
                            className="plugins-btn plugins-btn--primary"
                            disabled={busy}
                            onClick={() => void handleInstallTheme(entry)}
                          >
                            {busy ? 'Установка…' : 'Установить'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <section className="plugins-section" aria-labelledby="plugins-installed-sidebar-title">
              <div className="plugins-section__head">
                <div>
                  <h2 id="plugins-installed-sidebar-title" className="plugins-section__title">
                    Установленные анимации
                  </h2>
                  <p className="plugins-section__hint">
                    {installedSidebar.length === 0
                      ? 'По умолчанию доступен Водяной магнит'
                      : `${installedSidebar.length} доп. ${installedSidebar.length === 1 ? 'анимация' : 'анимаций'}`}
                  </p>
                </div>
              </div>

              {installedSidebar.length === 0 ? (
                <div className="plugins-empty">
                  <p className="plugins-empty__title">Нет установленных анимаций</p>
                  <p className="plugins-empty__text">
                    Скачай Жидкое свечение, Змейку, Магнит или Пульс из каталога.
                  </p>
                </div>
              ) : (
                <div className="plugins-grid">
                  {installedSidebar.map((plugin) => {
                    const isActive = settings.sidebarMenuAnimation === plugin.id;
                    const busy = busyId === `sidebar:${plugin.id}`;

                    return (
                      <article
                        key={plugin.id}
                        className={`plugins-card${isActive ? ' plugins-card--active' : ''}`}
                      >
                        <ThemePreview bg={plugin.preview.bg} accent={plugin.preview.accent} />
                        <div className="plugins-card__body">
                          <div className="plugins-card__top">
                            <h3 className="plugins-card__name">{plugin.name}</h3>
                            {isActive ? (
                              <span className="plugins-card__badge">Активна</span>
                            ) : (
                              <span className="plugins-card__badge plugins-card__badge--muted">
                                v{plugin.version}
                              </span>
                            )}
                          </div>
                          <p className="plugins-card__description">{plugin.description}</p>
                        </div>
                        <div className="plugins-card__actions">
                          <button
                            type="button"
                            className="plugins-btn plugins-btn--primary"
                            disabled={busy || isActive}
                            onClick={() => void handleApplySidebar(plugin.id, plugin.name)}
                          >
                            {isActive ? 'Выбрана' : 'Применить'}
                          </button>
                          <button
                            type="button"
                            className="plugins-btn plugins-btn--ghost"
                            disabled={busy}
                            onClick={() => void handleUninstallSidebar(plugin)}
                          >
                            Удалить
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="plugins-section" aria-labelledby="plugins-sidebar-catalog-title">
              <div className="plugins-section__head">
                <div>
                  <h2 id="plugins-sidebar-catalog-title" className="plugins-section__title">
                    Каталог анимаций
                  </h2>
                  <p className="plugins-section__hint">
                    После установки анимация появится в Настройки → Интерфейс.
                  </p>
                </div>
              </div>

              {catalogError ? <p className="plugins-error">{catalogError}</p> : null}

              {availableSidebar.length === 0 && !catalogError ? (
                <div className="plugins-empty">
                  <p className="plugins-empty__title">Всё установлено</p>
                  <p className="plugins-empty__text">В каталоге больше нет новых анимаций.</p>
                </div>
              ) : (
                <div className="plugins-grid">
                  {availableSidebar.map((entry) => {
                    const busy = busyId === `sidebar:${entry.id}`;

                    return (
                      <article key={entry.id} className="plugins-card">
                        <ThemePreview bg={entry.preview.bg} accent={entry.preview.accent} />
                        <div className="plugins-card__body">
                          <div className="plugins-card__top">
                            <h3 className="plugins-card__name">{entry.name}</h3>
                            <span className="plugins-card__badge plugins-card__badge--muted">
                              v{entry.version}
                            </span>
                          </div>
                          <p className="plugins-card__description">{entry.description}</p>
                        </div>
                        <div className="plugins-card__actions">
                          <button
                            type="button"
                            className="plugins-btn plugins-btn--primary"
                            disabled={busy}
                            onClick={() => void handleInstallSidebar(entry)}
                          >
                            {busy ? 'Установка…' : 'Установить'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
