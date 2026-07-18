import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import { CATALOG_ROW_GAP_OPTIONS } from '@/shared/settings/types';
import '@/components/SettingsView/SettingsView.css';
import './BrowseSettingsPanels.css';

interface BrowseSettingsPanelsProps {
  variant?: 'settings' | 'menu';
}

export function BrowseSettingsPanels({ variant = 'settings' }: BrowseSettingsPanelsProps) {
  const { settings, updateSettings } = useAppSettings();

  return (
    <div className={`browse-settings-panels browse-settings-panels--${variant}`}>
      <section className="settings-panel" aria-labelledby="browse-settings-labels-title">
        <div className="settings-panel__intro">
          <h2 id="browse-settings-labels-title" className="settings-panel__title">
            Подписи к карточкам
          </h2>
          <p className="settings-panel__description">
            Название, год и рейтинг под обложками на главной, в каталоге, в поиске и в подборках.
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

      <section className="settings-panel" aria-labelledby="browse-settings-gap-title">
        <div className="settings-panel__intro">
          <h2 id="browse-settings-gap-title" className="settings-panel__title">
            Отступы сетки
          </h2>
          <p className="settings-panel__description">
            Расстояние между карточками в каталоге.
          </p>
        </div>

        <div
          className="settings-mode-picker browse-settings-panels__gap-picker"
          role="radiogroup"
          aria-label="Отступы сетки"
        >
          {CATALOG_ROW_GAP_OPTIONS.map((option) => {
            const isActive = settings.catalogRowGap === option.id;

            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                className={`settings-mode-picker__option${
                  isActive ? ' settings-mode-picker__option--active' : ''
                }`}
                onClick={() => {
                  if (!isActive) {
                    void updateSettings({ catalogRowGap: option.id });
                  }
                }}
              >
                <span className="settings-mode-picker__label">{option.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
