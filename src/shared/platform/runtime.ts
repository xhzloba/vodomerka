export function getPlatform(): string {
  return window.electronAPI?.platform ?? 'web';
}

export function isMacOS(): boolean {
  return getPlatform() === 'darwin';
}
