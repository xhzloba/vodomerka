import { useEffect, useState } from 'react';
import { HomeSettingsPanels } from '@/features/home/ui/HomeSettingsPanels';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import { useApiServerHealth } from '@/shared/settings/useApiServerHealth';
import { listInstalledThemePlugins } from '@/shared/plugins/themePlugins';
import { listInstalledSidebarAnimations } from '@/shared/plugins/sidebarPlugins';
import type { InstalledSidebarAnimationPlugin, InstalledThemePlugin } from '../../../contracts/ipc';
import { useFavorites } from '@/shared/domain/FavoritesContext';
import { useRecentlyViewed } from '@/shared/domain/RecentlyViewedContext';
import { useWatched } from '@/shared/domain/WatchedContext';
import { useToast } from '@/shared/ui/Toast/ToastContext';
import { playDeleteSound } from '@/shared/audio/uiSounds';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { SettingsCheckbox } from '@/shared/ui/SettingsControls/SettingsCheckbox';
import { SettingsGlyph } from '@/shared/ui/SettingsControls/SettingsGlyph';
import { SettingsSwitch } from '@/shared/ui/SettingsControls/SettingsSwitch';
import {
  CoverSpacingIcon,
  FilmIcon,
  GridIcon,
  InfoIcon,
  LayersIcon,
  PuzzleIcon,
  TrashIcon,
  WatchingIcon,
} from '@/shared/ui/icons';
import { APP_THEME_OPTIONS } from '@/shared/settings/themes';
import {
  POSTER_SIZE_OPTIONS,
  API_SERVER_OPTIONS,
  SIDEBAR_MENU_ANIMATION_OPTIONS,
  SIDEBAR_STYLE_OPTIONS,
} from '@/shared/settings/types';
import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import { PageLoading } from '@/shared/ui/PageState';
import { Tabs } from '@/shared/ui/Tabs';
import './SettingsView.css';

const SETTINGS_TABS = [
  { id: 'appearance', label: 'Оформление' },
  { id: 'home', label: 'Главная' },
  { id: 'interface', label: 'Интерфейс' },
  { id: 'network', label: 'Сеть' },
  { id: 'sounds', label: 'Звуки' },
  { id: 'data', label: 'Данные' },
] as const;

type SettingsTabId = (typeof SETTINGS_TABS)[number]['id'];

function apiServerHealthHint(
  status: 'idle' | 'checking' | 'ok' | 'fail',
  fallback: string,
): string {
  if (status === 'checking') {
    return 'Проверка…';
  }
  if (status === 'ok') {
    return 'Доступен';
  }
  if (status === 'fail') {
    return 'Не отвечает';
  }
  return fallback;
}

