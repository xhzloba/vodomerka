import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { loadAppSettings, resetAppData, saveAppSettings } from './storage';
import { setUiSoundsEnabled } from '@/shared/audio/uiSounds';
import { applyAppTheme } from './themes';
import { applyPosterSizeCssVars, DEFAULT_APP_SETTINGS, type AppSettings } from './types';

interface AppSettingsContextValue {
  settings: AppSettings;
  isLoading: boolean;
  setupWelcomeEpoch: number;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  reloadSettings: () => Promise<AppSettings>;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [setupWelcomeEpoch, setSetupWelcomeEpoch] = useState(0);

  useEffect(() => {
    setUiSoundsEnabled(settings.uiSoundsEnabled);
  }, [settings.uiSoundsEnabled]);

  useEffect(() => {
    applyPosterSizeCssVars(settings.posterSize);
  }, [settings.posterSize]);

  useEffect(() => {
    let cancelled = false;

    void loadAppSettings()
      .then((loaded) => {
        if (!cancelled) {
          applyAppTheme(loaded.theme);
          applyPosterSizeCssVars(loaded.posterSize);
          setSettings(loaded);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = await saveAppSettings(patch);
    if (patch.theme) {
      applyAppTheme(next.theme);
    }
    if (patch.posterSize !== undefined) {
      applyPosterSizeCssVars(next.posterSize);
    }
    setSettings(next);
  }, []);

  const resetToDefaults = useCallback(async () => {
    const next = await resetAppData();
    applyAppTheme(next.theme);
    applyPosterSizeCssVars(next.posterSize);
    setSettings(next);
    setSetupWelcomeEpoch((value) => value + 1);
  }, []);

  const reloadSettings = useCallback(async () => {
    const next = await loadAppSettings();
    applyAppTheme(next.theme);
    applyPosterSizeCssVars(next.posterSize);
    setSettings(next);
    return next;
  }, []);

  const value = useMemo(
    () => ({
      settings,
      isLoading,
      setupWelcomeEpoch,
      updateSettings,
      resetToDefaults,
      reloadSettings,
    }),
    [isLoading, reloadSettings, resetToDefaults, settings, setupWelcomeEpoch, updateSettings],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);

  if (!context) {
    throw new Error('useAppSettings must be used within AppSettingsProvider');
  }

  return context;
}
