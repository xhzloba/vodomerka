import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { delay, isVokinoProxyImage, loadMediaImage, resolveDirectImageUrl } from '@/shared/media/imageLoader';

interface UseMediaImageOptions {
  primaryUrl: string;
  fallbackUrl?: string;
  eager?: boolean;
  rootRef?: RefObject<Element | null>;
}

interface UseMediaImageResult {
  src: string;
  failed: boolean;
  ready: boolean;
  loading: 'lazy' | 'eager';
  onError: () => void;
}

export function useMediaImage({
  primaryUrl,
  fallbackUrl = '',
  eager = false,
  rootRef,
}: UseMediaImageOptions): UseMediaImageResult {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const activeUrlRef = useRef(primaryUrl);
  const retriesRef = useRef(0);
  const usedFallbackRef = useRef(false);

  const loadUrl = useCallback(async (url: string, bustRetry = false) => {
    if (!url) {
      setFailed(true);
      setSrc('');
      setReady(false);
      return;
    }

    activeUrlRef.current = url;

    try {
      const resolved = await loadMediaImage(url);
      if (activeUrlRef.current !== url) {
        return;
      }

      if (bustRetry && !resolved.startsWith('data:') && !resolved.startsWith('blob:')) {
        const separator = resolved.includes('?') ? '&' : '?';
        setSrc(`${resolved}${separator}_r=${retriesRef.current}`);
        return;
      }

      setSrc(resolved);
      setFailed(false);
      setReady(false);
    } catch {
      if (activeUrlRef.current !== url) {
        return;
      }

      if (window.electronAPI?.images?.fetch && isVokinoProxyImage(url)) {
        setSrc(resolveDirectImageUrl(url));
        setFailed(false);
        setReady(false);
        return;
      }

      setFailed(true);
      setSrc('');
      setReady(false);
    }
  }, []);

  useEffect(() => {
    retriesRef.current = 0;
    usedFallbackRef.current = false;
    setFailed(false);
    setSrc('');
    setReady(false);

    if (!primaryUrl) {
      setFailed(true);
      return;
    }

    if (eager) {
      void loadUrl(primaryUrl);
      return;
    }

    const node = rootRef?.current;
    if (!node) {
      void loadUrl(primaryUrl);
      return;
    }

    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (cancelled || !entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        observer.disconnect();
        void loadUrl(primaryUrl);
      },
      { rootMargin: '280px 0px', threshold: 0.01 },
    );

    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [primaryUrl, eager, loadUrl, rootRef]);

  const onError = useCallback(() => {
    const currentUrl = activeUrlRef.current;

    if (retriesRef.current < 2) {
      retriesRef.current += 1;
      void delay(250 * retriesRef.current).then(() => {
        void loadUrl(currentUrl, true);
      });
      return;
    }

    if (fallbackUrl && !usedFallbackRef.current && fallbackUrl !== currentUrl) {
      usedFallbackRef.current = true;
      retriesRef.current = 0;
      void loadUrl(fallbackUrl);
      return;
    }

    setFailed(true);
    setSrc('');
    setReady(false);
  }, [fallbackUrl, loadUrl]);

  useEffect(() => {
    if (!src || failed) {
      setReady(false);
      return;
    }

    let cancelled = false;
    setReady(false);

    const probe = new Image();
    probe.decoding = 'async';
    probe.referrerPolicy = 'no-referrer';
    probe.onload = () => {
      if (!cancelled) {
        setReady(true);
      }
    };
    probe.onerror = () => {
      if (!cancelled) {
        setReady(false);
        onError();
      }
    };
    probe.src = src;

    return () => {
      cancelled = true;
      probe.onload = null;
      probe.onerror = null;
    };
  }, [src, failed, onError]);

  return {
    src,
    failed,
    ready,
    loading: eager ? 'eager' : 'lazy',
    onError,
  };
}
