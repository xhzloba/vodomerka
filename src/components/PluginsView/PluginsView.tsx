import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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
import { useAppTopProgress } from '@/shared/ui/AppTopProgress/AppTopProgressContext';
import { PageLoading } from '@/shared/ui/PageState';
import { Tabs } from '@/shared/ui/Tabs';
import { ChevronDownIcon } from '@/shared/ui/icons/icons';
import './PluginsView.css';

const PLUGIN_TABS = [
  { id: 'themes', label: 'Темы' },
  { id: 'sidebar', label: 'Меню' },
] as const;

type PluginTabId = (typeof PLUGIN_TABS)[number]['id'];

const INSTALL_BORDER_RADIUS = 12;
const INSTALL_STROKE = 2;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function ThemePreview({ bg, accent }: { bg: string; accent: string }) {
  return (
    <span className="plugins-card__preview" aria-hidden="true">
      <span className="plugins-card__preview-field" style={{ background: bg }} />
      <span className="plugins-card__preview-accent" style={{ background: accent }} />
    </span>
  );
}

function InstallBorderProgress({ progress }: { progress: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const value = clamp01(progress);

  useLayoutEffect(() => {
    const host = svgRef.current?.parentElement;
    if (!host) {
      return;
    }

    const update = () => {
      const rect = host.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const inset = INSTALL_STROKE / 2;
  const width = Math.max(0, size.width - INSTALL_STROKE);
  const height = Math.max(0, size.height - INSTALL_STROKE);
  const radius = Math.max(0, INSTALL_BORDER_RADIUS - inset);
  const dashOffset = 100 * (1 - value);

  return (
    <svg ref={svgRef} className="plugins-card__install-border" aria-hidden="true">
      {width > 0 && height > 0 ? (
        <>
          <rect
            className="plugins-card__install-track"
            x={inset}
            y={inset}
            width={width}
            height={height}
            rx={radius}
            ry={radius}
            pathLength={100}
          />
          <rect
            className="plugins-card__install-bar"
            x={inset}
            y={inset}
            width={width}
            height={height}
            rx={radius}
            ry={radius}
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={dashOffset}
          />
        </>
      ) : null}
    </svg>
  );
}

function CollapsibleInstalledSection({
  id,
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const panelId = `${id}-panel`;

  return (
    <section className="plugins-section" aria-labelledby={id}>
      <button
        type="button"
        className={`plugins-section__toggle${open ? ' plugins-section__toggle--open' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="plugins-section__toggle-text">
          <span id={id} className="plugins-section__title">
            {title}
          </span>
          <span className="plugins-section__hint">{hint}</span>
        </span>
        <ChevronDownIcon size={20} className="plugins-section__chevron" />
      </button>

      <div
        id={panelId}
        className={`plugins-collapse${open ? ' plugins-collapse--open' : ''}`}
        role="region"
        aria-labelledby={id}
        aria-hidden={!open}
        ref={(node) => {
          if (!node) {
            return;
          }
          if (!open) {
            node.setAttribute('inert', '');
          } else {
            node.removeAttribute('inert');
          }
        }}
      >
        <div className="plugins-collapse__inner">{children}</div>
      </div>
    </section>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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
  const [themesInstalledOpen, setThemesInstalledOpen] = useState(true);
  const [sidebarInstalledOpen, setSidebarInstalledOpen] = useState(true);
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
            <CollapsibleInstalledSection
              id="plugins-installed-themes-title"
              title="Установленные темы"
              hint={
                installedThemes.length === 0
                  ? 'Пока пусто — поставь тему из каталога ниже'
                  : `${installedThemes.length} ${installedThemes.length === 1 ? 'тема' : 'тем'}`
              }
              open={themesInstalledOpen}
              onToggle={() => setThemesInstalledOpen((value) => !value)}
            >
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
            </CollapsibleInstalledSection>

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
                      <article
                        key={entry.id}
                        className={`plugins-card${busy ? ' plugins-card--installing' : ''}`}
                      >
                        {busy ? <InstallBorderProgress progress={installProgress} /> : null}
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
            <CollapsibleInstalledSection
              id="plugins-installed-sidebar-title"
              title="Установленные анимации"
              hint={
                installedSidebar.length === 0
                  ? 'По умолчанию доступен Водяной магнит'
                  : `${installedSidebar.length} доп. ${installedSidebar.length === 1 ? 'анимация' : 'анимаций'}`
              }
              open={sidebarInstalledOpen}
              onToggle={() => setSidebarInstalledOpen((value) => !value)}
            >
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
            </CollapsibleInstalledSection>

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
                      <article
                        key={entry.id}
                        className={`plugins-card${busy ? ' plugins-card--installing' : ''}`}
                      >
                        {busy ? <InstallBorderProgress progress={installProgress} /> : null}
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
