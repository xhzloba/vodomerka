import { useHomePage } from '@/features/home/model/useHomePage';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import {
  getEffectiveHiddenHomeSections,
  restoreHomeSection,
  HOME_RECENTLY_VIEWED_SECTION_TITLE,
} from '@/shared/domain/homeSections';
import {
  clampHeroSlideIntervalSec,
  HERO_SLIDE_INTERVAL_MAX_SEC,
  HERO_SLIDE_INTERVAL_MIN_SEC,
  HOME_FAVORITES_SECTION_MODE_OPTIONS,
  HOME_RECENTLY_VIEWED_SECTION_MODE_OPTIONS,
} from '@/shared/settings/types';
import { useToast } from '@/shared/ui/Toast/ToastContext';
import '@/components/SettingsView/SettingsView.css';
import './HomeSettingsPanels.css';

interface HomeSettingsPanelsProps {
  variant?: 'settings' | 'menu';
}

export function HomeSettingsPanels({ variant = 'settings' }: HomeSettingsPanelsProps) {
  const { settings, updateSettings } = useAppSettings();
  const { showToast } = useToast();
  const { data: homeData } = useHomePage();

  const hiddenSections = getEffectiveHiddenHomeSections(
    settings.hiddenHomeSections,
    settings.homeSectionRestoreOrder,
    homeData?.rows ?? [],
  );

  return (
    <div className={`home-settings-panels home-settings-panels--${variant}`}>
      <section className="settings-panel" aria-labelledby="home-settings-hero-title">
        <div className="settings-panel__intro">
          <h2 id="home-settings-hero-title" className="settings-panel__title">
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

      <section className="settings-panel" aria-labelledby="home-settings-slider-title">
        <div className="settings-panel__intro">
          <h2 id="home-settings-slider-title" className="settings-panel__title">
            Слайдер рекомендаций
          </h2>
          <p className="settings-panel__description">
            Автопереключение фильмов в hero-блоке. Работает только когда блок рекомендаций включён.
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

      <section className="settings-panel settings-panel--full" aria-labelledby="home-settings-sections-title">
        <div className="settings-panel__intro">
          <h2 id="home-settings-sections-title" className="settings-panel__title">
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
          <p className="settings-subgroup__hint">Ряд с фильмами, которые вы открывали в деталке</p>
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

      <section className="settings-panel settings-panel--full" aria-labelledby="home-settings-hidden-title">
        <div className="settings-panel__intro">
          <h2 id="home-settings-hidden-title" className="settings-panel__title">
            Скрытые секции
          </h2>
          <p className="settings-panel__description">
            Секции, которые вы скрыли с главной. Их можно вернуть в любой момент.
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

      <section className="settings-panel" aria-labelledby="home-settings-cards-title">
        <div className="settings-panel__intro">
          <h2 id="home-settings-cards-title" className="settings-panel__title">
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
  );
}
