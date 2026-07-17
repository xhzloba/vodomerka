import { useState } from 'react';
import { HomeSettingsPanels } from '@/features/home/ui/HomeSettingsPanels';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import { useFavorites } from '@/shared/domain/FavoritesContext';
import { useRecentlyViewed } from '@/shared/domain/RecentlyViewedContext';
import { useWatched } from '@/shared/domain/WatchedContext';
import { useToast } from '@/shared/ui/Toast/ToastContext';
import { playDeleteSound } from '@/shared/audio/uiSounds';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { TrashIcon } from '@/shared/ui/icons';
import { APP_THEME_OPTIONS } from '@/shared/settings/themes';
import { POSTER_SIZE_OPTIONS, SIDEBAR_MENU_ANIMATION_OPTIONS } from '@/shared/settings/types';
import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import { PageLoading } from '@/shared/ui/PageState';
import { Tabs } from '@/shared/ui/Tabs';
import './SettingsView.css';

const SETTINGS_TABS = [
  { id: 'appearance', label: 'Оформление' },
  { id: 'home', label: 'Главная' },
  { id: 'interface', label: 'Интерфейс' },
  { id: 'sounds', label: 'Звуки' },
  { id: 'data', label: 'Данные' },
] as const;

type SettingsTabId = (typeof SETTINGS_TABS)[number]['id'];

