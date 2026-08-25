import { useEffect, useMemo } from 'react';
import { useHomePage } from '@/features/home/model/useHomePage';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import {
  getEffectiveHiddenHomeSections,
  getHeroSliderSourceRows,
  resolveHeroSourceSectionIds,
  restoreHomeSection,
  HOME_CONTINUE_SECTION_TITLE,
  HOME_RECENTLY_VIEWED_SECTION_TITLE,
} from '@/shared/domain/homeSections';
import {
  clampHeroSlideIntervalSec,
  HERO_SLIDE_INTERVAL_MAX_SEC,
  HERO_SLIDE_INTERVAL_MIN_SEC,
  HOME_CONTINUE_WATCHING_SECTION_MODE_OPTIONS,
  HOME_FAVORITES_SECTION_MODE_OPTIONS,
  HOME_RECENTLY_VIEWED_SECTION_MODE_OPTIONS,
} from '@/shared/settings/types';
import { SettingsCheckbox } from '@/shared/ui/SettingsControls/SettingsCheckbox';
import { SettingsGlyph } from '@/shared/ui/SettingsControls/SettingsGlyph';
import { SettingsSwitch } from '@/shared/ui/SettingsControls/SettingsSwitch';
import { FavoritesIcon, HistoryIcon, HomeIcon, PlayIcon, TrendingIcon } from '@/shared/ui/icons';
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

  const homeRows = homeData?.rows ?? [];
  const heroSourceOptions = useMemo(() => getHeroSliderSourceRows(homeRows), [homeRows]);

  useEffect(() => {
    const rows = homeData?.rows;
    if (!rows?.length) {
      return;
    }

    const resolved = resolveHeroSourceSectionIds(rows, settings.heroSourceSectionIds);
    if (resolved.length === 0) {
      return;
    }

    const current = settings.heroSourceSectionIds;
    const alreadySingle = current.length === 1 && current[0] === resolved[0];

    if (alreadySingle) {
      return;
    }

    void updateSettings({ heroSourceSectionIds: resolved });
  }, [homeData?.rows, settings.heroSourceSectionIds, updateSettings]);

  const selectedHeroSourceId = useMemo(
    () => resolveHeroSourceSectionIds(homeRows, settings.heroSourceSectionIds)[0] ?? null,
    [homeRows, settings.heroSourceSectionIds],
  );

  const hiddenSections = getEffectiveHiddenHomeSections(
    settings.hiddenHomeSections,
    settings.homeSectionRestoreOrder,
    homeRows,
  );

  return (
    <div className={`home-settings-panels home-settings-panels--${variant}`}>
      <section className="settings-group" aria-labelledby="home-settings-hero-title">
        <h2 id="home-settings-hero-title" className="settings-group__title">
          Блок рекомендаций
        </h2>
        <div className="settings-panel">
          <div className="settings-row">
            <SettingsGlyph tone="indigo">
              <HomeIcon size={15} strokeWidth={1.9} />
            </SettingsGlyph>
            <div className="settings-row__body">
              <p className="settings-row__label">Показывать на главной</p>
            </div>
            <SettingsSwitch
              checked={settings.heroEnabled}
              onChange={(checked) => void updateSettings({ heroEnabled: checked })}
              aria-label="Показывать блок рекомендаций"
            />
          </div>
          <div className="settings-row">
            <SettingsGlyph tone="indigo">
              <TrendingIcon size={15} strokeWidth={1.9} />
            </SettingsGlyph>
            <div className="settings-row__body">
              <p className="settings-row__label">Фон от цвета backdrop</p>
              <p className="settings-row__hint">Только на главной; вне её — выбранная тема</p>
            </div>
            <SettingsSwitch
              checked={settings.homeBackdropTint}
              onChange={(checked) => void updateSettings({ homeBackdropTint: checked })}
              disabled={!settings.heroEnabled}
              aria-label="Подстраивать фон под backdrop на главной"
            />
          </div>
        </div>
        <p className="settings-group__footer">
          Большой hero-баннер: backdrop, метаданные и кнопки «Смотреть» / «Подробнее».
        </p>
      </section>

      <section className="settings-group" aria-labelledby="home-settings-continue-title">
        <h2 id="home-settings-continue-title" className="settings-group__title">
          {HOME_CONTINUE_SECTION_TITLE}
        </h2>
        <div className="settings-panel">
          <div
            className="settings-choice-list"
            role="radiogroup"
            aria-label={`Режим секции «${HOME_CONTINUE_SECTION_TITLE}»`}
          >
            {HOME_CONTINUE_WATCHING_SECTION_MODE_OPTIONS.map((option) => {
              const isActive = settings.homeContinueWatchingSection === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className={`settings-choice${isActive ? ' settings-choice--active' : ''}`}
                  onClick={() => void updateSettings({ homeContinueWatchingSection: option.id })}
                >
                  <SettingsGlyph tone="pink">
                    <PlayIcon size={15} />
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
          Незавершённые просмотры из Vodomerka Player — клик продолжит с позиции.
        </p>
      </section>

      <section className="settings-group" aria-labelledby="home-settings-favorites-title">
        <h2 id="home-settings-favorites-title" className="settings-group__title">
          Избранное
        </h2>
        <div className="settings-panel">
          <div
            className="settings-choice-list"
            role="radiogroup"
            aria-label="Режим секции «Избранное»"
          >
            {HOME_FAVORITES_SECTION_MODE_OPTIONS.map((option) => {
              const isActive = settings.homeFavoritesSection === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className={`settings-choice${isActive ? ' settings-choice--active' : ''}`}
                  onClick={() => void updateSettings({ homeFavoritesSection: option.id })}
                >
                  <SettingsGlyph tone="pink">
                    <FavoritesIcon size={15} strokeWidth={1.9} />
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
        <p className="settings-group__footer">Ряд с сохранёнными фильмами на главной.</p>
      </section>

      <section className="settings-group" aria-labelledby="home-settings-recent-title">
        <h2 id="home-settings-recent-title" className="settings-group__title">
          {HOME_RECENTLY_VIEWED_SECTION_TITLE}
        </h2>
        <div className="settings-panel">
          <div
            className="settings-choice-list"
            role="radiogroup"
            aria-label={`Режим секции «${HOME_RECENTLY_VIEWED_SECTION_TITLE}»`}
          >
            {HOME_RECENTLY_VIEWED_SECTION_MODE_OPTIONS.map((option) => {
              const isActive = settings.homeRecentlyViewedSection === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className={`settings-choice${isActive ? ' settings-choice--active' : ''}`}
                  onClick={() => void updateSettings({ homeRecentlyViewedSection: option.id })}
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
        <p className="settings-group__footer">Фильмы, которые вы открывали в деталке.</p>
      </section>

      <section className="settings-group" aria-labelledby="home-settings-slider-title">
        <h2 id="home-settings-slider-title" className="settings-group__title">
          Слайдер
        </h2>
        <div className="settings-panel">
          <div className="settings-row">
            <SettingsGlyph tone="teal">
              <TrendingIcon size={15} strokeWidth={1.9} />
            </SettingsGlyph>
            <div className="settings-row__body">
              <p className="settings-row__label">Автоматический слайдер</p>
              <p className="settings-row__hint">Переключение рекомендаций на главной</p>
            </div>
            <SettingsSwitch
              checked={settings.heroAutoSlide}
              disabled={!settings.heroEnabled}
              onChange={(checked) => void updateSettings({ heroAutoSlide: checked })}
              aria-label="Автоматический слайдер"
            />
          </div>

          <div className="settings-row">
            <SettingsGlyph tone="gray">
              <HistoryIcon size={15} strokeWidth={1.9} />
            </SettingsGlyph>
            <div className="settings-row__body">
              <p className="settings-row__label">Интервал</p>
              <p className="settings-row__hint">
                От {HERO_SLIDE_INTERVAL_MIN_SEC} до {HERO_SLIDE_INTERVAL_MAX_SEC} сек
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
        </div>
        <p className="settings-group__footer">
          Работает только когда блок рекомендаций включён.
        </p>
      </section>

      <section className="settings-group" aria-labelledby="home-settings-source-title">
        <h2 id="home-settings-source-title" className="settings-group__title">
          Категория в слайдере
        </h2>
        <div className="settings-panel">
          {!heroSourceOptions.length ? (
            <p className="settings-hidden-empty">Секции главной ещё не загружены</p>
          ) : (
            <div className="settings-choice-list" role="radiogroup" aria-label="Категория в слайдере">
              {heroSourceOptions.map((row) => {
                const checked = selectedHeroSourceId === row.id;

                return (
                  <button
                    key={row.id}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    aria-label={`Источник слайдера: ${row.title}`}
                    className={`settings-choice${checked ? ' settings-choice--active' : ''}`}
                    disabled={!settings.heroEnabled}
                    onClick={() => {
                      if (checked) {
                        return;
                      }

                      void updateSettings({ heroSourceSectionIds: [row.id] });
                    }}
                  >
                    <span className="settings-choice__body">
                      <span className="settings-choice__label">{row.title}</span>
                    </span>
                    <SettingsCheckbox checked={checked} decorative disabled={!settings.heroEnabled} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <p className="settings-group__footer">Только одна секция. По умолчанию — «В тренде».</p>
      </section>

      <section className="settings-group" aria-labelledby="home-settings-hidden-title">
        <h2 id="home-settings-hidden-title" className="settings-group__title">
          Скрытые секции
        </h2>
        <div className="settings-panel">
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
        </div>
        <p className="settings-group__footer">Секции, скрытые с главной. Можно вернуть в любой момент.</p>
      </section>
    </div>
  );
}
