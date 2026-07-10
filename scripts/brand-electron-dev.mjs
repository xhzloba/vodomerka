import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
);
const appName = packageJson.build?.productName ?? 'Vodomerka';
const appId = packageJson.build?.appId ?? 'com.vodomerka.app';

if (process.platform !== 'darwin') {
  process.exit(0);
}

const electronDir = path.join(projectRoot, 'node_modules/electron');
const distDir = path.join(electronDir, 'dist');
const electronAppPath = path.join(distDir, 'Electron.app');
const brandedAppPath = path.join(distDir, `${appName}.app`);
const pathTxtFile = path.join(electronDir, 'path.txt');
const brandedExecutablePath = `${appName}.app/Contents/MacOS/Electron`;

function runPlistBuddy(args) {
  return execFileSync('/usr/libexec/PlistBuddy', args, { encoding: 'utf8' }).trim();
}

function setPlistValue(plistPath, key, value) {
  try {
    runPlistBuddy(['-c', `Print :${key}`, plistPath]);
    runPlistBuddy(['-c', `Set :${key} ${value}`, plistPath]);
  } catch {
    runPlistBuddy(['-c', `Add :${key} string ${value}`, plistPath]);
  }
}

if (!fs.existsSync(distDir)) {
  console.warn('[brand-electron-dev] Electron dist folder not found, skipping Dock branding');
  process.exit(0);
}

if (!fs.existsSync(electronAppPath) && !fs.existsSync(brandedAppPath)) {
  const existingBrandedApp = fs
    .readdirSync(distDir)
    .find((entry) => entry.endsWith('.app') && entry !== 'Electron.app' && entry !== `${appName}.app`);

  if (existingBrandedApp) {
    fs.renameSync(path.join(distDir, existingBrandedApp), brandedAppPath);
    console.log(`[brand-electron-dev] Renamed ${existingBrandedApp} -> ${appName}.app`);
  }
}

if (!fs.existsSync(electronAppPath) && !fs.existsSync(brandedAppPath)) {
  console.warn('[brand-electron-dev] Electron.app not found, skipping Dock branding');
  process.exit(0);
}

if (fs.existsSync(electronAppPath)) {
  if (fs.existsSync(brandedAppPath)) {
    fs.rmSync(brandedAppPath, { recursive: true, force: true });
  }

  fs.renameSync(electronAppPath, brandedAppPath);
  console.log(`[brand-electron-dev] Renamed Electron.app -> ${appName}.app`);
}

const plistPath = path.join(brandedAppPath, 'Contents/Info.plist');
setPlistValue(plistPath, 'CFBundleDisplayName', appName);
setPlistValue(plistPath, 'CFBundleName', appName);
setPlistValue(plistPath, 'CFBundleIdentifier', appId);

fs.writeFileSync(pathTxtFile, brandedExecutablePath, 'utf8');
console.log(`[brand-electron-dev] Updated electron path.txt -> ${brandedExecutablePath}`);

try {
  execFileSync(
    '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',
    ['-f', brandedAppPath],
    { stdio: 'ignore' },
  );
  console.log('[brand-electron-dev] Refreshed LaunchServices cache');
} catch {
  console.warn('[brand-electron-dev] Could not refresh LaunchServices cache');
}

console.log(`[brand-electron-dev] Dock branding ready for "${appName}"`);
