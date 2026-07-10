export type AppTheme = 'obsidian' | 'onyx' | 'nocturne' | 'ember' | 'aurora';

export const DEFAULT_APP_THEME: AppTheme = 'obsidian';

export const APP_THEME_OPTIONS: Array<{
  id: AppTheme;
  label: string;
  description: string;
}> = [
  {
    id: 'obsidian',
    label: 'Обсидиан',
    description: 'Тёплый графитовый фон с серебристым свечением',
  },
  {
    id: 'onyx',
    label: 'Оникс',
    description: 'Глубокий чёрный с холодным синим акцентом',
  },
  {
    id: 'nocturne',
    label: 'Ноктюрн',
    description: 'Аметистовый сумрак с лавандово-розовым сиянием',
  },
  {
    id: 'ember',
    label: 'Янтарь',
    description: 'Тёплый уголь с медово-золотым сиянием',
  },
  {
    id: 'aurora',
    label: 'Аврора',
    description: 'Полярная ночь с бирюзово-мятным сиянием',
  },
];

const THEME_BACKGROUNDS: Record<AppTheme, string> = {
  obsidian: '#0a0a0e',
  onyx: '#050508',
  nocturne: '#07060c',
  ember: '#0b0907',
  aurora: '#060a0c',
};

export function isAppTheme(value: unknown): value is AppTheme {
  return (
    value === 'obsidian' ||
    value === 'onyx' ||
    value === 'nocturne' ||
    value === 'ember' ||
    value === 'aurora'
  );
}

export function normalizeAppTheme(value: unknown): AppTheme {
  return isAppTheme(value) ? value : DEFAULT_APP_THEME;
}

export function getThemeBackgroundColor(theme: AppTheme): string {
  return THEME_BACKGROUNDS[theme];
}

export function applyAppTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = 'dark';
}
