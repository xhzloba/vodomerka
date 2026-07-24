import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import { CATALOG_ROW_GAP_OPTIONS } from '@/shared/settings/types';
import { SettingsCheckbox } from '@/shared/ui/SettingsControls/SettingsCheckbox';
import { SettingsGlyph } from '@/shared/ui/SettingsControls/SettingsGlyph';
import { SettingsSwitch } from '@/shared/ui/SettingsControls/SettingsSwitch';
import { CoverSpacingIcon, FilmIcon } from '@/shared/ui/icons';
import '@/components/SettingsView/SettingsView.css';
import './BrowseSettingsPanels.css';

interface BrowseSettingsPanelsProps {
  variant?: 'settings' | 'menu';
}

export function BrowseSettingsPanels({ variant = 'settings' }: BrowseSettingsPanelsProps) {
  const { settings, updateSettings } = useAppSettings();

  return (
    <div className={`browse-settings-panels browse-settings-panels--${variant}`}>
      <section className="settings-group" aria-labelledby="browse-settings-labels-title">
        <h2 id="browse-settings-labels-title" className="settings-group__title">
          Подписи
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
        </div>
      </section>

      <section className="settings-group" aria-labelledby="browse-settings-gap-title">
        <h2 id="browse-settings-gap-title" className="settings-group__title">
          Отступы сетки
        </h2>
        <div className="settings-panel">
          <div className="settings-choice-list" role="radiogroup" aria-label="Отступы сетки">
            {CATALOG_ROW_GAP_OPTIONS.map((option) => {
              const isActive = settings.catalogRowGap === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className={`settings-choice${isActive ? ' settings-choice--active' : ''}`}
                  onClick={() => {
                    if (!isActive) {
                      void updateSettings({ catalogRowGap: option.id });
                    }
                  }}
                >
                  <SettingsGlyph tone="teal">
                    <CoverSpacingIcon size={15} strokeWidth={1.9} />
                  </SettingsGlyph>
                  <span className="settings-choice__body">
                    <span className="settings-choice__label">{option.label}</span>
                  </span>
                  <SettingsCheckbox checked={isActive} decorative />
                </button>
              );
            })}
          </div>
        </div>
        <p className="settings-group__footer">Расстояние между карточками в каталоге.</p>
      </section>
    </div>
  );
}
