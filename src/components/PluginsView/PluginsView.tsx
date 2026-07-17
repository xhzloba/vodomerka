import { useCallback, useEffect, useState } from 'react';
import type { InstalledThemePlugin, ThemeCatalogEntry } from '../../../contracts/ipc';
import { DEFAULT_THEME_ID } from '../../../contracts/ipc';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import {
  fetchThemeCatalog,
  installThemePlugin,
  listInstalledThemePlugins,
  uninstallThemePlugin,
} from '@/shared/plugins/themePlugins';
import { useToast } from '@/shared/ui/Toast/ToastContext';
import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import { PageLoading } from '@/shared/ui/PageState';
import './PluginsView.css';

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
  const [catalog, setCatalog] = useState<ThemeCatalogEntry[]>([]);
  const [installed, setInstalled] = useState<InstalledThemePlugin[]>([]);
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
      const [catalogResult, installedThemes] = await Promise.all([
        fetchThemeCatalog(),
        listInstalledThemePlugins(),
      ]);

      setInstalled(installedThemes);

      if (!catalogResult.ok) {
        setCatalogError(catalogResult.error);
        setCatalog([]);
      } else {
        setCatalog(catalogResult.data.themes);
      }
    } catch {
      setCatalogError('Не удалось загрузить плагины');
      setCatalog([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const installedIds = new Set(installed.map((theme) => theme.id));
  const availableCatalog = catalog.filter((entry) => !installedIds.has(entry.id));

  const handleInstall = async (entry: ThemeCatalogEntry) => {
    setBusyId(entry.id);
    try {
      const result = await installThemePlugin(entry.id);
      if (!result.ok) {
        showToast(result.error, { kind: 'error', title: 'Плагины' });
        return;
      }

      setInstalled(await listInstalledThemePlugins());
      showToast(`${entry.name} установлен`, { kind: 'success', title: 'Плагины' });
    } finally {
      setBusyId(null);
    }
  };

  const handleApply = async (themeId: string, label: string) => {
    setBusyId(themeId);
    try {
      await updateSettings({ theme: themeId });
      showToast(`Тема «${label}» применена`, { kind: 'success', title: 'Плагины' });
    } finally {
      setBusyId(null);
    }
  };

  const handleUninstall = async (theme: InstalledThemePlugin) => {
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

      setInstalled(await listInstalledThemePlugins());
      showToast(`${theme.name} удалён`, { kind: 'success', title: 'Плагины' });
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
            Темы интерфейса с GitHub. По умолчанию — Обсидиан.
          </p>
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
        <section className="plugins-section" aria-labelledby="plugins-installed-title">
          <div className="plugins-section__head">
            <div>
              <h2 id="plugins-installed-title" className="plugins-section__title">
                Установленные
              </h2>
              <p className="plugins-section__hint">
                {installed.length === 0
                  ? 'Пока пусто — поставь тему из каталога ниже'
                  : `${installed.length} ${installed.length === 1 ? 'тема' : 'тем'}`}
              </p>
            </div>
          </div>

          {installed.length === 0 ? (
            <div className="plugins-empty">
              <p className="plugins-empty__title">Нет установленных тем</p>
              <p className="plugins-empty__text">
                В каталоге ниже можно скачать Оникс, Ноктюрн, Янтарь и другие.
              </p>
            </div>
          ) : (
            <div className="plugins-grid">
              {installed.map((theme) => {
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
                        onClick={() => void handleApply(theme.id, theme.name)}
                      >
                        {isActive ? 'Выбрана' : 'Применить'}
                      </button>
                      <button
                        type="button"
                        className="plugins-btn plugins-btn--ghost"
                        disabled={busy}
                        onClick={() => void handleUninstall(theme)}
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

        <section className="plugins-section" aria-labelledby="plugins-catalog-title">
          <div className="plugins-section__head">
            <div>
              <h2 id="plugins-catalog-title" className="plugins-section__title">
                Каталог
              </h2>
              <p className="plugins-section__hint">
                Установка сохраняет тему локально. Офлайн — из встроенного каталога.
              </p>
            </div>
          </div>

          {catalogError ? <p className="plugins-error">{catalogError}</p> : null}

          {availableCatalog.length === 0 && !catalogError ? (
            <div className="plugins-empty">
              <p className="plugins-empty__title">Всё установлено</p>
              <p className="plugins-empty__text">В каталоге больше нет новых тем.</p>
            </div>
          ) : (
            <div className="plugins-grid">
              {availableCatalog.map((entry) => {
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
                        onClick={() => void handleInstall(entry)}
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
      </div>
    </div>
  );
}