export function SettingsView() {
  const scrollRef = useOverlayScroll<HTMLDivElement>();
  const { settings, isLoading, updateSettings, resetToDefaults, reloadSettings } = useAppSettings();
  const { reloadFavorites } = useFavorites();
  const { reloadRecentlyViewed } = useRecentlyViewed();
  const { reloadWatched } = useWatched();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTabId>('appearance');
  const { health, isChecking, check: checkApiServers } = useApiServerHealth();
  const [installedThemes, setInstalledThemes] = useState<InstalledThemePlugin[]>([]);
  const [installedSidebarAnimations, setInstalledSidebarAnimations] = useState<
    InstalledSidebarAnimationPlugin[]
  >([]);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const canBackup = Boolean(window.electronAPI?.backup);

  useEffect(() => {
    if (activeTab !== 'appearance' && activeTab !== 'interface') {
      return;
    }

    let cancelled = false;

    if (activeTab === 'appearance') {
      void listInstalledThemePlugins().then((themes) => {
        if (!cancelled) {
          setInstalledThemes(themes);
        }
      });
    }

    if (activeTab === 'interface') {
      void listInstalledSidebarAnimations().then((animations) => {
        if (!cancelled) {
          setInstalledSidebarAnimations(animations);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [activeTab, settings.theme, settings.sidebarMenuAnimation]);

  const handleResetAll = async () => {
    setIsResetting(true);
    const shouldPlayResetSound = settings.uiSoundsEnabled;

    try {
      await resetToDefaults();
      await reloadFavorites();
      await reloadRecentlyViewed();
      await reloadWatched();

      if (shouldPlayResetSound) {
        playDeleteSound();
      }

      showToast('Все данные сброшены', { kind: 'success', title: 'Готово' });
      setResetConfirmOpen(false);
    } catch {
      showToast('Не удалось сбросить данные', { kind: 'error', title: 'Ошибка' });
    } finally {
      setIsResetting(false);
    }
  };

  const handleExportDatabase = async () => {
    if (!window.electronAPI?.backup || isExporting) {
      return;
    }

    setIsExporting(true);
    try {
      const result = await window.electronAPI.backup.export();
      if (!result.ok && result.cancelled) {
        return;
      }
      if (!result.ok) {
        showToast(result.error ?? 'Не удалось экспортировать базу', {
          kind: 'error',
          title: 'Ошибка',
        });
        return;
      }

      showToast('База данных сохранена в файл', { kind: 'success', title: 'Экспорт' });
    } catch {
      showToast('Не удалось экспортировать базу', { kind: 'error', title: 'Ошибка' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportDatabase = async () => {
    if (!window.electronAPI?.backup || isImporting) {
      return;
    }

    setIsImporting(true);
    try {
      const result = await window.electronAPI.backup.import();
      if (!result.ok && result.cancelled) {
        setImportConfirmOpen(false);
        return;
      }
      if (!result.ok) {
        showToast(result.error ?? 'Не удалось импортировать базу', {
          kind: 'error',
          title: 'Ошибка',
        });
        return;
      }

      await reloadSettings();
      await reloadFavorites();
      await reloadRecentlyViewed();
      await reloadWatched();
      showToast('База данных восстановлена из файла', { kind: 'success', title: 'Импорт' });
      setImportConfirmOpen(false);
    } catch {
      showToast('Не удалось импортировать базу', { kind: 'error', title: 'Ошибка' });
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="settings-view page-state-shell">
        <PageLoading title="Загрузка настроек..." centered />
      </div>
    );
  }

  return (
    <div className="settings-view">
      <header className="settings-view__header">
        <h1 className="settings-view__title">Настройки</h1>
        <p className="settings-view__subtitle">Оформление, главная, интерфейс и данные приложения</p>

        <Tabs
          items={[...SETTINGS_TABS]}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as SettingsTabId)}
          ariaLabel="Разделы настроек"
          variant="segmented"
        />
      </header>

      <div ref={scrollRef} className="settings-view__content scroll-overlay">
        {activeTab === 'appearance' ? (
          <div className="settings-panels-grid">
            <section className="settings-group" aria-labelledby="settings-appearance-title">
              <h2 id="settings-appearance-title" className="settings-group__title">
                Тема
              </h2>
              <div className="settings-panel">
                <div className="settings-theme-grid" role="radiogroup" aria-label="Тема оформления">
                  {APP_THEME_OPTIONS.map((option) => {
                    const isActive = settings.theme === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        className={`settings-theme-card${
                          isActive ? ' settings-theme-card--active' : ''
                        }`}
                        onClick={() => {
                          if (!isActive) {
                            void updateSettings({ theme: option.id });
                          }
                        }}
                      >
                        <span className="settings-theme-card__preview" aria-hidden="true">
                          <span
                            className="settings-theme-card__swatch settings-theme-card__swatch--bg"
                            style={{ background: option.preview.bg }}
                          />
                          <span
                            className="settings-theme-card__swatch settings-theme-card__swatch--accent"
                            style={{ background: option.preview.accent }}
                          />
                        </span>
                        <span className="settings-theme-card__body">
                          <span className="settings-theme-card__label">{option.label}</span>
                          <span className="settings-theme-card__description">
                            {option.description}
                          </span>
                        </span>
                        <span className="settings-theme-card__check">
                          <SettingsCheckbox checked={isActive} decorative />
                        </span>
                      </button>
                    );
                  })}

                  {installedThemes.map((theme) => {
                    const isActive = settings.theme === theme.id;

                    return (
                      <button
                        key={theme.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        className={`settings-theme-card${
                          isActive ? ' settings-theme-card--active' : ''
                        }`}
                        onClick={() => {
                          if (!isActive) {
                            void updateSettings({ theme: theme.id });
                          }
                        }}
                      >
                        <span className="settings-theme-card__preview" aria-hidden="true">
                          <span
                            className="settings-theme-card__swatch settings-theme-card__swatch--bg"
                            style={{ background: theme.preview.bg }}
                          />
                          <span
                            className="settings-theme-card__swatch settings-theme-card__swatch--accent"
                            style={{ background: theme.preview.accent }}
                          />
                        </span>
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
                    );
                  })}
                </div>
              </div>
              <p className="settings-group__footer">
                Встроенная тема — Обсидиан. Остальные ставятся в разделе «Плагины».
              </p>
            </section>
          </div>
        ) : null}

        {activeTab === 'home' ? (
          <div className="settings-panels-grid">
            <HomeSettingsPanels />
          </div>
        ) : null}

        {activeTab === 'interface' ? (
          <div className="settings-panels-grid">
            <section className="settings-group" aria-labelledby="settings-sidebar-style-title">
              <h2 id="settings-sidebar-style-title" className="settings-group__title">
                Боковое меню
              </h2>
              <div className="settings-panel">
                <div
                  className="settings-choice-list"
                  role="radiogroup"
                  aria-label="Стиль бокового меню"
                >
                  {SIDEBAR_STYLE_OPTIONS.map((option) => {
                    const isActive = settings.sidebarStyle === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        className={`settings-choice${isActive ? ' settings-choice--active' : ''}`}
                        onClick={() => void updateSettings({ sidebarStyle: option.id })}
                      >
                        <SettingsGlyph tone={option.id === 'apple' ? 'blue' : 'gray'}>
                          {option.id === 'apple' ? (
                            <LayersIcon size={15} strokeWidth={1.9} />
                          ) : (
                            <GridIcon size={15} strokeWidth={1.9} />
                          )}
                        </SettingsGlyph>
                        <span className="settings-choice__body">
                          <span className="settings-choice__label">{option.label}</span>
                          <span className="settings-choice__hint">{option.hint}</span>
                        </span>
                        <SettingsCheckbox checked={isActive} decorative />
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="settings-group__footer">
                Оформление панели Главная / Каталог / … слева.
              </p>
            </section>

            <section className="settings-group" aria-labelledby="settings-poster-size-title">
              <h2 id="settings-poster-size-title" className="settings-group__title">
                Размер постеров
              </h2>
              <div className="settings-panel">
                <div className="settings-choice-list" role="radiogroup" aria-label="Размер постеров">
                  {POSTER_SIZE_OPTIONS.map((option) => {
                    const isActive = settings.posterSize === option.id;
                    const tone =
                      option.id === 'small' ? 'teal' : option.id === 'large' ? 'indigo' : 'blue';

                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        className={`settings-choice${isActive ? ' settings-choice--active' : ''}`}
                        onClick={() => void updateSettings({ posterSize: option.id })}
                      >
                        <SettingsGlyph tone={tone}>
                          <CoverSpacingIcon size={15} strokeWidth={1.9} />
                        </SettingsGlyph>
                        <span className="settings-choice__body">
                          <span className="settings-choice__label">{option.label}</span>
                          <span className="settings-choice__hint">{option.hint}</span>
                        </span>
                        <SettingsCheckbox checked={isActive} decorative />
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="settings-group__footer">
                Главная, каталог, подборки, избранное и статусы просмотра.
              </p>
            </section>

            <section className="settings-group" aria-labelledby="settings-display-title">
              <h2 id="settings-display-title" className="settings-group__title">
                Отображение
              </h2>
              <div className="settings-panel">
                <div className="settings-row">
                  <SettingsGlyph tone="blue">
                    <FilmIcon size={15} strokeWidth={1.9} />
                  </SettingsGlyph>
                  <div className="settings-row__body">
                    <p className="settings-row__label">Показывать подписи</p>
                    <p className="settings-row__hint">Название, год и рейтинг под обложкой</p>
                  </div>
                  <SettingsSwitch
                    checked={settings.cardShowInfo}
                    onChange={(checked) => void updateSettings({ cardShowInfo: checked })}
                    aria-label="Показывать подписи"
                  />
                </div>

                <div className="settings-row">
                  <SettingsGlyph tone="orange">
                    <InfoIcon size={15} strokeWidth={1.9} />
                  </SettingsGlyph>
                  <div className="settings-row__body">
                    <p className="settings-row__label">Показывать подсказки</p>
                    <p className="settings-row__hint">
                      Горячие клавиши, скрытие секций и другие возможности
                    </p>
                  </div>
                  <SettingsSwitch
                    checked={settings.autoTipsEnabled}
                    onChange={(checked) => void updateSettings({ autoTipsEnabled: checked })}
                    aria-label="Показывать подсказки автоматически"
                  />
                </div>
              </div>
            </section>

            <section className="settings-group" aria-labelledby="settings-sidebar-menu-title">
              <h2 id="settings-sidebar-menu-title" className="settings-group__title">
                Анимация меню
              </h2>
              <div className="settings-panel">
                <div
                  className="settings-choice-list"
                  role="radiogroup"
                  aria-label="Анимация бокового меню"
                >
                  {[
                    ...SIDEBAR_MENU_ANIMATION_OPTIONS,
                    ...installedSidebarAnimations.map((item) => ({
                      id: item.id,
                      label: item.name,
                      hint: item.description,
                    })),
                  ].map((option) => {
                    const isActive = settings.sidebarMenuAnimation === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        className={`settings-choice${isActive ? ' settings-choice--active' : ''}`}
                        onClick={() => void updateSettings({ sidebarMenuAnimation: option.id })}
                      >
                        <span className="settings-choice__body">
                          <span className="settings-choice__label">{option.label}</span>
                          <span className="settings-choice__hint">{option.hint}</span>
                        </span>
                        <SettingsCheckbox checked={isActive} decorative />
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="settings-group__footer">
                Встроенные варианты — Выделение и Водяной магнит. Остальные ставятся в «Плагины».
              </p>
            </section>
          </div>
        ) : null}

        {activeTab === 'network' ? (
          <div className="settings-panels-grid">
            <section className="settings-group" aria-labelledby="settings-api-server-title">
              <h2 id="settings-api-server-title" className="settings-group__title">
                API-сервер
              </h2>
              <div className="settings-panel">
                <div className="settings-choice-list" role="radiogroup" aria-label="API-сервер">
                  {API_SERVER_OPTIONS.map((option) => {
                    const status = health[option.id];
                    const isActive = settings.apiServer === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        className={`settings-choice${isActive ? ' settings-choice--active' : ''}`}
                        onClick={() => {
                          if (isActive) {
                            return;
                          }

                          void updateSettings({ apiServer: option.id }).then(() => {
                            showToast(`Выбран ${option.label}`, {
                              kind: 'success',
                              title: 'Сеть',
                            });
                          });
                        }}
                      >
                        <span className="settings-choice__body">
                          <span className="settings-choice__label">{option.label}</span>
                          <span
                            className={`settings-choice__hint${
                              status === 'ok'
                                ? ' settings-choice__hint--ok'
                                : status === 'fail'
                                  ? ' settings-choice__hint--fail'
                                  : ''
                            }`}
                          >
                            {apiServerHealthHint(status, option.hint)}
                          </span>
                        </span>
                        <SettingsCheckbox checked={isActive} decorative />
                      </button>
                    );
                  })}
                </div>

                <div className="settings-data-actions">
                  <button
                    type="button"
                    className="settings-action-btn"
                    disabled={isChecking}
                    onClick={() => void checkApiServers()}
                  >
                    {isChecking ? 'Проверка…' : 'Проверить доступность'}
                  </button>
                </div>
              </div>
              <p className="settings-group__footer">
                Источник каталога и метаданных. После смены сервера данные подгрузятся заново.
              </p>
            </section>
          </div>
        ) : null}

        {activeTab === 'sounds' ? (
          <div className="settings-panels-grid">
            <section className="settings-group" aria-labelledby="settings-sounds-title">
              <h2 id="settings-sounds-title" className="settings-group__title">
                Звуки
              </h2>
              <div className="settings-panel">
                <div className="settings-row">
                  <SettingsGlyph tone="pink">
                    <WatchingIcon size={15} strokeWidth={1.9} />
                  </SettingsGlyph>
                  <div className="settings-row__body">
                    <p className="settings-row__label">Звуки интерфейса</p>
                    <p className="settings-row__hint">
                      Навигация, приветствие, подсказки, избранное и статусы просмотра
                    </p>
                  </div>
                  <SettingsSwitch
                    checked={settings.uiSoundsEnabled}
                    onChange={(checked) => void updateSettings({ uiSoundsEnabled: checked })}
                    aria-label="Включить звуки"
                  />
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'data' ? (
          <div className="settings-panels-grid">
            {canBackup ? (
              <section className="settings-group" aria-labelledby="settings-backup-title">
                <h2 id="settings-backup-title" className="settings-group__title">
                  Резервная копия
                </h2>
                <div className="settings-panel">
                <div className="settings-data-actions">
                  <button
                    type="button"
                    className="settings-action-btn"
                    disabled={isExporting || isImporting}
                    onClick={() => void handleExportDatabase()}
                  >
                    <SettingsGlyph tone="teal">
                      <LayersIcon size={15} strokeWidth={1.9} />
                    </SettingsGlyph>
                    {isExporting ? 'Экспорт…' : 'Экспорт базы'}
                  </button>
                  <button
                    type="button"
                    className="settings-action-btn"
                    disabled={isExporting || isImporting}
                    onClick={() => setImportConfirmOpen(true)}
                  >
                    <SettingsGlyph tone="blue">
                      <PuzzleIcon size={15} strokeWidth={1.9} />
                    </SettingsGlyph>
                    Импорт базы
                  </button>
                </div>
                </div>
                <p className="settings-group__footer">
                  Настройки, избранное, статусы просмотра и история в одном файле.
                </p>
              </section>
            ) : null}

            <section className="settings-group" aria-labelledby="settings-data-title">
              <h2 id="settings-data-title" className="settings-group__title">
                Сброс
              </h2>
              <div className="settings-panel settings-panel--danger">
                <button
                  type="button"
                  className="settings-reset-btn"
                  onClick={() => setResetConfirmOpen(true)}
                >
                  <SettingsGlyph tone="red">
                    <TrashIcon size={15} strokeWidth={1.9} />
                  </SettingsGlyph>
                  Сбросить все данные
                </button>
              </div>
              <p className="settings-group__footer">
                Настройки, избранное, статусы просмотра, история и скрытые секции вернутся к состоянию
                по умолчанию.
              </p>
            </section>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={importConfirmOpen}
        title="Импортировать базу?"
        description="Текущие настройки, избранное, статусы просмотра и история будут заменены данными из выбранного файла. Это действие нельзя отменить."
        confirmLabel="Импортировать"
        cancelLabel="Отмена"
        confirmVariant="neutral"
        isConfirming={isImporting}
        onCancel={() => {
          if (!isImporting) {
            setImportConfirmOpen(false);
          }
        }}
        onConfirm={() => void handleImportDatabase()}
      />

      <ConfirmDialog
        open={resetConfirmOpen}
        title="Сбросить все данные?"
        description="Настройки, избранное, статусы просмотра, история просмотров и скрытые секции будут удалены. База данных вернётся к чистому состоянию по умолчанию. Это действие нельзя отменить."
        confirmLabel="Сбросить"
        cancelLabel="Отмена"
        confirmVariant="danger"
        isConfirming={isResetting}
        onCancel={() => {
          if (!isResetting) {
            setResetConfirmOpen(false);
          }
        }}
        onConfirm={() => void handleResetAll()}
      />
    </div>
  );
}
