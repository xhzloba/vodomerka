export const VOKINO_API_BASE = 'https://api.vokino.pro/v2';

export const VOKINO_API_TOKEN = 'mac_23602515ddd41e2f1a3eba4d4c8a949a_1225352';

export const VOKINO_API_HOSTS = ['api.vokino.pro', 'api.vokino.tv'] as const;

export const VOKINO_DEV_PROXY_PREFIX = '/vokino-api';

export const API_TIMEOUT_MS = 15_000;

export const HOME_ROW_LIMIT = 24;
export const HOME_TRENDING_ROW_LIMIT = 15;

export function withVokinoToken(url: string): string {
  const parsed = new URL(url);
  if (!parsed.searchParams.has('token')) {
    parsed.searchParams.set('token', VOKINO_API_TOKEN);
  }
  return parsed.toString();
}

export function resolveVokinoUrl(url: string): string {
  if (url.startsWith(VOKINO_DEV_PROXY_PREFIX)) {
    const parsed = new URL(url, 'http://localhost');
    if (!parsed.searchParams.has('token')) {
      parsed.searchParams.set('token', VOKINO_API_TOKEN);
    }
    return `${parsed.pathname}${parsed.search}`;
  }

  const absolute = url.startsWith('http') ? url : `${VOKINO_API_BASE}${url.startsWith('/') ? url : `/${url}`}`;
  const parsed = new URL(absolute);

  const useDevProxy =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    !window.electronAPI?.api?.get &&
    VOKINO_API_HOSTS.includes(parsed.hostname as (typeof VOKINO_API_HOSTS)[number]);

  if (useDevProxy) {
    if (!parsed.searchParams.has('token')) {
      parsed.searchParams.set('token', VOKINO_API_TOKEN);
    }
    return `${VOKINO_DEV_PROXY_PREFIX}${parsed.pathname}${parsed.search}`;
  }

  return withVokinoToken(parsed.toString());
}
