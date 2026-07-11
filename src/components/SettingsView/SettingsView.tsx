import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useHomePage } from '@/features/home/model/useHomePage';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import { useFavorites } from '@/shared/domain/FavoritesContext';
import { useRecentlyViewed } from '@/shared/domain/RecentlyViewedContext';
import { useWatched } from '@/shared/domain/WatchedContext';
import { getEffectiveHiddenHomeSections, restoreHomeSection, HOME_RECENTLY_VIEWED_SECTION_TITLE } from '@/shared/domain/homeSections';
import { useToast } from '@/shared/ui/Toast/ToastContext';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { TrashIcon } from '@/shared/ui/icons';
import { APP_THEME_OPTIONS } from '@/shared/settings/themes';
import {
  clampHeroSlideIntervalSec,
  HERO_SLIDE_INTERVAL_MAX_SEC,
  HERO_SLIDE_INTERVAL_MIN_SEC,
  HOME_FAVORITES_SECTION_MODE_OPTIONS,
  HOME_RECENTLY_VIEWED_SECTION_MODE_OPTIONS,
  SIDEBAR_MENU_ANIMATION_OPTIONS,
} from '@/shared/settings/types';
import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import { PageLoading } from '@/shared/ui/PageState';
import './SettingsView.css';

const SETTINGS_TABS = [
  { id: 'appearance', label: 'Оформление' },
  { id: 'home', label: 'Главная' },
  { id: 'interface', label: 'Интерфейс' },
  { id: 'data', label: 'Данные' },
] as const;

type SettingsTabId = (typeof SETTINGS_TABS)[number]['id'];

