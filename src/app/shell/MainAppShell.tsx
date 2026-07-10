import { useCallback, useEffect, useState } from 'react';
import { useAppNavigation } from '@/app/navigation/useAppNavigation';
import { useAutoTips } from '@/features/onboarding/tips/useAutoTips';
import { appendDismissedTipId } from '@/features/onboarding/tips/dismissTip';
import { TIP_IDS } from '@/features/onboarding/tips/tipDefinitions';
import { SetupWelcomeBanner } from '@/features/onboarding/ui/SetupWelcomeBanner';
import { useSystemUserDisplayName } from '@/features/onboarding/model/useSystemUserDisplayName';
import { BrowseView } from '@/components/BrowseView/BrowseView';
import { HomeView } from '@/components/HomeView/HomeView';
import { LibraryView } from '@/components/LibraryView/LibraryView';
import { WatchedView } from '@/components/WatchedView/WatchedView';
import { MediaDetail } from '@/components/MediaDetail/MediaDetail';
import { SearchView } from '@/components/SearchView/SearchView';
import { SearchOverlay } from '@/components/SearchView/SearchOverlay';
import { SettingsView } from '@/components/SettingsView/SettingsView';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import type { MediaItem } from '@/shared/domain/media';
import { ensureMediaOverridesLoaded } from '@/shared/domain/overridesStore';
import { openMediaDetailWindow } from '@/shared/platform/mediaDetailWindow';
import { isMacOS } from '@/shared/platform/runtime';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import { PageLoading } from '@/shared/ui/PageState';
import { useToast } from '@/shared/ui/Toast/ToastContext';

const SETUP_WELCOME_SHOW_DELAY_MS = 5_000;

