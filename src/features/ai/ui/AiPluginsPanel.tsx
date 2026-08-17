import { useMemo, useState } from 'react';
import {
  AI_MODEL_CATALOG,
  cancelAiPull,
  deleteAiModel,
  formatAiModelSize,
  isCatalogModelInstalled,
  pullAiModel,
} from '@/shared/ai';
import { useAiStatus } from '@/shared/ai/useAiStatus';
import { AiSetupGuide } from '@/features/ai/ui/AiSetupGuide';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import { useToast } from '@/shared/ui/Toast/ToastContext';
import { SettingsCheckbox } from '@/shared/ui/SettingsControls/SettingsCheckbox';
import { SettingsGlyph } from '@/shared/ui/SettingsControls/SettingsGlyph';
import { CloseIcon, HistoryIcon, SparklesIcon, TrashIcon } from '@/shared/ui/icons';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function AiPluginsPanel() {
  const { settings, updateSettings } = useAppSettings();
  const { showToast } = useToast();
  const { snapshot, isChecking, refresh, pullProgress, setPullProgress } = useAiStatus();
  const [busyModel, setBusyModel] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const installedNames = useMemo(
    () => snapshot?.models.map((model) => model.name) ?? [],
    [snapshot],
  );

  const availableCatalog = AI_MODEL_CATALOG.filter(
    (entry) => !isCatalogModelInstalled(entry.id, installedNames),
  );

  const handleOpenInstall = () => {
    const url = snapshot?.installUrl ?? 'https://ollama.com/download';
    void window.electronAPI?.system.openExternal(url);
  };

  const handleCancelPull = async () => {
    if (!busyModel || isCancelling) {
      return;
    }

    setIsCancelling(true);
    try {
      await cancelAiPull();
    } finally {
      setIsCancelling(false);
    }
  };

  const handlePull = async (modelId: string, label: string) => {
    if (snapshot?.status !== 'ready' && snapshot?.status !== 'no_models') {
      showToast('Сначала установи и запусти Ollama', { kind: 'error', title: 'ИИ' });
      return;
    }

    setBusyModel(modelId);
    setPullProgress({ model: modelId, status: 'starting', progress: 0 });
    try {
      const result = await pullAiModel(modelId, settings.aiBaseUrl);
      if (!result.ok) {
        if (result.cancelled) {
          showToast('Загрузка отменена', { kind: 'success', title: 'ИИ' });
          return;
        }
        showToast(result.error, { kind: 'error', title: 'ИИ' });
        return;
      }

      if (!settings.aiModel) {
        await updateSettings({ aiModel: modelId });
      } else {
        await refresh();
      }

      showToast(`${label} установлена`, { kind: 'success', title: 'ИИ' });
    } finally {
      setBusyModel(null);
      setPullProgress(null);
      setIsCancelling(false);
    }
  };

  const handleSelectInstalled = async (model: string) => {
    await updateSettings({ aiModel: model });
    showToast(`Выбрана ${model}`, { kind: 'success', title: 'ИИ' });
  };

  const handleDelete = async (model: string) => {
    setBusyModel(model);
    try {
      const result = await deleteAiModel(model, settings.aiBaseUrl);
      if (!result.ok) {
        showToast(result.error, { kind: 'error', title: 'ИИ' });
        return;
      }

      if (settings.aiModel === model) {
        const next = await refresh();
        const fallback = next?.recommendedModel ?? next?.models[0]?.name ?? '';
        await updateSettings({
          aiModel: fallback,
        });
      } else {
        await refresh();
      }

      showToast(`${model} удалена`, { kind: 'success', title: 'ИИ' });
    } finally {
      setBusyModel(null);
    }
  };

  const runtimeReady = snapshot?.status === 'ready' || snapshot?.status === 'no_models';
  const isPulling = Boolean(busyModel && availableCatalog.some((entry) => entry.id === busyModel));

  return (
    <div className="settings-panels-grid">
      {!runtimeReady ? (
        <section className="settings-group" aria-labelledby="plugins-ai-setup-title">
          <h2 id="plugins-ai-setup-title" className="settings-group__title">
            Подключение
          </h2>
          <div className="settings-panel">
            <AiSetupGuide snapshot={snapshot} onOpenInstall={handleOpenInstall} />
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
                {isChecking ? 'Проверка…' : 'Проверить Ollama'}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="settings-group" aria-labelledby="plugins-ai-installed-title">
        <h2 id="plugins-ai-installed-title" className="settings-group__title">
          Установленные модели
        </h2>
        <div className="settings-panel">
          {!snapshot || snapshot.models.length === 0 ? (
            <p className="settings-hidden-empty">
              Пока пусто — скачай Qwen 3.6 из каталога ниже
            </p>
          ) : (
            <div className="settings-theme-grid" role="radiogroup" aria-label="Установленные модели">
              {snapshot.models.map((model) => {
                const isActive = settings.aiModel === model.name;
                const busy = busyModel === model.name;
                const sizeLabel = formatAiModelSize(model.size);

                return (
                  <div
                    key={model.name}
                    className={`plugins-item${isActive ? ' plugins-item--active' : ''}`}
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      className={`settings-theme-card${
                        isActive ? ' settings-theme-card--active' : ''
                      }`}
                      disabled={busy || isPulling}
                      onClick={() => void handleSelectInstalled(model.name)}
                    >
                      <span className="ai-model-card__mark" aria-hidden="true">
                        <SparklesIcon size={18} strokeWidth={1.8} />
                      </span>
                      <span className="settings-theme-card__body">
                        <span className="settings-theme-card__label">{model.name}</span>
                        <span className="settings-theme-card__description">
                          {[model.parameterSize, model.quantization, sizeLabel]
                            .filter(Boolean)
                            .join(' · ') || 'Локальная модель'}
                        </span>
                      </span>
                      <span className="settings-theme-card__check">
                        <SettingsCheckbox checked={isActive} decorative />
                      </span>
                    </button>
                    <button
                      type="button"
                      className="plugins-item__remove"
                      disabled={busy || isPulling}
                      aria-label={`Удалить ${model.name}`}
                      onClick={() => void handleDelete(model.name)}
                    >
                      <TrashIcon size={15} strokeWidth={1.9} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <p className="settings-group__footer">
          Нажми модель, чтобы выбрать её для локального ИИ.
        </p>
      </section>

      <section className="settings-group" aria-labelledby="plugins-ai-catalog-title">
        <h2 id="plugins-ai-catalog-title" className="settings-group__title">
          Каталог моделей
        </h2>
        <div className="settings-panel">
          {!runtimeReady ? (
            <p className="settings-hidden-empty">Сначала подключи Ollama</p>
          ) : availableCatalog.length === 0 ? (
            <p className="settings-hidden-empty">Рекомендуемые модели уже установлены</p>
          ) : (
            <div className="settings-theme-grid">
              {availableCatalog.map((entry) => {
                const busy = busyModel === entry.id;
                const percent = Math.round(
                  busy && pullProgress?.model === entry.id
                    ? clamp01(pullProgress.progress) * 100
                    : 0,
                );

                return (
                  <div
                    key={entry.id}
                    className={`plugins-item${busy ? ' plugins-item--active' : ''}`}
                  >
                    <button
                      type="button"
                      className={`settings-theme-card plugins-catalog-card${
                        busy ? ' plugins-catalog-card--busy' : ''
                      }`}
                      disabled={busy || Boolean(busyModel) || !runtimeReady}
                      onClick={() => void handlePull(entry.id, entry.name)}
                    >
                      {busy ? (
                        <span
                          className="plugins-catalog-card__progress"
                          style={{ width: `${percent}%` }}
                          aria-hidden="true"
                        />
                      ) : null}
                      <span className="ai-model-card__mark" aria-hidden="true">
                        <SparklesIcon size={18} strokeWidth={1.8} />
                      </span>
                      <span className="settings-theme-card__body">
                        <span className="settings-theme-card__label">
                          {entry.name}
                          {entry.recommended ? ' · рекомендуем' : ''}
                        </span>
                        <span className="settings-theme-card__description">
                          {entry.description} · {entry.sizeLabel}
                        </span>
                      </span>
                      <span className="plugins-catalog-card__action">
                        {busy ? `${percent}%` : 'Скачать'}
                      </span>
                    </button>
                    {busy ? (
                      <button
                        type="button"
                        className="plugins-item__remove"
                        disabled={isCancelling}
                        aria-label={`Отменить загрузку ${entry.name}`}
                        title="Отменить"
                        onClick={() => void handleCancelPull()}
                      >
                        <CloseIcon size={15} strokeWidth={1.9} />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <div className="settings-data-actions">
            {isPulling ? (
              <button
                type="button"
                className="settings-action-btn"
                disabled={isCancelling}
                onClick={() => void handleCancelPull()}
              >
                <SettingsGlyph tone="red">
                  <CloseIcon size={15} strokeWidth={1.9} />
                </SettingsGlyph>
                {isCancelling ? 'Отмена…' : 'Отменить загрузку'}
              </button>
            ) : null}
            <button
              type="button"
              className="settings-action-btn"
              disabled={isChecking || isPulling}
              onClick={() => void refresh()}
            >
              <SettingsGlyph tone="blue">
                <HistoryIcon size={15} strokeWidth={1.9} />
              </SettingsGlyph>
              {isChecking ? 'Обновление…' : 'Обновить список'}
            </button>
          </div>
        </div>
        <p className="settings-group__footer">
          Загрузка идёт через Ollama (`ollama pull`).
        </p>
      </section>
    </div>
  );
}
