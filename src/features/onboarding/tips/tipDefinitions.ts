import type { AppSettings } from '@/shared/settings/types';
import { getSearchShortcutLabel, getSidebarToggleShortcutLabel } from './platformShortcut';
import { TIP_IDS } from './dismissTip';

export { TIP_IDS } from './dismissTip';

export interface AppTipContext {
  sidebarShortcutLabel: string;
  searchShortcutLabel: string;
}

export interface AppTipDefinition {
  id: string;
  title?: string;
  buildMessage: (context: AppTipContext) => string;
  /** Задержка перед первым показом после запуска */
  initialDelayMs: number;
  /** Интервал повторного показа. 0 — только один раз. */
  repeatIntervalMs: number;
  duration?: number;
  isEligible?: (settings: AppSettings) => boolean;
}

export const APP_TIPS: AppTipDefinition[] = [
  {
    id: TIP_IDS.sidebarCollapseShortcut,
    buildMessage: ({ sidebarShortcutLabel }) =>
      `Свернуть боковое меню можно сочетанием ${sidebarShortcutLabel} — так на экране останется больше места для контента.`,
    initialDelayMs: 15_000,
    repeatIntervalMs: 3 * 24 * 60 * 60 * 1000,
    duration: 12_000,
    isEligible: (settings) => !settings.sidebarCollapsed,
  },
  {
    id: TIP_IDS.searchShortcut,
    buildMessage: ({ searchShortcutLabel }) =>
      `Быстрый поиск доступен по ${searchShortcutLabel} — откроется поверх текущего экрана, не покидая раздел.`,
    initialDelayMs: 28_000,
    repeatIntervalMs: 3 * 24 * 60 * 60 * 1000,
    duration: 12_000,
  },
];

export function buildAppTipContext(): AppTipContext {
  return {
    sidebarShortcutLabel: getSidebarToggleShortcutLabel(),
    searchShortcutLabel: getSearchShortcutLabel(),
  };
}