export function SettingsView() {
  const scrollRef = useOverlayScroll<HTMLDivElement>();
  const { settings, isLoading, updateSettings, resetToDefaults } = useAppSettings();
  const { reloadFavorites } = useFavorites();
  const { reloadRecentlyViewed } = useRecentlyViewed();
  const { reloadWatched } = useWatched();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTabId>('appearance');
  const [hoveredTab, setHoveredTab] = useState<SettingsTabId | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [tabSnakeIndicator, setTabSnakeIndicator] = useState<{
    x: number;
    width: number;
    ready: boolean;
  }>({
    x: 0,
    width: 0,
    ready: false,
  });

  const syncTabSnakeIndicator = useCallback(() => {
    const tabs = tabsRef.current;
    const targetTab = hoveredTab ?? activeTab;
    const button = tabs?.querySelector<HTMLElement>(`[data-settings-tab="${targetTab}"]`);

    if (!tabs || !button) {
      setTabSnakeIndicator((state) => (state.ready ? { ...state, ready: false } : state));
      return;
    }

    const tabsRect = tabs.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();

    setTabSnakeIndicator({
      x: buttonRect.left - tabsRect.left,
      width: buttonRect.width,
      ready: true,
    });
  }, [activeTab, hoveredTab]);

  useLayoutEffect(() => {
    syncTabSnakeIndicator();
  }, [activeTab, hoveredTab, syncTabSnakeIndicator]);

  useEffect(() => {
    const tabs = tabsRef.current;
    if (!tabs) {
      return;
    }

    const resizeObserver = new ResizeObserver(syncTabSnakeIndicator);
    resizeObserver.observe(tabs);
    window.addEventListener('resize', syncTabSnakeIndicator);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', syncTabSnakeIndicator);
    };
  }, [syncTabSnakeIndicator]);

  const tabSnakeIndicatorStyle = tabSnakeIndicator.ready
    ? ({
        transform: `translateX(${tabSnakeIndicator.x}px)`,
        width: `${tabSnakeIndicator.width}px`,
      } as CSSProperties)
    : undefined;

  const { data: homeData } = useHomePage();
  const hiddenSections = getEffectiveHiddenHomeSections(
    settings.hiddenHomeSections,
    settings.homeSectionRestoreOrder,
    homeData?.rows ?? [],
  );

  const handleResetAll = async () => {
    setIsResetting(true);

    try {
      await resetToDefaults();
      await reloadFavorites();
      await reloadRecentlyViewed();
      await reloadWatched();
      setResetConfirmOpen(false);
      showToast('Все данные сброшены до значений по умолчанию', {
        kind: 'success',
        title: 'Готово',
      });
    } finally {
      setIsResetting(false);
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

        <div
          ref={tabsRef}
          className="settings-view__tabs"
          role="tablist"
          aria-label="Разделы настроек"
          onMouseLeave={() => setHoveredTab(null)}
        >
          {tabSnakeIndicator.ready ? (
            <span
              className="settings-view__tab-indicator"
              aria-hidden="true"
              style={tabSnakeIndicatorStyle}
            />
          ) : null}

          {SETTINGS_TABS.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                data-settings-tab={tab.id}
                aria-selected={isActive}
                className={`settings-view__tab${isActive ? ' settings-view__tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                onMouseEnter={() => setHoveredTab(tab.id)}
                onFocus={() => setHoveredTab(tab.id)}
                onBlur={(event) => {
                  if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
                    setHoveredTab(null);
                  }
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
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
            <section className="settings-panel" aria-labelledby="settings-hero-title">
              <div className="settings-panel__intro">
                <h2 id="settings-hero-title" className="settings-panel__title">
                  Блок рекомендаций
                </h2>
                <p className="settings-panel__description">
                  Большой hero-баннер на главной: backdrop фильма, метаданные и кнопки «Смотреть» /
                  «Подробнее».
                </p>
              </div>

              <div className="settings-row settings-row--solo">
                <div className="settings-row__body">
                  <p className="settings-row__label">Показывать на главной</p>
                  <p className="settings-row__hint">Скрывает или возвращает hero-блок целиком</p>
                </div>

                <button
                  type="button"
                  className={`settings-toggle ${settings.heroEnabled ? 'settings-toggle--on' : ''}`}
                  role="switch"
                  aria-checked={settings.heroEnabled}
                  onClick={() => void updateSettings({ heroEnabled: !settings.heroEnabled })}
                >
                  <span className="settings-toggle__thumb" />
                </button>
              </div>
            </section>

            <section className="settings-panel" aria-labelledby="settings-slider-title">
              <div className="settings-panel__intro">
                <h2 id="settings-slider-title" className="settings-panel__title">
                  Слайдер рекомендаций
                </h2>
                <p className="settings-panel__description">
                  Автопереключение фильмов в hero-блоке. Работает только когда блок рекомендаций
                  включён.
                </p>
              </div>

              <div className="settings-row">
                <div className="settings-row__body">
                  <p className="settings-row__label">Автоматический слайдер</p>
                  <p className="settings-row__hint">Переключение рекомендаций на главной странице</p>
                </div>

                <button
                  type="button"
                  className={`settings-toggle ${settings.heroAutoSlide ? 'settings-toggle--on' : ''}`}
                  role="switch"
                  aria-checked={settings.heroAutoSlide}
                  disabled={!settings.heroEnabled}
                  onClick={() => void updateSettings({ heroAutoSlide: !settings.heroAutoSlide })}
                >
                  <span className="settings-toggle__thumb" />
                </button>
              </div>

              <div className="settings-row">
                <div className="settings-row__body">
                  <p className="settings-row__label">Интервал перелистывания</p>
                  <p className="settings-row__hint">
                    От {HERO_SLIDE_INTERVAL_MIN_SEC} до {HERO_SLIDE_INTERVAL_MAX_SEC} секунд
                  </p>
                </div>

                <div className="settings-interval">
                  <input
                    className="settings-interval__input"
                    type="number"
                    min={HERO_SLIDE_INTERVAL_MIN_SEC}
                    max={HERO_SLIDE_INTERVAL_MAX_SEC}
                    step={1}
                    value={settings.heroSlideIntervalSec}
                    disabled={!settings.heroEnabled || !settings.heroAutoSlide}
                    onChange={(event) => {
                      const value = clampHeroSlideIntervalSec(Number(event.target.value));
                      void updateSettings({ heroSlideIntervalSec: value });
                    }}
                  />
                  <span className="settings-interval__suffix">сек</span>
                </div>
              </div>
            </section>

            <section
              className="settings-panel settings-panel--full"
              aria-labelledby="settings-sections-title"
            >
              <div className="settings-panel__intro">
                <h2 id="settings-sections-title" className="settings-panel__title">
                  Секции главной
                </h2>
                <p className="settings-panel__description">
                  «Избранное» и «{HOME_RECENTLY_VIEWED_SECTION_TITLE}» выводятся перед «В тренде» по тем же
                  правилам показа.
                </p>
              </div>

              <div className="settings-subgroup">
                <p className="settings-subgroup__label">Избранное</p>
                <p className="settings-subgroup__hint">Показ ряда с сохранёнными фильмами на главной</p>
                <div className="settings-mode-picker" role="radiogroup" aria-label="Режим секции «Избранное»">
                  {HOME_FAVORITES_SECTION_MODE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={settings.homeFavoritesSection === option.id}
                      className={`settings-mode-picker__option${
                        settings.homeFavoritesSection === option.id
                          ? ' settings-mode-picker__option--active'
                          : ''
                      }`}
                      onClick={() => void updateSettings({ homeFavoritesSection: option.id })}
                    >
                      <span className="settings-mode-picker__label">{option.label}</span>
                      <span className="settings-mode-picker__hint">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-subgroup">
                <p className="settings-subgroup__label">{HOME_RECENTLY_VIEWED_SECTION_TITLE}</p>
                <p className="settings-subgroup__hint">
                  Ряд с фильмами, которые вы открывали в деталке
                </p>
                <div
                  className="settings-mode-picker"
                  role="radiogroup"
                  aria-label={`Режим секции «${HOME_RECENTLY_VIEWED_SECTION_TITLE}»`}
                >
                  {HOME_RECENTLY_VIEWED_SECTION_MODE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={settings.homeRecentlyViewedSection === option.id}
                      className={`settings-mode-picker__option${
                        settings.homeRecentlyViewedSection === option.id
                          ? ' settings-mode-picker__option--active'
                          : ''
                      }`}
                      onClick={() => void updateSettings({ homeRecentlyViewedSection: option.id })}
                    >
                      <span className="settings-mode-picker__label">{option.label}</span>
                      <span className="settings-mode-picker__hint">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section
              className="settings-panel settings-panel--full"
              aria-labelledby="settings-hidden-title"
            >
              <div className="settings-panel__intro">
                <h2 id="settings-hidden-title" className="settings-panel__title">
                  Скрытые секции
                </h2>
                <p className="settings-panel__description">
                  «Фильмы», «Сериалы», «Мультфильмы», «Обновление сериалов» и «Обновление фильмов» скрыты по
                  умолчанию. «Избранное» и «{HOME_RECENTLY_VIEWED_SECTION_TITLE}» при восстановлении снова встают
                  перед «В тренде».
                </p>
              </div>

              {hiddenSections.length === 0 ? (
                <p className="settings-hidden-empty">Скрытых секций нет</p>
              ) : (
                <ul className="settings-hidden-list">
                  {hiddenSections.map((section) => (
                    <li key={section.id} className="settings-hidden-item">
                      <span className="settings-hidden-item__title">{section.title}</span>
                      <button
                        type="button"
                        className="settings-hidden-item__restore"
                        onClick={() => {
                          const next = restoreHomeSection(
                            settings.hiddenHomeSections,
                            settings.homeSectionRestoreOrder,
                            section.id,
                          );
                          showToast(`Секция «${section.title}» восстановлена`, {
                            kind: 'restore',
                            title: 'Восстановлено',
                          });
                          void updateSettings(next);
                        }}
                      >
                        Восстановить
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
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

            <section className="settings-panel" aria-labelledby="settings-cards-title">
            <div className="settings-panel__intro">
              <h2 id="settings-cards-title" className="settings-panel__title">
                Подписи к карточкам
              </h2>
              <p className="settings-panel__description">
                Название, год и рейтинг под обложками в рядах на главной, в каталоге и в поиске.
              </p>
            </div>

            <div className="settings-row settings-row--solo">
              <div className="settings-row__body">
                <p className="settings-row__label">Показывать подписи</p>
                <p className="settings-row__hint">Название, год и рейтинг под обложкой</p>
              </div>

              <button
                type="button"
                className={`settings-toggle ${settings.cardShowInfo ? 'settings-toggle--on' : ''}`}
                role="switch"
                aria-checked={settings.cardShowInfo}
                onClick={() => void updateSettings({ cardShowInfo: !settings.cardShowInfo })}
              >
                <span className="settings-toggle__thumb" />
              </button>
            </div>
          </section>
          </div>
        ) : null}

        {activeTab === 'data' ? (
          <div className="settings-panels-grid">
            <section
              className="settings-panel settings-panel--danger"
              aria-labelledby="settings-data-title"
            >
            <div className="settings-panel__intro">
              <h2 id="settings-data-title" className="settings-panel__title">
                Данные приложения
              </h2>
              <p className="settings-panel__description">
                Полный сброс: настройки, избранное, просмотренное, история просмотров и скрытые секции вернутся
                к состоянию по умолчанию. База данных будет очищена.
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
