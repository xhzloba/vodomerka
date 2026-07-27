import { AppProviders } from '@/app/providers/AppProviders';
import { DetailWindowShell } from '@/app/shell/DetailWindowShell';
import { MainAppShell } from '@/app/shell/MainAppShell';
import { PlayerWindowShell } from '@/app/shell/PlayerWindowShell';
import { AppTopProgressProvider } from '@/shared/ui/AppTopProgress/AppTopProgressContext';
import { DynamicIsland } from '@/shared/ui/DynamicIsland/DynamicIsland';
import { getDetailWindowMediaId } from '@/shared/platform/mediaDetailWindow';
import { isPlayerWindow } from '@/shared/platform/mediaPlayerWindow';
import '@/App.css';

function AppShell() {
  if (isPlayerWindow()) {
    return <PlayerWindowShell />;
  }

  const detailMediaId = getDetailWindowMediaId();
  return detailMediaId ? <DetailWindowShell mediaId={detailMediaId} /> : <MainAppShell />;
}

export function App() {
  const isAuxWindow = isPlayerWindow() || getDetailWindowMediaId() !== null;

  return (
    <AppProviders>
      <AppTopProgressProvider>
        {isAuxWindow ? null : <DynamicIsland />}
        <AppShell />
      </AppTopProgressProvider>
    </AppProviders>
  );
}
