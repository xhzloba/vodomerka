import { useEffect, useRef } from 'react';

export function useOverlayScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let timeoutId = 0;
    let frameId = 0;
    let scrolling = false;

    const onScroll = () => {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;

        if (!scrolling) {
          scrolling = true;
          element.classList.add('is-scrolling');
        }

        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          scrolling = false;
          element.classList.remove('is-scrolling');
        }, 900);
      });
    };

    element.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      element.removeEventListener('scroll', onScroll);
      window.clearTimeout(timeoutId);
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      element.classList.remove('is-scrolling');
    };
  }, []);

  return ref;
}
