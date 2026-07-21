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

export const MEDIA_DRAG_MIME = 'application/x-tv-leonid-media';

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
}

const MediaDragContext = createContext<MediaDragContextValue | null>(null);

const SCALE_FAR = 1;
const SCALE_NEAR = 0.28;
const DIST_FAR = 460;
const DIST_NEAR = 36;
const EXIT_ABSORB_MS = 220;
const EXIT_RETURN_MS = 170;

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
  node: HTMLDivElement,
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
) {
  node.style.transform = `translate3d(${x - width / 2}px, ${y - height / 2}px, 0) scale(${scale})`;
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

  // transform/opacity только императивно — иначе React style сбрасывает exit-анимацию
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) {
      return;
    }
    node.style.width = `${width}px`;
    node.style.height = `${height}px`;
    if (!node.dataset.exiting) {
      applyPreviewTransform(node, origin.x, origin.y, width, height, scaleForDistance(origin.x, origin.y));
      node.style.opacity = '1';
      node.style.filter = '';
      node.style.transition = 'none';
    }
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
  const exitingRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current != null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const hardClear = useCallback(() => {
    clearExitTimer();
    exitingRef.current = false;
    const node = previewRef.current;
    if (node) {
      delete node.dataset.exiting;
      node.classList.remove('media-drag-preview--absorb', 'media-drag-preview--return');
    }
    setDraggingItem(null);
    setPreviewItem(null);
    setPreview(null);
    setOrigin(null);
    setDropTarget(null);
    homeRef.current = null;
    lastPointerRef.current = null;
    document.body.classList.remove('is-media-dragging');
  }, [clearExitTimer]);

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
      sizeRef.current = {
        width: Math.max(48, resolvedPreview.width),
        height: Math.max(72, resolvedPreview.height),
      };
      homeRef.current =
        home ??
        (nextOrigin
          ? {
              x: nextOrigin.x - sizeRef.current.width / 2,
              y: nextOrigin.y - sizeRef.current.height / 2,
              width: sizeRef.current.width,
              height: sizeRef.current.height,
            }
          : null);
      lastPointerRef.current = nextOrigin ?? null;

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

      const node = previewRef.current;
      const { width, height } = sizeRef.current;
      const pointer = lastPointerRef.current ?? origin;
      const home = homeRef.current;

      if (!previewItem) {
        hardClear();
        return;
      }

      exitingRef.current = true;
      setDraggingItem(null);
      setDropTarget(null);
      document.body.classList.remove('is-media-dragging');

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion || !node || !pointer) {
        hardClear();
        return;
      }

      node.dataset.exiting = '1';

      if (mode === 'absorb') {
        // один кадр фиксации текущей позиции, затем в island
        node.style.transition = 'none';
        applyPreviewTransform(node, pointer.x, pointer.y, width, height, scaleForDistance(pointer.x, pointer.y));
        node.style.opacity = '1';
        node.style.filter = '';
        void node.offsetWidth;

        const island = islandAnchor();
        node.classList.add('media-drag-preview--absorb');
        node.style.transition =
          'transform 200ms cubic-bezier(0.32, 0.72, 0, 1), opacity 140ms ease, filter 140ms ease, border-radius 200ms ease';
        applyPreviewTransform(node, island.x, island.y, width, height, 0.06);
        node.style.opacity = '0';
        node.style.filter = 'blur(8px)';
        node.style.borderRadius = '999px';
      } else {
        // сразу летим домой без лишнего reflow-кадра — быстрее на отпускании
        const targetX = (home?.x ?? pointer.x - width / 2) + width / 2;
        const targetY = (home?.y ?? pointer.y - height / 2) + height / 2;
        node.classList.add('media-drag-preview--return');
        node.style.transition =
          'transform 160ms cubic-bezier(0.22, 1, 0.36, 1), opacity 110ms ease, box-shadow 140ms ease';
        applyPreviewTransform(node, targetX, targetY, width, height, 1);
        node.style.opacity = '0';
        node.style.filter = '';
        node.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.25)';
      }

      const exitMs = mode === 'absorb' ? EXIT_ABSORB_MS : EXIT_RETURN_MS;
      let finished = false;
      const finish = () => {
        if (finished) {
          return;
        }
        finished = true;
        node.removeEventListener('transitionend', onTransitionEnd);
        hardClear();
      };

      const onTransitionEnd = (event: TransitionEvent) => {
        if (event.target !== node) {
          return;
        }
        if (event.propertyName !== 'transform' && event.propertyName !== 'opacity') {
          return;
        }
        finish();
      };

      clearExitTimer();
      exitTimerRef.current = window.setTimeout(finish, exitMs);
      node.addEventListener('transitionend', onTransitionEnd);
    },
    [clearExitTimer, hardClear, origin, previewItem],
  );

  useEffect(() => {
    if (!draggingItem) {
      return;
    }

    const movePreview = (clientX: number, clientY: number) => {
      if (exitingRef.current) {
        return;
      }
      const node = previewRef.current;
      if (!node) {
        return;
      }
      lastPointerRef.current = { x: clientX, y: clientY };
      const { width, height } = sizeRef.current;
      applyPreviewTransform(node, clientX, clientY, width, height, scaleForDistance(clientX, clientY));
    };

    const onDragOver = (event: DragEvent) => {
      movePreview(event.clientX, event.clientY);
    };

    const onDrag = (event: DragEvent) => {
      if (event.clientX === 0 && event.clientY === 0) {
        return;
      }
      movePreview(event.clientX, event.clientY);
    };

    // Сразу на dragend (capture), без setTimeout — иначе кадр зависания
    const onDragEndCapture = () => {
      if (!exitingRef.current) {
        endMediaDrag('return');
      }
    };

    window.addEventListener('dragover', onDragOver, true);
    window.addEventListener('drag', onDrag, true);
    window.addEventListener('dragend', onDragEndCapture, true);

    return () => {
      window.removeEventListener('dragover', onDragOver, true);
      window.removeEventListener('drag', onDrag, true);
      window.removeEventListener('dragend', onDragEndCapture, true);
    };
  }, [draggingItem, endMediaDrag]);

  useEffect(() => () => clearExitTimer(), [clearExitTimer]);

  const value = useMemo(
    () => ({
      draggingItem,
      dropTarget,
      beginMediaDrag,
      endMediaDrag,
      setDropTarget,
    }),
    [beginMediaDrag, draggingItem, dropTarget, endMediaDrag],
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

export function writeMediaDragData(dataTransfer: DataTransfer, item: MediaItem) {
  dataTransfer.effectAllowed = 'copyMove';
  dataTransfer.setData(MEDIA_DRAG_MIME, item.id);
  dataTransfer.setData('text/plain', item.id);
}

/** Прячет нативный ghost — рисуем свой превью. */
export function hideNativeDragImage(dataTransfer: DataTransfer) {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  canvas.style.position = 'fixed';
  canvas.style.top = '-1000px';
  canvas.style.left = '-1000px';
  document.body.appendChild(canvas);
  dataTransfer.setDragImage(canvas, 0, 0);
  window.setTimeout(() => {
    canvas.remove();
  }, 0);
}
