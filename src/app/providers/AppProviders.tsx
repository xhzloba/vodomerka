import type { PropsWithChildren } from 'react';
import { ContinueWatchingProvider } from '@/shared/domain/ContinueWatchingContext';
import { FavoritesProvider } from '@/shared/domain/FavoritesContext';
import { MediaDragProvider } from '@/shared/domain/MediaDragContext';
import { PlayerProvider } from '@/shared/domain/PlayerContext';
import { RecentlyViewedProvider } from '@/shared/domain/RecentlyViewedContext';
import { TorrentsProvider } from '@/shared/domain/TorrentsContext';
import { WatchedProvider } from '@/shared/domain/WatchedContext';
import { AppSettingsProvider } from '@/shared/settings/AppSettingsContext';
import { ToastProvider } from '@/shared/ui/Toast/ToastContext';
import { NativePlayer } from '@/components/NativePlayer/NativePlayer';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AppSettingsProvider>
      <FavoritesProvider>
        <WatchedProvider>
          <RecentlyViewedProvider>
            <ContinueWatchingProvider>
              <TorrentsProvider>
                <PlayerProvider>
                  <ToastProvider>
                    <MediaDragProvider>
                      {children}
                      <NativePlayer />
                    </MediaDragProvider>
                  </ToastProvider>
                </PlayerProvider>
              </TorrentsProvider>
            </ContinueWatchingProvider>
          </RecentlyViewedProvider>
        </WatchedProvider>
      </FavoritesProvider>
    </AppSettingsProvider>
  );
}
