import { getPlatform } from '@/shared/platform/runtime';

export function isMacLikePlatform(): boolean {
  const platform = getPlatform();

  if (platform === 'darwin') {
    return true;
  }

  if (platform === 'win32') {
    return false;
  }

  if (typeof navigator !== 'undefined') {
    return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  }

  return false;
}

export function getSidebarToggleShortcutLabel(): string {
  return isMacLikePlatform() ? '⌘B' : 'Ctrl+B';
}

export function getSearchShortcutLabel(): string {
  return isMacLikePlatform() ? '⌘K' : 'Ctrl+K';
}

export function getSearchShortcutParts(): string[] {
  return isMacLikePlatform() ? ['⌘', 'K'] : ['Ctrl', 'K'];
}

export function getSidebarToggleShortcutParts(): string[] {
  return isMacLikePlatform() ? ['⌘', 'B'] : ['Ctrl', 'B'];
}