export function MainAppShell() {
  const { settings, isLoading, setupWelcomeEpoch, updateSettings } = useAppSettings();
  const { showToast } = useToast();
  const { activeNav, searchQuery, setSearchQuery, navigate } = useAppNavigation();
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isOpeningDetail, setIsOpeningDetail] = useState(false);
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const [setupWelcomeVisible, setSetupWelcomeVisible] = useState(false);

  const setupWelcomeEligible = !isLoading && !settings.setupWelcomeDismissed;
  const systemUserDisplayName = useSystemUserDisplayName();

  const sidebarCollapsed = settings.sidebarCollapsed;
  const macSidebarChrome = isMacOS();

  const handlePlay = useCallback(
    (item: MediaItem) => {
      showToast(item.title, { kind: 'play', title: 'Воспроизведение' });
    },
    [showToast],
  );

  const handleMediaSelect = useCallback(
    (item: MediaItem) => {
      if (!window.electronAPI?.detail.open) {
        setSelectedMedia(item);
        return;
      }

      setIsOpeningDetail(true);
      void openMediaDetailWindow(item)
        .catch(() => {
          showToast('Не удалось открыть карточку', { kind: 'error', title: 'Ошибка' });
        })
        .finally(() => {
          setIsOpeningDetail(false);
        });
    },
    [showToast],
  );

  const toggleSidebar = useCallback(
    (source: 'keyboard' | 'menu' = 'menu') => {
      const nextCollapsed = !settings.sidebarCollapsed;
      const patch: Parameters<typeof updateSettings>[0] = {
        sidebarCollapsed: nextCollapsed,
      };

      if (source === 'keyboard' && nextCollapsed) {
        patch.dismissedTipIds = appendDismissedTipId(
          settings.dismissedTipIds,
          TIP_IDS.sidebarCollapseShortcut,
        );
      }

      void updateSettings(patch);
    },
    [settings.dismissedTipIds, settings.sidebarCollapsed, updateSettings],
  );

  const dismissSetupWelcome = useCallback(() => {
    void updateSettings({ setupWelcomeDismissed: true });
  }, [updateSettings]);

  const openSetupWelcomeSettings = useCallback(() => {
    navigate('settings');
    void updateSettings({ setupWelcomeDismissed: true });
  }, [navigate, updateSettings]);

  const closeSearchOverlay = useCallback(() => {
    setSearchOverlayOpen(false);
    setSearchQuery('');
  }, [setSearchQuery]);

  const toggleSearchOverlay = useCallback(
    (source: 'keyboard' | 'menu' = 'menu') => {
      setSearchOverlayOpen((wasOpen) => {
        const nextOpen = !wasOpen;

        if (!nextOpen) {
          setSearchQuery('');
          return false;
        }

        if (source === 'keyboard') {
          void updateSettings({
            dismissedTipIds: appendDismissedTipId(
              settings.dismissedTipIds,
              TIP_IDS.searchShortcut,
            ),
          });
        }

        return true;
      });
    },
    [settings.dismissedTipIds, setSearchQuery, updateSettings],
  );

  const showSetupWelcome = setupWelcomeVisible;

  useEffect(() => {
    if (!setupWelcomeEligible) {
      setSetupWelcomeVisible(false);
      return;
    }

    setSetupWelcomeVisible(false);

    const timeoutId = window.setTimeout(() => {
      setSetupWelcomeVisible(true);
    }, SETUP_WELCOME_SHOW_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [setupWelcomeEligible, setupWelcomeEpoch]);

  useAutoTips({
    paused: setupWelcomeEligible || isOpeningDetail || selectedMedia !== null || searchOverlayOpen,
  });

  useEffect(() => {
    void ensureMediaOverridesLoaded();
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.sidebar.onToggle(() => {
      toggleSidebar('keyboard');
    });
    return () => unsubscribe?.();
  }, [toggleSidebar]);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.search.onToggle(() => {
      toggleSearchOverlay('keyboard');
    });
    return () => unsubscribe?.();
  }, [toggleSearchOverlay]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'k') {
        if (window.electronAPI?.search) {
          return;
        }

        event.preventDefault();
        toggleSearchOverlay('keyboard');
        return;
      }

      if (key !== 'b' || window.electronAPI?.sidebar) {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')) {
        return;
      }

      event.preventDefault();
      toggleSidebar('keyboard');
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleSearchOverlay, toggleSidebar]);

  useEffect(() => {
    if (!macSidebarChrome) {
      return;
    }

    void window.electronAPI?.windowChrome.setSidebarCollapsed(sidebarCollapsed);
  }, [macSidebarChrome, sidebarCollapsed]);

  const renderView = () => {
    switch (activeNav) {
      case 'home':
        return <HomeView onMediaSelect={handleMediaSelect} onPlay={handlePlay} />;
      case 'browse':
        return <BrowseView onMediaSelect={handleMediaSelect} />;
      case 'library':
        return <LibraryView onMediaSelect={handleMediaSelect} />;
      case 'watched':
        return <WatchedView onMediaSelect={handleMediaSelect} />;
      case 'search':
        return (
          <SearchView
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onMediaSelect={handleMediaSelect}
          />
        );
      case 'settings':
        return <SettingsView />;
    }
  };

  return (
    <div
      className={`app-shell${sidebarCollapsed ? ' app-shell--sidebar-collapsed' : ''}${
        macSidebarChrome ? ' app-shell--mac-sidebar-chrome' : ''
      }`}
    >
      <div className="titlebar" aria-hidden="true" />
      <div className="app-shell__body">
        <Sidebar
          activeNav={activeNav}
          collapsed={sidebarCollapsed}
          menuAnimation={settings.sidebarMenuAnimation}
          macSidebarChrome={macSidebarChrome}
          onNavChange={navigate}
        />
        <main className="app__main">{renderView()}</main>
      </div>

      {showSetupWelcome ? (
        <SetupWelcomeBanner
          displayName={systemUserDisplayName}
          onOpenSettings={openSetupWelcomeSettings}
          onDismiss={dismissSetupWelcome}
        />
      ) : null}

      {selectedMedia && (
        <MediaDetail
          item={selectedMedia}
          onClose={() => setSelectedMedia(null)}
          onPlay={handlePlay}
        />
      )}

      {isOpeningDetail ? (
        <div className="detail-open-overlay" aria-busy="true" aria-label="Открытие карточки">
          <PageLoading centered />
        </div>
      ) : null}

      <SearchOverlay
        open={searchOverlayOpen}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onMediaSelect={handleMediaSelect}
        onClose={closeSearchOverlay}
      />
    </div>
  );
}
