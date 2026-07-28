import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { delay, loadMediaImage, resolveDirectImageUrl, shouldFetchVokinoImageViaIpc } from '@/shared/media/imageLoader';

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

/** Avoid re-fetch flash: same source URL → same resolved src. */
const resolvedCache = new Map<string, string>();

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
  const srcRef = useRef('');
  const readySrcRef = useRef('');
  const requestIdRef = useRef(0);
  const onErrorRef = useRef<() => void>(() => undefined);

  const applySrc = useCallback((next: string) => {
    if (srcRef.current === next) {
      setFailed(false);
      return;
    }

    srcRef.current = next;
    readySrcRef.current = '';
    setReady(false);
    setSrc(next);
    setFailed(false);
  }, []);

  const loadUrl = useCallback(async (url: string, bustRetry = false, requestId?: number) => {
    if (!url) {
      setFailed(true);
      srcRef.current = '';
      setSrc('');
      setReady(false);
      readySrcRef.current = '';
      return;
    }

    activeUrlRef.current = url;
    const isStale = () => requestId !== undefined && requestId !== requestIdRef.current;

    if (!bustRetry) {
      const cached = resolvedCache.get(url);
      if (cached) {
        if (isStale()) return;
        applySrc(cached);
        return;
      }
    }

    try {
      const resolved = await loadMediaImage(url);
      if (!bustRetry) {
        resolvedCache.set(url, resolved);
      }

      if (isStale() || activeUrlRef.current !== url) {
        return;
      }

      let next = resolved;
      if (bustRetry && !resolved.startsWith('data:') && !resolved.startsWith('blob:')) {
        const separator = resolved.includes('?') ? '&' : '?';
        next = `${resolved}${separator}_r=${retriesRef.current}`;
      }

      applySrc(next);
    } catch {
      if (isStale() || activeUrlRef.current !== url) {
        return;
      }

      if (window.electronAPI?.images?.fetch && shouldFetchVokinoImageViaIpc(url)) {
        const direct = resolveDirectImageUrl(url);
        if (!bustRetry) {
          resolvedCache.set(url, direct);
        }
        applySrc(direct);
        return;
      }

      setFailed(true);
      srcRef.current = '';
      setSrc('');
      setReady(false);
      readySrcRef.current = '';
    }
  }, [applySrc]);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    retriesRef.current = 0;
    usedFallbackRef.current = false;

    if (!primaryUrl) {
      setFailed(true);
      srcRef.current = '';
      setSrc('');
      setReady(false);
      readySrcRef.current = '';
      return;
    }

    setFailed(false);

    // Switch item: drop previous frame only when next isn't cached yet
    const cached = resolvedCache.get(primaryUrl);
    if (cached) {
      applySrc(cached);
    } else if (activeUrlRef.current !== primaryUrl) {
      srcRef.current = '';
      setSrc('');
      setReady(false);
      readySrcRef.current = '';
    }

    activeUrlRef.current = primaryUrl;

    if (eager) {
      void loadUrl(primaryUrl, false, requestId);
      return;
    }

    const node = rootRef?.current;
    if (!node) {
      void loadUrl(primaryUrl, false, requestId);
      return;
    }

    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (cancelled || !entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        observer.disconnect();
        void loadUrl(primaryUrl, false, requestId);
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
    const currentSrc = srcRef.current;
    // IPC data/blob already passed probe — ignore transient <img> abort/remount errors
    if (
      readySrcRef.current === currentSrc &&
      (currentSrc.startsWith('data:') || currentSrc.startsWith('blob:'))
    ) {
      return;
    }

    const currentUrl = activeUrlRef.current;

    if (retriesRef.current < 2) {
      retriesRef.current += 1;
      void delay(250 * retriesRef.current).then(() => {
        void loadUrl(currentUrl, true, requestIdRef.current);
      });
      return;
    }

    if (fallbackUrl && !usedFallbackRef.current && fallbackUrl !== currentUrl) {
      usedFallbackRef.current = true;
      retriesRef.current = 0;
      void loadUrl(fallbackUrl, false, requestIdRef.current);
      return;
    }

    setFailed(true);
    srcRef.current = '';
    setSrc('');
    setReady(false);
    readySrcRef.current = '';
  }, [fallbackUrl, loadUrl]);

  onErrorRef.current = onError;

  useEffect(() => {
    if (!src || failed) {
      setReady(false);
      readySrcRef.current = '';
      return;
    }

    if (readySrcRef.current === src) {
      setReady(true);
      return;
    }

    let cancelled = false;
    const probe = new Image();
    probe.decoding = 'async';
    probe.referrerPolicy = 'no-referrer';
    probe.onload = () => {
      if (cancelled) return;
      readySrcRef.current = src;
      setReady(true);
    };
    probe.onerror = () => {
      if (cancelled) return;
      readySrcRef.current = '';
      setReady(false);
      onErrorRef.current();
    };
    probe.src = src;

    if (probe.complete && probe.naturalWidth > 0) {
      readySrcRef.current = src;
      setReady(true);
    }

    return () => {
      cancelled = true;
      probe.onload = null;
      probe.onerror = null;
    };
  }, [src, failed]);

  return {
    src,
    failed,
    ready,
    loading: eager ? 'eager' : 'lazy',
    onError,
  };
}
