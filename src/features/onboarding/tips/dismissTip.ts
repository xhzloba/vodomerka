export const TIP_IDS = {
  sidebarCollapseShortcut: 'sidebar-collapse-shortcut',
  searchShortcut: 'search-shortcut',
} as const;

export function appendDismissedTipId(dismissedTipIds: string[], tipId: string): string[] {
  if (dismissedTipIds.includes(tipId)) {
    return dismissedTipIds;
  }

  return [...dismissedTipIds, tipId];
}

export function isTipDismissed(dismissedTipIds: string[], tipId: string): boolean {
  return dismissedTipIds.includes(tipId);
}
