import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export const APP_NAME = 'Vodomerka';

export function getAppVersion(): string {
  try {
    const packagePath = path.join(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { version?: string };
    return pkg.version ?? '1.0.0';
  } catch {
    return '1.0.0';
  }
}

export function configureAppBranding(): void {
  if (process.platform !== 'darwin') {
    return;
  }

  app.setName(APP_NAME);

  const version = getAppVersion();

  app.setAboutPanelOptions({
    applicationName: APP_NAME,
    applicationVersion: version,
    version,
  });
}
