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
import { DEFAULT_APP_SETTINGS, type AppSettings } from './types';

interface AppSettingsContextValue {
  settings: AppSettings;
  isLoading: boolean;
  setupWelcomeEpoch: number;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
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
    let cancelled = false;

    void loadAppSettings()
      .then((loaded) => {
        if (!cancelled) {
          applyAppTheme(loaded.theme);
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
    setSettings(next);
  }, []);

  const resetToDefaults = useCallback(async () => {
    const next = await resetAppData();
    applyAppTheme(next.theme);
    setSettings(next);
    setSetupWelcomeEpoch((value) => value + 1);
  }, []);

  const value = useMemo(
    () => ({
      settings,
      isLoading,
      setupWelcomeEpoch,
      updateSettings,
      resetToDefaults,
    }),
    [isLoading, resetToDefaults, settings, setupWelcomeEpoch, updateSettings],
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