export function SettingsView() {
  const scrollRef = useOverlayScroll<HTMLDivElement>();
  const { settings, isLoading, updateSettings, resetToDefaults, reloadSettings } = useAppSettings();
  const { reloadFavorites } = useFavorites();
  const { reloadRecentlyViewed } = useRecentlyViewed();
  const { reloadWatched } = useWatched();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTabId>('appearance');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const canBackup = Boolean(window.electronAPI?.backup);

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

        <Tabs
          items={[...SETTINGS_TABS]}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as SettingsTabId)}
          ariaLabel="Разделы настроек"
          variant="settings"
        />
      </header>

      <div ref={scrollRef} className="settings-view__content scroll-overlay">
        {activeTab === 'appearance' ? (
          <div className="settings-panels-grid">
            <section
              className="settings-panel settings-panel--full"
              aria-labelledby="settings-appearance-title"
            >
            <div className="settings-panel__intro">
              <h2 id="settings-appearance-title" className="settings-panel__title">
                Тема оформления
              </h2>
              <p className="settings-panel__description">
                Цвета интерфейса, акценты и фон приложения. Выбор сохраняется в базе данных.
              </p>
            </div>

            <div className="settings-theme-grid" role="radiogroup" aria-label="Тема оформления">
              {APP_THEME_OPTIONS.map((option) => {
                const isActive = settings.theme === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={`settings-theme-card settings-theme-card--${option.id}${
                      isActive ? ' settings-theme-card--active' : ''
                    }`}
                    onClick={() => {
                      if (!isActive) {
                        void updateSettings({ theme: option.id });
                      }
                    }}
                  >
                    <span className="settings-theme-card__preview" aria-hidden="true">
                      <span className="settings-theme-card__swatch settings-theme-card__swatch--bg" />
                      <span className="settings-theme-card__swatch settings-theme-card__swatch--accent" />
                    </span>
                    <span className="settings-theme-card__body">
                      <span className="settings-theme-card__label">{option.label}</span>
                      <span className="settings-theme-card__description">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
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
            <section className="settings-panel" aria-labelledby="settings-sidebar-menu-title">
              <div className="settings-panel__intro">
                <h2 id="settings-sidebar-menu-title" className="settings-panel__title">
                  Боковое меню
                </h2>
                <p className="settings-panel__description">
                  Анимация подсветки активного пункта навигации слева.
                </p>
              </div>

              <div className="settings-mode-picker" role="radiogroup" aria-label="Анимация бокового меню">
                {SIDEBAR_MENU_ANIMATION_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={settings.sidebarMenuAnimation === option.id}
                    className={`settings-mode-picker__option${
                      settings.sidebarMenuAnimation === option.id
                        ? ' settings-mode-picker__option--active'
                        : ''
                    }`}
                    onClick={() => void updateSettings({ sidebarMenuAnimation: option.id })}
                  >
                    <span className="settings-mode-picker__label">{option.label}</span>
                    <span className="settings-mode-picker__hint">{option.hint}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-panel" aria-labelledby="settings-poster-size-title">
              <div className="settings-panel__intro">
                <h2 id="settings-poster-size-title" className="settings-panel__title">
                  Размер постеров
                </h2>
                <p className="settings-panel__description">
                  Главная, каталог, подборки, избранное и просмотренное.
                </p>
              </div>

              <div className="settings-mode-picker" role="radiogroup" aria-label="Размер постеров">
                {POSTER_SIZE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={settings.posterSize === option.id}
                    className={`settings-mode-picker__option${
                      settings.posterSize === option.id ? ' settings-mode-picker__option--active' : ''
                    }`}
                    onClick={() => void updateSettings({ posterSize: option.id })}
                  >
                    <span className="settings-mode-picker__label">{option.label}</span>
                    <span className="settings-mode-picker__hint">{option.hint}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-panel" aria-labelledby="settings-tips-title">
              <div className="settings-panel__intro">
                <h2 id="settings-tips-title" className="settings-panel__title">
                  Подсказки
                </h2>
                <p className="settings-panel__description">
                  Короткие советы по интерфейсу в виде уведомлений с разной периодичностью.
                </p>
              </div>

              <div className="settings-row settings-row--solo">
                <div className="settings-row__body">
                  <p className="settings-row__label">Показывать подсказки автоматически</p>
                  <p className="settings-row__hint">
                    Горячие клавиши, скрытие секций и другие возможности приложения
                  </p>
                </div>

                <button
                  type="button"
                  className={`settings-toggle ${settings.autoTipsEnabled ? 'settings-toggle--on' : ''}`}
                  role="switch"
                  aria-checked={settings.autoTipsEnabled}
                  onClick={() => void updateSettings({ autoTipsEnabled: !settings.autoTipsEnabled })}
                >
                  <span className="settings-toggle__thumb" />
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'sounds' ? (
          <div className="settings-panels-grid">
            <section className="settings-panel" aria-labelledby="settings-sounds-title">
              <div className="settings-panel__intro">
                <h2 id="settings-sounds-title" className="settings-panel__title">
                  Звуки интерфейса
                </h2>
                <p className="settings-panel__description">
                  Звуковые эффекты при действиях в приложении: очистка данных, подтверждения и другие
                  UI-события.
                </p>
              </div>

              <div className="settings-row settings-row--solo">
                <div className="settings-row__body">
                  <p className="settings-row__label">Включить звуки</p>
                  <p className="settings-row__hint">
                    Сейчас: навигация, приветствие, подсказки, избранное и просмотренное, очистка данных
                  </p>
                </div>

                <button
                  type="button"
                  className={`settings-toggle ${settings.uiSoundsEnabled ? 'settings-toggle--on' : ''}`}
                  role="switch"
                  aria-checked={settings.uiSoundsEnabled}
                  onClick={() => void updateSettings({ uiSoundsEnabled: !settings.uiSoundsEnabled })}
                >
                  <span className="settings-toggle__thumb" />
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'data' ? (
          <div className="settings-panels-grid">
            {canBackup ? (
              <section className="settings-panel" aria-labelledby="settings-backup-title">
                <div className="settings-panel__intro">
                  <h2 id="settings-backup-title" className="settings-panel__title">
                    Резервная копия
                  </h2>
                  <p className="settings-panel__description">
                    Экспорт и импорт файла базы данных: настройки, избранное, просмотренное и история.
                  </p>
                </div>

                <div className="settings-data-actions">
                  <button
                    type="button"
                    className="settings-action-btn"
                    disabled={isExporting || isImporting}
                    onClick={() => void handleExportDatabase()}
                  >
                    {isExporting ? 'Экспорт…' : 'Экспорт базы'}
                  </button>
                  <button
                    type="button"
                    className="settings-action-btn"
                    disabled={isExporting || isImporting}
                    onClick={() => setImportConfirmOpen(true)}
                  >
                    Импорт базы
                  </button>
                </div>
              </section>
            ) : null}

            <section
              className="settings-panel settings-panel--danger"
              aria-labelledby="settings-data-title"
            >
              <div className="settings-panel__intro">
                <h2 id="settings-data-title" className="settings-panel__title">
                  Данные приложения
                </h2>
                <p className="settings-panel__description">
                  Полный сброс: настройки, избранное, просмотренное, история просмотров и скрытые секции
                  вернутся к состоянию по умолчанию. База данных будет очищена.
                </p>
              </div>

              <button
                type="button"
                className="settings-reset-btn"
                onClick={() => setResetConfirmOpen(true)}
              >
                <TrashIcon size={16} strokeWidth={1.75} />
                Сбросить все данные
              </button>
            </section>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={importConfirmOpen}
        title="Импортировать базу?"
        description="Текущие настройки, избранное, просмотренное и история будут заменены данными из выбранного файла. Это действие нельзя отменить."
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
        description="Настройки, избранное, просмотренное, история просмотров и скрытые секции будут удалены. База данных вернётся к чистому состоянию по умолчанию. Это действие нельзя отменить."
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
