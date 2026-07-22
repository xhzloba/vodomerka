import { useEffect, type RefObject } from 'react';

const DRAG_THRESHOLD_PX = 5;
const CLICK_SUPPRESS_MS = 80;

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest('button, a, input, textarea, select, [data-no-drag-scroll]'));
}

export function useHorizontalDragScroll<T extends HTMLElement>(
  ref: RefObject<T | null>,
  enabled = true,
) {
  useEffect(() => {
    const element = ref.current;

    if (!element || !enabled) {
      return;
    }

    let activePointerId: number | null = null;
    let startX = 0;
    let startScrollLeft = 0;
    let isDragging = false;
    let suppressClickUntil = 0;

    const stopDragging = () => {
      if (isDragging) {
        element.classList.remove('content-row__scroll--dragging');
        isDragging = false;
      }

      activePointerId = null;
    };

    const detachWindowListeners = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) {
        return;
      }

      // Island drag stole the gesture (e.g. upward pull from a slider card).
      if (document.body.classList.contains('is-media-dragging')) {
        if (element.hasPointerCapture(event.pointerId)) {
          try {
            element.releasePointerCapture(event.pointerId);
          } catch {
            // ignore
          }
        }
        detachWindowListeners();
        stopDragging();
        return;
      }

      const deltaX = event.clientX - startX;

      if (!isDragging) {
        if (Math.abs(deltaX) < DRAG_THRESHOLD_PX) {
          return;
        }

        isDragging = true;
        element.classList.add('content-row__scroll--dragging');
        try {
          element.setPointerCapture(event.pointerId);
        } catch {
          // ignore
        }
      }

      event.preventDefault();
      element.scrollLeft = startScrollLeft - deltaX;
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

      stopDragging();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType === 'touch') {
        return;
      }

      if (isInteractiveTarget(event.target)) {
        return;
      }

      if (element.scrollWidth <= element.clientWidth + 1) {
        return;
      }

      activePointerId = event.pointerId;
      startX = event.clientX;
      startScrollLeft = element.scrollLeft;
      isDragging = false;

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

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('click', onClickCapture, true);

    return () => {
      detachWindowListeners();
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('click', onClickCapture, true);
      element.classList.remove('content-row__scroll--dragging');
    };
  }, [enabled, ref]);
}
