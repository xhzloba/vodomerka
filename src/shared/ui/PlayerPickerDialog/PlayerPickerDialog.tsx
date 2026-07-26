import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MediaPlayerOption } from '../../../../contracts/ipc';
import { CheckIcon, CloseIcon } from '@/shared/ui/icons';
import './PlayerPickerDialog.css';

interface PlayerPickerDialogProps {
  open: boolean;
  title?: string;
  defaultPlayerId: string;
  isOpening?: boolean;
  onCancel: () => void;
  onConfirm: (playerId: string, remember: boolean) => void;
}

const DEFAULT_PLAYERS: MediaPlayerOption[] = [
  {
    id: 'vodomerka',
    name: 'Vodomerka Player',
    kind: 'builtin',
    installed: true,
  },
  {
    id: 'system',
    name: 'Системный плеер',
    kind: 'system',
    installed: true,
  },
];

/** Keep last IPC result so reopen is instant (no “Ищем плееры…” flash). */
let cachedPlayers: MediaPlayerOption[] | null = null;

function playerKindLabel(kind: MediaPlayerOption['kind']): string {
  if (kind === 'builtin') {
    return 'В приложении';
  }
  if (kind === 'system') {
    return 'Плеер по умолчанию';
  }
  return 'Установлен в системе';
}

function pickPreferredId(list: MediaPlayerOption[], defaultPlayerId: string): string {
  return (
    list.find((item) => item.id === defaultPlayerId)?.id ??
    list.find((item) => item.id === 'vodomerka')?.id ??
    list[0]?.id ??
    'vodomerka'
  );
}

export function PlayerPickerDialog({
  open,
  title = 'Выбор плеера',
  defaultPlayerId,
  isOpening = false,
  onCancel,
  onConfirm,
}: PlayerPickerDialogProps) {
  const [players, setPlayers] = useState<MediaPlayerOption[]>(
    () => cachedPlayers ?? DEFAULT_PLAYERS,
  );
  const [selectedId, setSelectedId] = useState(defaultPlayerId);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (!open) {
      return;
    }

    const seed = cachedPlayers ?? DEFAULT_PLAYERS;
    setPlayers(seed);
    setSelectedId(pickPreferredId(seed, defaultPlayerId));
    setRemember(true);

    let cancelled = false;
    void (async () => {
      try {
        const list = (await window.electronAPI?.system?.listMediaPlayers?.()) ?? DEFAULT_PLAYERS;
        if (cancelled || list.length === 0) {
          return;
        }
        cachedPlayers = list;
        setPlayers(list);
        setSelectedId((current) =>
          list.some((item) => item.id === current)
            ? current
            : pickPreferredId(list, defaultPlayerId),
        );
      } catch {
        // keep seed list
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, defaultPlayerId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isOpening) {
        onCancel();
      }
      if (event.key === 'Enter' && !isOpening) {
        onConfirm(selectedId, remember);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, isOpening, selectedId, remember, onCancel, onConfirm]);

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
                Чем открыть файл?
              </p>
            </div>
            <button
              type="button"
              className="player-picker__close"
              aria-label="Закрыть"
              onClick={onCancel}
              disabled={isOpening}
            >
              <CloseIcon size={15} strokeWidth={2.25} />
            </button>
          </div>

          <div className="player-picker__list" role="radiogroup" aria-label="Плееры">
            {players.map((player, index) => {
              const selected = selectedId === player.id;
              return (
                <button
                  key={player.id}
                  type="button"
                  className={`player-picker__option${selected ? ' is-selected' : ''}${
                    index === 0 ? ' is-first' : ''
                  }${index === players.length - 1 ? ' is-last' : ''}`}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSelectedId(player.id)}
                  disabled={isOpening}
                >
                  <span className="player-picker__meta">
                    <span className="player-picker__name">{player.name}</span>
                    <span className="player-picker__kind">{playerKindLabel(player.kind)}</span>
                  </span>
                  <span className="player-picker__check" aria-hidden="true">
                    {selected ? <CheckIcon size={15} strokeWidth={2.5} /> : null}
                  </span>
                </button>
              );
            })}
          </div>

          <label className={`player-picker__remember${remember ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              disabled={isOpening}
            />
            <span className="player-picker__switch" aria-hidden="true" />
            <span className="player-picker__remember-label">Запомнить выбор</span>
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
              disabled={isOpening || !selectedId}
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
