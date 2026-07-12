import { useEffect, useRef } from 'react';
import type { AppSettings } from '@/shared/settings/types';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import { playWelcomeSound } from '@/shared/audio/uiSounds';
import { useToast } from '@/shared/ui/Toast/ToastContext';
import { appendDismissedTipId } from './dismissTip';
import { APP_TIPS, buildAppTipContext, type AppTipDefinition } from './tipDefinitions';

function isTipEligible(tip: AppTipDefinition, settings: AppSettings, now: number): boolean {
  if (settings.dismissedTipIds.includes(tip.id)) {
    return false;
  }

  if (tip.isEligible && !tip.isEligible(settings)) {
    return false;
  }

  const lastShown = settings.tipShownAt[tip.id];

  if (lastShown === undefined) {
    return true;
  }

  if (tip.repeatIntervalMs <= 0) {
    return false;
  }

  return now - lastShown >= tip.repeatIntervalMs;
}

function getTipDelayMs(tip: AppTipDefinition, settings: AppSettings, now: number): number {
  const lastShown = settings.tipShownAt[tip.id];

  if (lastShown === undefined) {
    return tip.initialDelayMs;
  }

  return Math.max(0, tip.repeatIntervalMs - (now - lastShown));
}

function pickNextTip(settings: AppSettings, now: number): AppTipDefinition | null {
  for (const tip of APP_TIPS) {
    if (isTipEligible(tip, settings, now)) {
      return tip;
    }
  }

  return null;
}

export function useAutoTips(options: { paused: boolean }) {
  const { settings, isLoading, updateSettings } = useAppSettings();
  const { showToast } = useToast();
  const settingsRef = useRef(settings);

  settingsRef.current = settings;

  useEffect(() => {
    if (isLoading || options.paused || !settings.autoTipsEnabled) {
      return;
    }

    const now = Date.now();
    const tip = pickNextTip(settings, now);

    if (!tip) {
      return;
    }

    const delayMs = getTipDelayMs(tip, settings, now);
    const context = buildAppTipContext();

    const timeoutId = window.setTimeout(() => {
      const currentSettings = settingsRef.current;

      if (!currentSettings.autoTipsEnabled || options.paused) {
        return;
      }

      if (!isTipEligible(tip, currentSettings, Date.now())) {
        return;
      }

      playWelcomeSound();

      showToast(tip.buildMessage(context), {
        kind: 'tip',
        title: tip.title,
        duration: tip.duration,
        dismissible: true,
        onDismiss: () => {
          const latestSettings = settingsRef.current;

          if (latestSettings.dismissedTipIds.includes(tip.id)) {
            return;
          }

          void updateSettings({
            dismissedTipIds: appendDismissedTipId(latestSettings.dismissedTipIds, tip.id),
          });
        },
      });

      void updateSettings({
        tipShownAt: {
          ...currentSettings.tipShownAt,
          [tip.id]: Date.now(),
        },
      });
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    isLoading,
    options.paused,
    settings.autoTipsEnabled,
    settings.dismissedTipIds,
    settings.sidebarCollapsed,
    settings.tipShownAt,
    showToast,
    updateSettings,
  ]);
}
