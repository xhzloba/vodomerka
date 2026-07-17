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

export function PluginsView() {
  const scrollRef = useOverlayScroll<HTMLDivElement>();
  const { settings, updateSettings, reloadSettings } = useAppSettings();
  const { showToast } = useToast();
  const [catalog, setCatalog] = useState<ThemeCatalogEntry[]>([]);
  const [installed, setInstalled] = useState<InstalledThemePlugin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
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
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const installedIds = new Set(installed.map((theme) => theme.id));

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
        <div>
          <h1 className="plugins-view__title">Плагины</h1>
          <p className="plugins-view__subtitle">
            Темы интерфейса. По умолчанию — Обсидиан. Каталог подгружается с GitHub, пакеты
            сохраняются локально.
          </p>
        </div>

        <button type="button" className="plugins-view__refresh" onClick={() => void refresh()}>
          Обновить каталог
        </button>
      </header>

      <div ref={scrollRef} className="plugins-view__content scroll-overlay">
        <section className="plugins-panel" aria-labelledby="plugins-installed-title">
          <div className="plugins-panel__intro">
            <h2 id="plugins-installed-title" className="plugins-panel__title">
              Установленные темы
            </h2>
            <p className="plugins-panel__description">
              Встроенные темы всегда доступны в настройках. Здесь — скачанные пакеты.
            </p>
          </div>

          {installed.length === 0 ? (
            <p className="plugins-empty">Пока нет установленных тем из каталога.</p>
          ) : (
            <div className="plugins-grid">
              {installed.map((theme) => {
                const isActive = settings.theme === theme.id;
                const busy = busyId === theme.id;

                return (
                  <article key={theme.id} className="plugins-card">
                    <span
                      className="plugins-card__preview"
                      style={{
                        background: `linear-gradient(135deg, ${theme.preview.bg}, ${theme.preview.accent})`,
                      }}
                      aria-hidden="true"
                    />
                    <div className="plugins-card__body">
                      <h3 className="plugins-card__name">{theme.name}</h3>
                      <p className="plugins-card__meta">
                        v{theme.version}
                        {isActive ? ' · активна' : ''}
                      </p>
                      <p className="plugins-card__description">{theme.description}</p>
                    </div>
                    <div className="plugins-card__actions">
                      <button
                        type="button"
                        className="plugins-card__btn plugins-card__btn--primary"
                        disabled={busy || isActive}
                        onClick={() => void handleApply(theme.id, theme.name)}
                      >
                        {isActive ? 'Выбрана' : 'Применить'}
                      </button>
                      <button
                        type="button"
                        className="plugins-card__btn"
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

        <section className="plugins-panel" aria-labelledby="plugins-catalog-title">
          <div className="plugins-panel__intro">
            <h2 id="plugins-catalog-title" className="plugins-panel__title">
              Каталог
            </h2>
            <p className="plugins-panel__description">
              Готовые темы с GitHub. При офлайне используется встроенный каталог.
            </p>
          </div>

          {catalogError ? <p className="plugins-empty">{catalogError}</p> : null}

          <div className="plugins-grid">
            {catalog.map((entry) => {
              const already = installedIds.has(entry.id);
              const busy = busyId === entry.id;

              return (
                <article key={entry.id} className="plugins-card">
                  <span
                    className="plugins-card__preview"
                    style={{
                      background: `linear-gradient(135deg, ${entry.preview.bg}, ${entry.preview.accent})`,
                    }}
                    aria-hidden="true"
                  />
                  <div className="plugins-card__body">
                    <h3 className="plugins-card__name">{entry.name}</h3>
                    <p className="plugins-card__meta">v{entry.version}</p>
                    <p className="plugins-card__description">{entry.description}</p>
                  </div>
                  <div className="plugins-card__actions">
                    <button
                      type="button"
                      className="plugins-card__btn plugins-card__btn--primary"
                      disabled={busy || already}
                      onClick={() => void handleInstall(entry)}
                    >
                      {already ? 'Установлена' : busy ? 'Установка…' : 'Установить'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
