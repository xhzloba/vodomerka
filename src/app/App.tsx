import { AppProviders } from '@/app/providers/AppProviders';
import { DetailWindowShell } from '@/app/shell/DetailWindowShell';
import { MainAppShell } from '@/app/shell/MainAppShell';
import { getDetailWindowMediaId } from '@/shared/platform/mediaDetailWindow';
import '@/App.css';

function AppShell() {
  const detailMediaId = getDetailWindowMediaId();
  return detailMediaId ? <DetailWindowShell mediaId={detailMediaId} /> : <MainAppShell />;
}

export function App() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
}
