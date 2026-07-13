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
