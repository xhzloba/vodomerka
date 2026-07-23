import { useEffect, type RefObject } from 'react';

const DRAG_ARM_PX = 6;
const DRAG_COMMIT_PX = 56;
const WHEEL_COMMIT_PX = 48;
const CLICK_SUPPRESS_MS = 100;
const WHEEL_COOLDOWN_MS = 320;

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest('button, a, input, textarea, select, [data-no-hero-swipe]'));
}

interface UseHeroManualSwipeOptions {
  enabled: boolean;
  onSwipe: (direction: 1 | -1) => void;
}

/**
 * Manual hero paging when auto-slide is off:
 * — left-button drag (mouse / trackpad click-drag)
 * — horizontal two-finger trackpad wheel
 */
export function useHeroManualSwipe<T extends HTMLElement>(
  ref: RefObject<T | null>,
  { enabled, onSwipe }: UseHeroManualSwipeOptions,
) {
  useEffect(() => {
    const element = ref.current;

    if (!element || !enabled) {
      return;
    }

    let activePointerId: number | null = null;
    let startX = 0;
    let isDragging = false;
    let didCommitDrag = false;
    let suppressClickUntil = 0;
    let wheelAcc = 0;
    let lastWheelCommitAt = 0;

    const setDraggingClass = (dragging: boolean) => {
      element.classList.toggle('hero--dragging', dragging);
    };

    const commit = (direction: 1 | -1) => {
      onSwipe(direction);
    };

    const detachWindowListeners = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    const stopPointer = () => {
      if (isDragging) {
        setDraggingClass(false);
      }

      activePointerId = null;
      isDragging = false;
      didCommitDrag = false;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) {
        return;
      }

      if (document.body.classList.contains('is-media-dragging')) {
        if (element.hasPointerCapture(event.pointerId)) {
          try {
            element.releasePointerCapture(event.pointerId);
          } catch {
            // ignore
          }
        }
        detachWindowListeners();
        stopPointer();
        return;
      }

      const deltaX = event.clientX - startX;

      if (!isDragging) {
        if (Math.abs(deltaX) < DRAG_ARM_PX) {
          return;
        }

        isDragging = true;
        setDraggingClass(true);
        try {
          element.setPointerCapture(event.pointerId);
        } catch {
          // ignore
        }
      }

      event.preventDefault();

      if (!didCommitDrag && Math.abs(deltaX) >= DRAG_COMMIT_PX) {
        didCommitDrag = true;
        // Drag left → next, drag right → previous (carousel feel)
        commit(deltaX < 0 ? 1 : -1);
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) {
        return;
      }

      detachWindowListeners();

      if (isDragging) {
        suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS;
        event.preventDefault();
      }

      if (element.hasPointerCapture(event.pointerId)) {
        try {
          element.releasePointerCapture(event.pointerId);
        } catch {
          // ignore
        }
      }

      stopPointer();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      if (isInteractiveTarget(event.target)) {
        return;
      }

      activePointerId = event.pointerId;
      startX = event.clientX;
      isDragging = false;
      didCommitDrag = false;

      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    };

    const onClickCapture = (event: MouseEvent) => {
      if (Date.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
        return;
      }

      event.preventDefault();

      const now = Date.now();
      if (now - lastWheelCommitAt < WHEEL_COOLDOWN_MS) {
        wheelAcc = 0;
        return;
      }

      wheelAcc += event.deltaX;

      if (Math.abs(wheelAcc) < WHEEL_COMMIT_PX) {
        return;
      }

      commit(wheelAcc > 0 ? 1 : -1);
      wheelAcc = 0;
      lastWheelCommitAt = now;
    };

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('click', onClickCapture, true);
    element.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      detachWindowListeners();
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('click', onClickCapture, true);
      element.removeEventListener('wheel', onWheel);
      setDraggingClass(false);
    };
  }, [enabled, onSwipe, ref]);
}
