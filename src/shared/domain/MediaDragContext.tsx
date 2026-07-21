import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import type { MediaItem } from '@/shared/domain/media';
import './MediaDragPreview.css';
import { unlockUiSounds } from '@/shared/audio/uiSounds';

export type MediaDragDropTarget = 'favorite' | 'watched' | null;
export type MediaDragEndMode = 'absorb' | 'return';

export interface MediaDragPreviewMeta {
  posterUrl?: string;
  width: number;
  height: number;
}

interface MediaDragHomeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type DropAction = (item: MediaItem, target: Exclude<MediaDragDropTarget, null>) => void;

interface MediaDragContextValue {
  draggingItem: MediaItem | null;
  dropTarget: MediaDragDropTarget;
  beginMediaDrag: (
    item: MediaItem,
    preview?: MediaDragPreviewMeta,
    origin?: { x: number; y: number },
    home?: MediaDragHomeRect,
  ) => void;
  endMediaDrag: (mode?: MediaDragEndMode) => void;
  setDropTarget: (target: MediaDragDropTarget) => void;
  setDropAction: (action: DropAction | null) => void;
  updatePointer: (x: number, y: number) => void;
  releasePointer: (x: number, y: number) => void;
}

const MediaDragContext = createContext<MediaDragContextValue | null>(null);

const SCALE_FAR = 1;
const SCALE_NEAR = 0.28;
const DIST_FAR = 460;
const DIST_NEAR = 36;
const EXIT_ABSORB_MS = 220;
const EXIT_RETURN_MS = 240;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function islandAnchor() {
  return {
    x: window.innerWidth / 2,
    y: 40,
  };
}

function scaleForDistance(x: number, y: number) {
  const island = islandAnchor();
  const dist = Math.hypot(x - island.x, y - island.y);
  const t = clamp((dist - DIST_NEAR) / (DIST_FAR - DIST_NEAR), 0, 1);
  return SCALE_NEAR + t * (SCALE_FAR - SCALE_NEAR);
}

function applyPreviewTransform(
  node: HTMLElement,
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
) {
  node.style.transform = `translate3d(${x - width / 2}px, ${y - height / 2}px, 0) scale(${scale})`;
}

function hitDropTarget(x: number, y: number): Exclude<MediaDragDropTarget, null> | null {
  const el = document.elementFromPoint(x, y);
  const zone = el?.closest<HTMLElement>('[data-media-drop]');
  const value = zone?.dataset.mediaDrop;
  if (value === 'favorite' || value === 'watched') {
    return value;
  }
  return null;
}

function MediaDragPreview({
  item,
  preview,
  origin,
  nodeRef,
}: {
  item: MediaItem;
  preview: MediaDragPreviewMeta;
  origin: { x: number; y: number };
  nodeRef: RefObject<HTMLDivElement | null>;
}) {
  const width = Math.max(48, preview.width);
  const height = Math.max(72, preview.height);

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) {
      return;
    }
    node.style.width = `${width}px`;
    node.style.height = `${height}px`;
    node.style.transition = 'none';
    node.style.opacity = '1';
    node.style.filter = '';
    applyPreviewTransform(node, origin.x, origin.y, width, height, scaleForDistance(origin.x, origin.y));
  }, [height, nodeRef, origin.x, origin.y, width]);

  return createPortal(
    <div ref={nodeRef} className="media-drag-preview" aria-hidden="true">
      {preview.posterUrl ? (
        <img
          className="media-drag-preview__image"
          src={preview.posterUrl}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="media-drag-preview__fallback">{item.title.slice(0, 1)}</span>
      )}
    </div>,
    document.body,
  );
}

