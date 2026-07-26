import type { PropsWithChildren } from 'react';
import { FavoritesProvider } from '@/shared/domain/FavoritesContext';
import { MediaDragProvider } from '@/shared/domain/MediaDragContext';
import { RecentlyViewedProvider } from '@/shared/domain/RecentlyViewedContext';
import { TorrentsProvider } from '@/shared/domain/TorrentsContext';
import { WatchedProvider } from '@/shared/domain/WatchedContext';
import { AppSettingsProvider } from '@/shared/settings/AppSettingsContext';
import { ToastProvider } from '@/shared/ui/Toast/ToastContext';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AppSettingsProvider>
      <FavoritesProvider>
        <WatchedProvider>
          <RecentlyViewedProvider>
            <TorrentsProvider>
              <ToastProvider>
                <MediaDragProvider>{children}</MediaDragProvider>
              </ToastProvider>
            </TorrentsProvider>
          </RecentlyViewedProvider>
        </WatchedProvider>
      </FavoritesProvider>
    </AppSettingsProvider>
  );
}
