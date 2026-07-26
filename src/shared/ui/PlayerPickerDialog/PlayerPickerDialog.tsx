import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MediaPlayerOption } from '../../../../contracts/ipc';
import { CloseIcon } from '@/shared/ui/icons';
import './PlayerPickerDialog.css';

interface PlayerPickerDialogProps {
  open: boolean;
  title?: string;
  defaultPlayerId: string;
  isOpening?: boolean;
  onCancel: () => void;
  onConfirm: (playerId: string, remember: boolean) => void;
}

function playerKindLabel(kind: MediaPlayerOption['kind']): string {
  if (kind === 'builtin') {
    return 'Встроенный · по умолчанию';
  }
  if (kind === 'system') {
    return 'Через ассоциации ОС';
  }
  return 'Установлен в системе';
}

export function PlayerPickerDialog({
  open,
  title = 'Выбор плеера',
  defaultPlayerId,
  isOpening = false,
  onCancel,
  onConfirm,
}: PlayerPickerDialogProps) {
  const [players, setPlayers] = useState<MediaPlayerOption[]>([]);
  const [selectedId, setSelectedId] = useState(defaultPlayerId);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedId(defaultPlayerId);
    setRemember(true);
    setLoading(true);

    void (async () => {
      try {
        const list = (await window.electronAPI?.system?.listMediaPlayers?.()) ?? [
          {
            id: 'vodomerka',
            name: 'Vodomerka Player',
            kind: 'builtin' as const,
            installed: true,
          },
          {
            id: 'system',
            name: 'Системный плеер',
            kind: 'system' as const,
            installed: true,
          },
        ];
        setPlayers(list);
        const preferred =
          list.find((item) => item.id === defaultPlayerId)?.id ??
          list.find((item) => item.id === 'vodomerka')?.id ??
          list[0]?.id ??
          'vodomerka';
        setSelectedId(preferred);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, defaultPlayerId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isOpening) {
        onCancel();
      }
      if (event.key === 'Enter' && !isOpening && !loading) {
        onConfirm(selectedId, remember);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, isOpening, loading, selectedId, remember, onCancel, onConfirm]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="player-picker" role="presentation">
      <button
        type="button"
        className="player-picker__backdrop"
        aria-label="Закрыть"
        onClick={onCancel}
        disabled={isOpening}
      />

      <div className="player-picker__frame">
        <div className="player-picker__snake-ring" aria-hidden="true">
          <div className="player-picker__snake-beam player-picker__snake-beam--trail" />
          <div className="player-picker__snake-beam player-picker__snake-beam--core" />
        </div>

        <div
          className="player-picker__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="player-picker-title"
          aria-describedby="player-picker-hint"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="player-picker__header">
            <div className="player-picker__heading">
              <h2 id="player-picker-title" className="player-picker__title">
                {title}
              </h2>
              <p id="player-picker-hint" className="player-picker__hint">
                Чем открыть скачанный файл?
              </p>
            </div>
            <button
              type="button"
              className="player-picker__close"
              aria-label="Закрыть"
              onClick={onCancel}
              disabled={isOpening}
            >
              <CloseIcon size={18} />
            </button>
          </div>

          <div className="player-picker__list" role="radiogroup" aria-label="Плееры">
            {loading ? (
              <p className="player-picker__loading">Ищем установленные плееры…</p>
            ) : (
              players.map((player) => {
                const selected = selectedId === player.id;
                return (
                  <button
                    key={player.id}
                    type="button"
                    className={`player-picker__option${selected ? ' is-selected' : ''}${
                      player.kind === 'builtin' ? ' is-builtin' : ''
                    }`}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedId(player.id)}
                    disabled={isOpening}
                  >
                    <span className="player-picker__radio" aria-hidden="true" />
                    <span className="player-picker__meta">
                      <span className="player-picker__name">{player.name}</span>
                      <span className="player-picker__kind">{playerKindLabel(player.kind)}</span>
                    </span>
                    {player.kind === 'builtin' ? (
                      <span className="player-picker__badge">Встроенный</span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          <label className="player-picker__remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              disabled={isOpening}
            />
            <span>Запомнить как плеер по умолчанию</span>
          </label>

          <div className="player-picker__actions">
            <button
              type="button"
              className="player-picker__btn player-picker__btn--cancel"
              onClick={onCancel}
              disabled={isOpening}
            >
              Отмена
            </button>
            <button
              type="button"
              className="player-picker__btn player-picker__btn--primary"
              onClick={() => onConfirm(selectedId, remember)}
              disabled={isOpening || loading || !selectedId}
            >
              {isOpening ? 'Открываем…' : 'Открыть'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
