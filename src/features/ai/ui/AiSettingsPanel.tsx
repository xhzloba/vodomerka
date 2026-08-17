import { useMemo } from 'react';
import { pickRecommendedAiModel } from '@/shared/ai';
import { openAiPluginsTab } from '@/shared/ai/navigation';
import { useAiStatus } from '@/shared/ai/useAiStatus';
import { AiSetupGuide } from '@/features/ai/ui/AiSetupGuide';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import { useToast } from '@/shared/ui/Toast/ToastContext';
import { SettingsCheckbox } from '@/shared/ui/SettingsControls/SettingsCheckbox';
import { SettingsGlyph } from '@/shared/ui/SettingsControls/SettingsGlyph';
import { HistoryIcon, PuzzleIcon } from '@/shared/ui/icons';

export function AiSettingsPanel() {
  const { settings, updateSettings } = useAppSettings();
  const { showToast } = useToast();
  const { snapshot, isChecking, refresh } = useAiStatus();

  const installedNames = useMemo(
    () => snapshot?.models.map((model) => model.name) ?? [],
    [snapshot],
  );

  const selectedModel =
    settings.aiModel ||
    pickRecommendedAiModel(installedNames) ||
    snapshot?.recommendedModel ||
    '';

  const statusHint = (() => {
    if (isChecking) {
      return 'Проверка…';
    }
    if (!snapshot) {
      return 'Не проверено';
    }
    if (snapshot.status === 'ready') {
      return 'Готов';
    }
    if (snapshot.status === 'no_models') {
      return 'Нет моделей';
    }
    if (snapshot.status === 'offline') {
      return 'Не запущен';
    }
    if (snapshot.status === 'missing') {
      return 'Не установлен';
    }
    return 'Неизвестно';
  })();

  const handleOpenInstall = () => {
    const url = snapshot?.installUrl ?? 'https://ollama.com/download';
    void window.electronAPI?.system.openExternal(url);
  };

  const handleSelectModel = async (model: string) => {
    if (settings.aiModel === model) {
      return;
    }

    await updateSettings({ aiModel: model });
    showToast(`Модель: ${model}`, { kind: 'success', title: 'ИИ' });
  };

  return (
    <div className="settings-panels-grid">
      <section className="settings-group" aria-labelledby="settings-ai-status-title">
        <h2 id="settings-ai-status-title" className="settings-group__title">
          Ollama
        </h2>
        <div className="settings-panel">
          <div className="settings-row">
            <SettingsGlyph tone={snapshot?.status === 'ready' ? 'teal' : 'orange'}>
              <PuzzleIcon size={15} strokeWidth={1.9} />
            </SettingsGlyph>
            <div className="settings-row__body">
              <p className="settings-row__label">Статус</p>
              <p
                className={`settings-row__hint${
                  snapshot?.status === 'ready'
                    ? ' settings-choice__hint--ok'
                    : snapshot?.status === 'missing' ||
                        snapshot?.status === 'offline' ||
                        snapshot?.status === 'no_models'
                      ? ' settings-choice__hint--fail'
                      : ''
                }`}
              >
                {statusHint}
                {snapshot?.version ? ` · v${snapshot.version}` : ''}
              </p>
            </div>
          </div>

          <div className="settings-data-actions">
            <button
              type="button"
              className="settings-action-btn"
              disabled={isChecking}
              onClick={() => void refresh()}
            >
              <SettingsGlyph tone="blue">
                <HistoryIcon size={15} strokeWidth={1.9} />
              </SettingsGlyph>
              {isChecking ? 'Проверка…' : 'Проверить подключение'}
            </button>
          </div>
        </div>
        <p className="settings-group__footer">Локальный рантайм для ИИ. Модели ставятся в Плагины → ИИ.</p>
      </section>

      {snapshot?.status === 'ready' && snapshot.models.length > 0 ? (
        <section className="settings-group" aria-labelledby="settings-ai-model-title">
          <h2 id="settings-ai-model-title" className="settings-group__title">
            Модель
          </h2>
          <div className="settings-panel">
            <div className="settings-choice-list" role="radiogroup" aria-label="Модель ИИ">
              {snapshot.models.map((model) => {
                const isActive = selectedModel === model.name;
                return (
                  <button
                    key={model.name}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={`settings-choice${isActive ? ' settings-choice--active' : ''}`}
                    onClick={() => void handleSelectModel(model.name)}
                  >
                    <span className="settings-choice__body">
                      <span className="settings-choice__label">{model.name}</span>
                      <span className="settings-choice__hint">
                        {[model.parameterSize, model.quantization].filter(Boolean).join(' · ') ||
                          'Установлена локально'}
                      </span>
                    </span>
                    <SettingsCheckbox checked={isActive} decorative />
                  </button>
                );
              })}
            </div>
          </div>
          <p className="settings-group__footer">
            Новые модели качаются в Плагины → ИИ.
          </p>
        </section>
      ) : (
        <section className="settings-group" aria-labelledby="settings-ai-setup-title">
          <h2 id="settings-ai-setup-title" className="settings-group__title">
            Установка
          </h2>
          <div className="settings-panel">
            <AiSetupGuide
              snapshot={snapshot}
              onOpenInstall={handleOpenInstall}
              onOpenPlugins={() => openAiPluginsTab()}
            />
          </div>
        </section>
      )}
    </div>
  );
}
