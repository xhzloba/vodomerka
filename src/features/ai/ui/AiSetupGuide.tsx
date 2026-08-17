import type { AiRuntimeStatus, AiStatusSnapshot } from '../../../../contracts/ipc';
import { SettingsGlyph } from '@/shared/ui/SettingsControls/SettingsGlyph';
import { DownloadIcon, InfoIcon } from '@/shared/ui/icons';
import './AiSetupGuide.css';

interface AiSetupGuideProps {
  snapshot: AiStatusSnapshot | null;
  compact?: boolean;
  onOpenInstall?: () => void;
  onOpenPlugins?: () => void;
}

function stepsForPlatform(platform: AiStatusSnapshot['platform']): string[] {
  if (platform === 'darwin') {
    return [
      'Скачай Ollama для macOS и установи .app',
      'Запусти Ollama из Программ — иконка появится в меню',
      'Вернись сюда и нажми «Проверить». Затем скачай модель во вкладке Плагины → ИИ',
    ];
  }

  if (platform === 'win32') {
    return [
      'Скачай Ollama Setup для Windows и установи',
      'Запусти Ollama — сервис поднимется в фоне на порту 11434',
      'Вернись сюда и нажми «Проверить». Затем скачай модель во вкладке Плагины → ИИ',
    ];
  }

  return [
    'Установи Ollama с сайта ollama.com',
    'Запусти сервис (обычно `ollama serve`)',
    'Проверь статус здесь и скачай модель в Плагины → ИИ',
  ];
}

function titleForStatus(status: AiRuntimeStatus | undefined): string {
  switch (status) {
    case 'missing':
      return 'Сначала установи Ollama';
    case 'offline':
      return 'Ollama не запущен';
    case 'no_models':
      return 'Нужна модель';
    case 'ready':
      return 'Локальный ИИ готов';
    default:
      return 'Подключение локального ИИ';
  }
}

export function AiSetupGuide({
  snapshot,
  compact = false,
  onOpenInstall,
  onOpenPlugins,
}: AiSetupGuideProps) {
  const platform = snapshot?.platform ?? (navigator.platform.toLowerCase().includes('win') ? 'win32' : 'darwin');
  const status = snapshot?.status;
  const steps = stepsForPlatform(platform);
  const showInstall = status === 'missing' || status === 'offline' || status === 'unknown' || !snapshot;
  const showPlugins = status === 'no_models' || status === 'ready';

  return (
    <div className={`ai-setup-guide${compact ? ' ai-setup-guide--compact' : ''}`}>
      <div className="ai-setup-guide__header">
        <SettingsGlyph tone={status === 'ready' ? 'teal' : 'orange'}>
          <InfoIcon size={15} strokeWidth={1.9} />
        </SettingsGlyph>
        <div className="ai-setup-guide__titles">
          <p className="ai-setup-guide__title">{titleForStatus(status)}</p>
          <p className="ai-setup-guide__text">
            {snapshot?.message ??
              'Vodomerka использует локальный Ollama. Данные каталога и истории не уходят в облако.'}
          </p>
        </div>
      </div>

      {showInstall ? (
        <ol className="ai-setup-guide__steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}

      <div className="ai-setup-guide__actions">
        {showInstall && onOpenInstall ? (
          <button type="button" className="settings-action-btn" onClick={onOpenInstall}>
            <SettingsGlyph tone="blue">
              <DownloadIcon size={15} strokeWidth={1.9} />
            </SettingsGlyph>
            Скачать Ollama
          </button>
        ) : null}
        {showPlugins && onOpenPlugins ? (
          <button type="button" className="settings-action-btn" onClick={onOpenPlugins}>
            Модели в Плагинах
          </button>
        ) : null}
      </div>
    </div>
  );
}
