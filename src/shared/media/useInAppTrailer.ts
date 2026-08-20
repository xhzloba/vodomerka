import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { fetchMediaById } from '@/shared/api/vokino/media';
import { createInAppHlsPlayer, toPlayableHlsUrl } from '@/shared/media/createInAppHlsPlayer';

async function startVideoWithAutoplayFallback(video: HTMLVideoElement): Promise<boolean> {
  video.muted = false;
  video.volume = 1;
  try {
    await video.play();
    return true;
  } catch {
    // Autoplay with sound may be blocked — retry muted, then unmute.
  }

  try {
    video.muted = true;
    await video.play();
    video.muted = false;
    video.volume = 1;
    return true;
  } catch {
    return false;
  }
}

export function useInAppTrailer(mediaId: string, sourceTrailerUrl?: string | null) {
  const trailerVideoRef = useRef<HTMLVideoElement>(null);
  const trailerHlsRef = useRef<Hls | null>(null);
  const trailerCacheRef = useRef<Map<string, string | null>>(new Map());
  const playableTrailerCacheRef = useRef<Map<string, string | null>>(new Map());

  const [trailerUrls, setTrailerUrls] = useState<Record<string, string | null>>({});
  const [playableTrailerUrls, setPlayableTrailerUrls] = useState<Record<string, string | null>>({});
  const [isArmed, setIsArmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const cachedTrailerUrl = trailerUrls[mediaId];
  const trailerUrl = sourceTrailerUrl ?? cachedTrailerUrl ?? null;
  const playableTrailerUrl = playableTrailerUrls[mediaId] ?? null;

  useEffect(() => {
    setIsArmed(false);
    setIsLoading(false);
    trailerVideoRef.current?.pause();
    trailerHlsRef.current?.destroy();
    trailerHlsRef.current = null;
  }, [mediaId]);

  useEffect(() => {
    if (sourceTrailerUrl) {
      trailerCacheRef.current.set(mediaId, sourceTrailerUrl);
      setTrailerUrls((current) =>
        current[mediaId] === sourceTrailerUrl
          ? current
          : { ...current, [mediaId]: sourceTrailerUrl },
      );
      return;
    }

    if (trailerCacheRef.current.has(mediaId)) {
      const cached = trailerCacheRef.current.get(mediaId) ?? null;
      setTrailerUrls((current) =>
        current[mediaId] === cached ? current : { ...current, [mediaId]: cached },
      );
      return;
    }

    let cancelled = false;
    void fetchMediaById(mediaId)
      .then((resolved) => {
        if (cancelled) {
          return;
        }
        const nextUrl = resolved?.trailerUrl ?? null;
        trailerCacheRef.current.set(mediaId, nextUrl);
        setTrailerUrls((current) => ({ ...current, [mediaId]: nextUrl }));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        trailerCacheRef.current.set(mediaId, null);
        setTrailerUrls((current) => ({ ...current, [mediaId]: null }));
      });

    return () => {
      cancelled = true;
    };
  }, [mediaId, sourceTrailerUrl]);

  useEffect(() => {
    if (!trailerUrl) {
      setPlayableTrailerUrls((current) =>
        current[mediaId] == null ? current : { ...current, [mediaId]: null },
      );
      return;
    }

    if (playableTrailerCacheRef.current.has(mediaId)) {
      const cached = playableTrailerCacheRef.current.get(mediaId) ?? null;
      setPlayableTrailerUrls((current) =>
        current[mediaId] === cached ? current : { ...current, [mediaId]: cached },
      );
      return;
    }

    let cancelled = false;
    void toPlayableHlsUrl(trailerUrl)
      .then((proxiedUrl) => {
        if (cancelled) {
          return;
        }
        playableTrailerCacheRef.current.set(mediaId, proxiedUrl);
        setPlayableTrailerUrls((current) => ({ ...current, [mediaId]: proxiedUrl }));
        void fetch(proxiedUrl, { method: 'GET', mode: 'cors' }).catch(() => undefined);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        playableTrailerCacheRef.current.set(mediaId, trailerUrl);
        setPlayableTrailerUrls((current) => ({ ...current, [mediaId]: trailerUrl }));
      });

    return () => {
      cancelled = true;
    };
  }, [mediaId, trailerUrl]);

  useLayoutEffect(() => {
    if (!isArmed || !playableTrailerUrl) {
      return;
    }

    let cancelled = false;
    let rafId = 0;
    let retryTimer = 0;
    let networkRetries = 0;
    let hls: Hls | null = null;

    const cleanupHls = () => {
      if (hls) {
        hls.destroy();
        if (trailerHlsRef.current === hls) {
          trailerHlsRef.current = null;
        }
        hls = null;
      }
    };

    const startOnVideo = (video: HTMLVideoElement) => {
      if (cancelled) {
        return;
      }

      trailerHlsRef.current?.destroy();
      trailerHlsRef.current = null;

      if (!Hls.isSupported()) {
        setIsLoading(false);
        setIsArmed(false);
        return;
      }

      video.pause();
      video.muted = false;
      video.volume = 1;

      hls = createInAppHlsPlayer();
      trailerHlsRef.current = hls;
      hls.loadSource(playableTrailerUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (cancelled) {
          return;
        }
        void startVideoWithAutoplayFallback(video).then((ok) => {
          if (!ok && !cancelled) {
            setIsLoading(false);
            setIsArmed(false);
          }
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (cancelled || !data.fatal || !hls) {
          return;
        }

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 4) {
          networkRetries += 1;
          window.clearTimeout(retryTimer);
          retryTimer = window.setTimeout(() => {
            if (cancelled || !hls) {
              return;
            }
            try {
              hls.startLoad();
            } catch {
              try {
                hls.loadSource(playableTrailerUrl);
              } catch {
                // next error handles give-up
              }
            }
          }, 280 * networkRetries);
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          try {
            hls.recoverMediaError();
            return;
          } catch {
            // fallthrough
          }
        }

        setIsLoading(false);
        setIsArmed(false);
        cleanupHls();
      });
    };

    const tryStart = () => {
      const video = trailerVideoRef.current;
      if (!video) {
        rafId = window.requestAnimationFrame(tryStart);
        return;
      }
      startOnVideo(video);
    };

    tryStart();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(retryTimer);
      cleanupHls();
    };
  }, [isArmed, mediaId, playableTrailerUrl]);

  const stopTrailer = useCallback(() => {
    setIsArmed(false);
    setIsLoading(false);
  }, []);

  const toggleTrailer = useCallback(() => {
    setIsArmed((current) => {
      const next = !current;
      if (next) {
        setIsLoading(true);
      } else {
        setIsLoading(false);
      }
      return next;
    });
  }, []);

  return {
    trailerUrl,
    playableTrailerUrl,
    isTrailerArmed: isArmed,
    isTrailerLoading: isLoading,
    showTrailerButton: Boolean(trailerUrl),
    trailerVideoRef,
    toggleTrailer,
    stopTrailer,
    setTrailerLoading: setIsLoading,
  };
}
