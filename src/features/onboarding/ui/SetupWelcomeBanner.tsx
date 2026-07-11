import { SettingsIcon } from '@/shared/ui/icons';
import './SetupWelcomeBanner.css';

interface SetupWelcomeBannerProps {
  displayName?: string | null;
  onOpenSettings: () => void;
  onDismiss: () => void;
}

export function SetupWelcomeBanner({
  displayName,
  onOpenSettings,
  onDismiss,
}: SetupWelcomeBannerProps) {
  const greeting = displayName ? `Добро пожаловать, ${displayName}` : 'Добро пожаловать';

  return (
    <div className="setup-welcome" role="region" aria-label="Добро пожаловать">
      <div className="setup-welcome__panel">
        <span className="setup-welcome__snake" aria-hidden="true">
          <span className="setup-welcome__snake-beam setup-welcome__snake-beam--core" />
        </span>

        <div className="setup-welcome__icon" aria-hidden="true">
          <SettingsIcon size={22} strokeWidth={1.6} />
        </div>

        <div className="setup-welcome__copy">
          <p className="setup-welcome__eyebrow">{greeting}</p>
          <h2 className="setup-welcome__title">Сделайте приложение своим</h2>
          <p className="setup-welcome__text">
            Настройте тему, секции главной, каталог и карточки — всё под ваш стиль просмотра.
          </p>
        </div>

        <div className="setup-welcome__actions">
          <button type="button" className="setup-welcome__cta" onClick={onOpenSettings}>
            Открыть настройки
          </button>
          <button
            type="button"
            className="setup-welcome__later"
            onClick={onDismiss}
          >
            Позже
          </button>
        </div>
      </div>
    </div>
  );
}
