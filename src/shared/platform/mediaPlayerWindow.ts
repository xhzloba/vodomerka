export function isPlayerWindow(): boolean {
  return typeof window !== 'undefined' && window.location.hash === '#player';
}

export function closeMediaPlayerWindow(): void {
  void window.electronAPI?.player?.close();
}
