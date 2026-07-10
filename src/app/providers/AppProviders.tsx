import type { PropsWithChildren } from 'react';
import { FavoritesProvider } from '@/shared/domain/FavoritesContext';
import { RecentlyViewedProvider } from '@/shared/domain/RecentlyViewedContext';
import { WatchedProvider } from '@/shared/domain/WatchedContext';
import { AppSettingsProvider } from '@/shared/settings/AppSettingsContext';
import { ToastProvider } from '@/shared/ui/Toast/ToastContext';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AppSettingsProvider>
      <FavoritesProvider>
        <WatchedProvider>
          <RecentlyViewedProvider>
            <ToastProvider>{children}</ToastProvider>
          </RecentlyViewedProvider>
        </WatchedProvider>
      </FavoritesProvider>
    </AppSettingsProvider>
  );
}
