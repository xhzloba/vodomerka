import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceRoots = ['contracts', 'electron', 'src'];
const sourceExtensions = /\.(?:ts|tsx)$/;
const importPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
const rawIpcChannelPattern =
  /['"](?:api|get|images|overrides|settings|favorites|recentlyViewed|watched|sidebar|windowChrome|system|detail):[^'"]+['"]/g;

function collectFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    return statSync(path).isDirectory() ? collectFiles(path) : sourceExtensions.test(path) ? [path] : [];
  });
}

function toProjectPath(path) {
  return relative(root, path).split(sep).join('/');
}

const violations = [];

for (const sourceRoot of sourceRoots) {
  for (const file of collectFiles(resolve(root, sourceRoot))) {
    const projectPath = toProjectPath(file);
    const source = readFileSync(file, 'utf8');
    const imports = [...source.matchAll(importPattern)].map((match) => match[1]);

    for (const specifier of imports) {
      if (projectPath.startsWith('contracts/') && /(?:^@\/|\/(?:src|electron)\/)/.test(specifier)) {
        violations.push(`${projectPath}: contracts must not depend on application layers (${specifier})`);
      }

      if (projectPath.startsWith('electron/') && specifier.startsWith('@/')) {
        violations.push(`${projectPath}: Electron must communicate with renderer through contracts (${specifier})`);
      }

      if (
        projectPath.startsWith('src/shared/') &&
        (specifier.startsWith('@/app/') ||
          specifier.startsWith('@/features/') ||
          specifier.startsWith('@/entities/') ||
          specifier.startsWith('@/components/'))
      ) {
        violations.push(`${projectPath}: shared layer cannot depend on upper layers (${specifier})`);
      }

      if (
        projectPath.startsWith('src/features/') &&
        (specifier.startsWith('@/app/') || specifier.startsWith('@/components/'))
      ) {
        violations.push(`${projectPath}: features cannot depend on app composition or views (${specifier})`);
      }

      if (
        projectPath.startsWith('src/entities/') &&
        (specifier.startsWith('@/app/') ||
          specifier.startsWith('@/features/') ||
          specifier.startsWith('@/components/'))
      ) {
        violations.push(`${projectPath}: entities cannot depend on upper layers (${specifier})`);
      }

      if (projectPath.startsWith('src/components/') && specifier.startsWith('@/app/')) {
        violations.push(`${projectPath}: UI components cannot depend on app composition (${specifier})`);
      }
    }

    if (projectPath !== 'contracts/ipc.ts') {
      for (const match of source.matchAll(rawIpcChannelPattern)) {
        violations.push(`${projectPath}: use IPC_CHANNELS instead of ${match[0]}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`Architecture check failed:\n${violations.map((item) => `- ${item}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Architecture check passed.');
}
