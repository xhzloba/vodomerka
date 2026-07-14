import { httpGet } from '@/shared/api/httpClient';
import { resolveVokinoUrl } from '@/shared/config/api';
import type { VokinoListPage } from '@/shared/api/vokino/types';

import { normalizeVokinoImageUrl } from '@/shared/media/imageLoader';

export interface VokinoCompilationDetails {
  id: string;
  name: string;
  poster?: string;
  is_compilation?: boolean;
}

export interface VokinoCompilationItem {
  playlist_url: string;
  details: VokinoCompilationDetails;
}

export interface VokinoCompilationsListResponse {
  type: string;
  title?: string;
  channels: VokinoCompilationItem[];
  page?: VokinoListPage;
}

export interface CompilationsPageResult {
  items: VokinoCompilationItem[];
  nextUrl: string | null;
}

function normalizeUrl(url: string): string {
  return new URL(url).href;
}

export function getCompilationsListUrl(page = 1): string {
  const base = resolveVokinoUrl('/compilations/list');
  if (page <= 1) {
    return base;
  }

  const parsed = new URL(base);
  parsed.searchParams.set('page', String(page));
  return parsed.toString();
}

function normalizeCompilationItem(item: VokinoCompilationItem): VokinoCompilationItem {
  return {
    ...item,
    details: {
      ...item.details,
      poster: item.details.poster
        ? normalizeVokinoImageUrl(item.details.poster)
        : undefined,
    },
  };
}

export async function fetchCompilationsPage(
  pageUrl?: string | null,
): Promise<CompilationsPageResult> {
  const requestUrl = pageUrl ?? getCompilationsListUrl(1);
  const data = await httpGet<VokinoCompilationsListResponse>(requestUrl);
  const rawItems = data.channels ?? [];
  const items = rawItems
    .filter((item) => item.details?.id && item.details?.name)
    .map(normalizeCompilationItem);

  return {
    items,
    nextUrl:
      data.page?.next && rawItems.length > 0
        ? normalizeUrl(data.page.next)
        : null,
  };
}

const MAX_COMPILATIONS_PAGES = 20;

export async function fetchAllCompilations(
  onProgress?: (items: VokinoCompilationItem[]) => void,
): Promise<VokinoCompilationItem[]> {
  const accumulated: VokinoCompilationItem[] = [];
  const seen = new Set<string>();
  let nextUrl: string | null = getCompilationsListUrl(1);

  for (let page = 0; page < MAX_COMPILATIONS_PAGES && nextUrl; page += 1) {
    const result = await fetchCompilationsPage(nextUrl);
    let added = 0;

    for (const item of result.items) {
      if (seen.has(item.details.id)) {
        continue;
      }

      seen.add(item.details.id);
      accumulated.push(item);
      added += 1;
    }

    onProgress?.(accumulated);

    if (result.items.length === 0) {
      break;
    }

    if (added === 0) {
      break;
    }

    nextUrl = result.nextUrl;
  }

  return accumulated;
}
