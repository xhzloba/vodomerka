import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TorrentDownloadFile } from '../../../../contracts/ipc';
import {
  formatFileProgressLabel,
  getFileProgress,
  groupTorrentEpisodes,
} from '@/shared/domain/torrentEpisodes';
import { CheckIcon, CloseIcon } from '@/shared/ui/icons';
import '../PlayerPickerDialog/PlayerPickerDialog.css';
import './EpisodePickerDialog.css';

interface EpisodePickerDialogProps {
  open: boolean;
  title?: string;
  files: TorrentDownloadFile[];
  currentFilePath?: string | null;
  isOpening?: boolean;
  onCancel: () => void;
  onConfirm: (filePath: string) => void;
}

export function EpisodePickerDialog({
  open,
  title = 'Выбор серии',
  files,
  currentFilePath = null,
  isOpening = false,
  onCancel,
  onConfirm,
}: EpisodePickerDialogProps) {
  const groups = useMemo(() => groupTorrentEpisodes(files), [files]);
  const [seasonKey, setSeasonKey] = useState<string>('0');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const initialGroup =
      groups.find((group) =>
        group.episodes.some((item) => item.file.path === currentFilePath),
      ) ?? groups[0];
    const initialEpisode =
      initialGroup?.episodes.find((item) => item.file.path === currentFilePath) ??
      initialGroup?.episodes[0];

    setSeasonKey(
      initialGroup?.season == null ? 'other' : String(initialGroup.season),
    );
    setSelectedPath(initialEpisode?.file.path ?? null);
  }, [open, groups, currentFilePath]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isOpening) {
        onCancel();
      }
      if (event.key === 'Enter' && !isOpening && selectedPath) {
        onConfirm(selectedPath);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, isOpening, selectedPath, onCancel, onConfirm]);

  const activeGroup =
    groups.find((group) =>
      group.season == null ? seasonKey === 'other' : String(group.season) === seasonKey,
    ) ?? groups[0];

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="player-picker episode-picker" role="presentation">
      <button
        type="button"
        className="player-picker__backdrop"
        aria-label="Закрыть"
        onClick={onCancel}
        disabled={isOpening}
      />

      <div className="player-picker__frame episode-picker__frame">
        <div className="player-picker__snake-ring" aria-hidden="true">
          <div className="player-picker__snake-beam player-picker__snake-beam--trail" />
          <div className="player-picker__snake-beam player-picker__snake-beam--core" />
        </div>

        <div
          className="player-picker__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="episode-picker-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="player-picker__header">
            <div className="player-picker__heading">
              <h2 id="episode-picker-title" className="player-picker__title">
                {title}
              </h2>
              <p className="player-picker__hint">
                Можно выбрать любую серию — даже пока качается
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

          {groups.length > 1 ? (
            <div className="episode-picker__seasons" role="tablist" aria-label="Сезоны">
              {groups.map((group) => {
                const key = group.season == null ? 'other' : String(group.season);
                const active = key === seasonKey;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`episode-picker__season${active ? ' is-active' : ''}`}
                    onClick={() => {
                      setSeasonKey(key);
                      const first = group.episodes[0];
                      if (first) {
                        setSelectedPath(first.file.path);
                      }
                    }}
                    disabled={isOpening}
                  >
                    {group.title}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="episode-picker__list" role="listbox" aria-label="Серии">
            {(activeGroup?.episodes ?? []).map((item) => {
              const selected = selectedPath === item.file.path;
              const progress = getFileProgress(item.file);
              const progressLabel = formatFileProgressLabel(item.file);
              return (
                <button
                  key={item.file.path}
                  type="button"
                  className={`episode-picker__item${selected ? ' is-selected' : ''}${
                    progress >= 0.999 ? ' is-done' : progress > 0 ? ' is-downloading' : ''
                  }`}
                  role="option"
                  aria-selected={selected}
                  onClick={() => setSelectedPath(item.file.path)}
                  disabled={isOpening}
                >
                  <span className="episode-picker__item-copy">
                    <span className="episode-picker__item-topline">
                      <span className="episode-picker__item-label">{item.label}</span>
                      <span className="episode-picker__item-progress">{progressLabel}</span>
                    </span>
                    <span className="episode-picker__item-file">{item.file.name}</span>
                    {progress > 0 && progress < 0.999 ? (
                      <span className="episode-picker__item-bar" aria-hidden="true">
                        <span style={{ width: `${Math.round(progress * 100)}%` }} />
                      </span>
                    ) : null}
                  </span>
                  <span className="episode-picker__item-check" aria-hidden="true">
                    {selected ? <CheckIcon size={15} strokeWidth={2.5} /> : null}
                  </span>
                </button>
              );
            })}
          </div>

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
              onClick={() => {
                if (selectedPath) {
                  onConfirm(selectedPath);
                }
              }}
              disabled={isOpening || !selectedPath}
            >
              {isOpening ? 'Открываем…' : 'Смотреть'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
