import { resolveVokinoUrl } from '@/shared/config/api';

export const TOP250_COMPILATION_ID = '66fa5fc9dd606aae9ea0a9dc';
export const TOP250_SECTION_TITLE = 'Топ 250';

export function getTop250PlaylistUrl(): string {
  return resolveVokinoUrl(`/compilations/content/${TOP250_COMPILATION_ID}`);
}

export function isTop250PlaylistUrl(url: string): boolean {
  return url.includes(TOP250_COMPILATION_ID);
}

export function isTop250TabTitle(title: string): boolean {
  return title.trim() === TOP250_SECTION_TITLE;
}