export function MediaDragProvider({ children }: { children: ReactNode }) {
  const [draggingItem, setDraggingItem] = useState<MediaItem | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [preview, setPreview] = useState<MediaDragPreviewMeta | null>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<MediaDragDropTarget>(null);

  const previewRef = useRef<HTMLDivElement | null>(null);
  const sizeRef = useRef({ width: 120, height: 180 });
  const homeRef = useRef<MediaDragHomeRect | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const draggingItemRef = useRef<MediaItem | null>(null);
  const exitingRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);
  const exitCloneRef = useRef<HTMLElement | null>(null);
  const dropActionRef = useRef<DropAction | null>(null);
  const posterUrlRef = useRef<string | undefined>(undefined);
  const titleRef = useRef('');

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current != null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const removeExitClone = useCallback(() => {
    const clone = exitCloneRef.current;
    if (clone) {
      clone.remove();
      exitCloneRef.current = null;
    }
  }, []);

  const hardClear = useCallback(() => {
    clearExitTimer();
    removeExitClone();
    exitingRef.current = false;
    draggingItemRef.current = null;
    posterUrlRef.current = undefined;
    titleRef.current = '';
    setDraggingItem(null);
    setPreviewItem(null);
    setPreview(null);
    setOrigin(null);
    setDropTarget(null);
    homeRef.current = null;
    lastPointerRef.current = null;
    document.body.classList.remove('is-media-dragging');
  }, [clearExitTimer, removeExitClone]);

  const beginMediaDrag = useCallback(
    (
      item: MediaItem,
      nextPreview?: MediaDragPreviewMeta,
      nextOrigin?: { x: number; y: number },
      home?: MediaDragHomeRect,
    ) => {
      hardClear();

      const resolvedPreview =
        nextPreview ?? {
          width: 120,
          height: 180,
          posterUrl: item.poster || undefined,
        };
      const width = Math.max(48, resolvedPreview.width);
      const height = Math.max(72, resolvedPreview.height);
      sizeRef.current = { width, height };
      homeRef.current =
        home ??
        (nextOrigin
          ? {
              x: nextOrigin.x - width / 2,
              y: nextOrigin.y - height / 2,
              width,
              height,
            }
          : null);
      lastPointerRef.current = nextOrigin ?? null;
      draggingItemRef.current = item;
      posterUrlRef.current = resolvedPreview.posterUrl;
      titleRef.current = item.title;

      setDraggingItem(item);
      setPreviewItem(item);
      setPreview(resolvedPreview);
      setDropTarget(null);
      setOrigin(nextOrigin ?? null);
      document.body.classList.add('is-media-dragging');
      unlockUiSounds();
    },
    [hardClear],
  );

  const endMediaDrag = useCallback(
    (mode: MediaDragEndMode = 'return') => {
      if (exitingRef.current) {
        return;
      }

      const pointer = lastPointerRef.current;
      const home = homeRef.current;
      const { width, height } = sizeRef.current;

      if (!pointer) {
        hardClear();
        return;
      }

      exitingRef.current = true;
      draggingItemRef.current = null;

      // Сразу снимаем React-превью — анимируем независимый клон
      setDraggingItem(null);
      setPreviewItem(null);
      setPreview(null);
      setOrigin(null);
      setDropTarget(null);
      document.body.classList.remove('is-media-dragging');

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion) {
        hardClear();
        return;
      }

      const startX = pointer.x;
      const startY = pointer.y;

      const clone = document.createElement('div');
      clone.className = 'media-drag-preview';
      clone.setAttribute('aria-hidden', 'true');
      clone.style.width = `${width}px`;
      clone.style.height = `${height}px`;
      clone.style.transition = 'none';
      clone.style.opacity = '1';
      applyPreviewTransform(clone, startX, startY, width, height, scaleForDistance(startX, startY));

      if (posterUrlRef.current) {
        const img = document.createElement('img');
        img.className = 'media-drag-preview__image';
        img.src = posterUrlRef.current;
        img.alt = '';
        img.draggable = false;
        img.referrerPolicy = 'no-referrer';
        clone.appendChild(img);
      } else {
        const fallback = document.createElement('span');
        fallback.className = 'media-drag-preview__fallback';
        fallback.textContent = titleRef.current.slice(0, 1) || '?';
        clone.appendChild(fallback);
      }

      document.body.appendChild(clone);
      exitCloneRef.current = clone;
      void clone.offsetWidth;

      const finish = () => {
        clearExitTimer();
        removeExitClone();
        exitingRef.current = false;
        posterUrlRef.current = undefined;
        titleRef.current = '';
        homeRef.current = null;
        lastPointerRef.current = null;
      };

      const run = () => {
        if (!exitCloneRef.current) {
          return;
        }

        if (mode === 'absorb') {
          const island = islandAnchor();
          clone.classList.add('media-drag-preview--absorb');
          clone.style.transition =
            'transform 200ms cubic-bezier(0.32, 0.72, 0, 1), opacity 140ms ease, filter 140ms ease, border-radius 200ms ease';
          applyPreviewTransform(clone, island.x, island.y, width, height, 0.06);
          clone.style.opacity = '0';
          clone.style.filter = 'blur(8px)';
          clone.style.borderRadius = '999px';
        } else {
          const targetX = (home?.x ?? startX - width / 2) + width / 2;
          const targetY = (home?.y ?? startY - height / 2) + height / 2;
          clone.classList.add('media-drag-preview--return');
          clone.style.transition =
            'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms ease, box-shadow 180ms ease';
          applyPreviewTransform(clone, targetX, targetY, width, height, 1);
          clone.style.opacity = '0';
          clone.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.2)';
        }

        clearExitTimer();
        exitTimerRef.current = window.setTimeout(
          finish,
          mode === 'absorb' ? EXIT_ABSORB_MS : EXIT_RETURN_MS,
        );
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(run);
      });
    },
    [clearExitTimer, hardClear, removeExitClone],
  );

  const updatePointer = useCallback((x: number, y: number) => {
    if (exitingRef.current || !draggingItemRef.current) {
      return;
    }

    lastPointerRef.current = { x, y };
    const node = previewRef.current;
    if (node) {
      const { width, height } = sizeRef.current;
      node.style.transition = 'none';
      applyPreviewTransform(node, x, y, width, height, scaleForDistance(x, y));
    }

    const nextTarget = hitDropTarget(x, y);
    setDropTarget((current) => (current === nextTarget ? current : nextTarget));
  }, []);

  const releasePointer = useCallback(
    (x: number, y: number) => {
      if (exitingRef.current || !draggingItemRef.current) {
        return;
      }

      lastPointerRef.current = { x, y };
      const item = draggingItemRef.current;
      const target = hitDropTarget(x, y);

      if (target && dropActionRef.current) {
        dropActionRef.current(item, target);
        return;
      }

      endMediaDrag('return');
    },
    [endMediaDrag],
  );

  const setDropAction = useCallback((action: DropAction | null) => {
    dropActionRef.current = action;
  }, []);

  useEffect(() => () => hardClear(), [hardClear]);

  const value = useMemo(
    () => ({
      draggingItem,
      dropTarget,
      beginMediaDrag,
      endMediaDrag,
      setDropTarget,
      setDropAction,
      updatePointer,
      releasePointer,
    }),
    [
      beginMediaDrag,
      draggingItem,
      dropTarget,
      endMediaDrag,
      releasePointer,
      setDropAction,
      updatePointer,
    ],
  );

  return (
    <MediaDragContext.Provider value={value}>
      {children}
      {previewItem && preview && origin ? (
        <MediaDragPreview
          item={previewItem}
          preview={preview}
          origin={origin}
          nodeRef={previewRef}
        />
      ) : null}
    </MediaDragContext.Provider>
  );
}

export function useMediaDrag() {
  const context = useContext(MediaDragContext);

  if (!context) {
    throw new Error('useMediaDrag must be used within MediaDragProvider');
  }

  return context;
}
