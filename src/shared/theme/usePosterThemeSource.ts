import { useEffect, useId, useRef } from 'react';
import {
  applyPosterThemeVars,
  clearPosterThemeVars,
  extractPosterThemePalette,
} from '@/shared/theme/posterTheme';

/** Who last successfully applied tint — inactive sources must not wipe another's palette. */
let tintOwnerId: string | null = null;

function releaseTint(ownerId: string): void {
  if (tintOwnerId !== ownerId) {
    return;
  }
  tintOwnerId = null;
  clearPosterThemeVars();
}

/**
 * Tint chrome from a backdrop image while enabled (Home Hero / Favorites).
 * Clears only when this owner disables/unmounts — not when a sibling is inactive.
 */
export function usePosterThemeSource(imageSrc: string, enabled: boolean): void {
  const ownerId = useId();
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      releaseTint(ownerId);
      return;
    }

    if (!imageSrc) {
      return;
    }

    const requestId = ++requestIdRef.current;
    let cancelled = false;

    void extractPosterThemePalette(imageSrc).then((palette) => {
      if (cancelled || requestId !== requestIdRef.current || !palette) {
        return;
      }
      tintOwnerId = ownerId;
      applyPosterThemeVars(palette);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, imageSrc, ownerId]);

  useEffect(() => {
    return () => {
      releaseTint(ownerId);
    };
  }, [ownerId]);
}
