export type VokinoApiServerId = '1' | '2';

export const VOKINO_API_SERVERS: Record<
  VokinoApiServerId,
  { id: VokinoApiServerId; label: string; hint: string; base: string; host: string }
> = {
  '1': {
    id: '1',
    label: 'Сервер 1',
    hint: 'api.vokino.pro',
    base: 'https://api.vokino.pro/v2',
    host: 'api.vokino.pro',
  },
  '2': {
    id: '2',
    label: 'Сервер 2',
    hint: 'api.vokino.tv',
    base: 'https://api.vokino.tv/v2',
    host: 'api.vokino.tv',
  },
};

export const DEFAULT_VOKINO_API_SERVER: VokinoApiServerId = '1';

export const VOKINO_API_BASE = VOKINO_API_SERVERS[DEFAULT_VOKINO_API_SERVER].base;

export const VOKINO_API_TOKEN = 'mac_23602515ddd41e2f1a3eba4d4c8a949a_1225352';

export const VOKINO_API_HOSTS = Object.values(VOKINO_API_SERVERS).map((server) => server.host);

export const VOKINO_DEV_PROXY_PREFIX = '/vokino-api';
export const VOKINO_DEV_PROXY_PREFIX_TV = '/vokino-api-tv';

export const VOKINO_API_SERVER_CHANGED_EVENT = 'vokino-api-server-changed';

export const API_TIMEOUT_MS = 15_000;

export const HOME_ROW_LIMIT = 24;
export const HOME_TRENDING_ROW_LIMIT = 15;

let activeApiServer: VokinoApiServerId = DEFAULT_VOKINO_API_SERVER;

export function normalizeVokinoApiServer(value: unknown): VokinoApiServerId {
  if (value === '2') {
    return '2';
  }

  return DEFAULT_VOKINO_API_SERVER;
}

export function getVokinoApiServer(): VokinoApiServerId {
  return activeApiServer;
}

export function setVokinoApiServer(value: unknown): VokinoApiServerId {
  activeApiServer = normalizeVokinoApiServer(value);
  return activeApiServer;
}

export function getVokinoApiBase(): string {
  return VOKINO_API_SERVERS[activeApiServer].base;
}

function getDevProxyPrefix(hostname: string): string {
  if (hostname === VOKINO_API_SERVERS['2'].host) {
    return VOKINO_DEV_PROXY_PREFIX_TV;
  }

  return VOKINO_DEV_PROXY_PREFIX;
}

export function withVokinoToken(url: string): string {
  const parsed = new URL(url);
  if (!parsed.searchParams.has('token')) {
    parsed.searchParams.set('token', VOKINO_API_TOKEN);
  }
  return parsed.toString();
}

export function resolveVokinoUrl(url: string): string {
  if (url.startsWith(VOKINO_DEV_PROXY_PREFIX_TV) || url.startsWith(VOKINO_DEV_PROXY_PREFIX)) {
    const parsed = new URL(url, 'http://localhost');
    if (!parsed.searchParams.has('token')) {
      parsed.searchParams.set('token', VOKINO_API_TOKEN);
    }
    return `${parsed.pathname}${parsed.search}`;
  }

  const absolute = url.startsWith('http')
    ? url
    : `${getVokinoApiBase()}${url.startsWith('/') ? url : `/${url}`}`;
  const parsed = new URL(absolute);

  const useDevProxy =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    !window.electronAPI?.api?.get &&
    VOKINO_API_HOSTS.includes(parsed.hostname);

  if (useDevProxy) {
    if (!parsed.searchParams.has('token')) {
      parsed.searchParams.set('token', VOKINO_API_TOKEN);
    }
    return `${getDevProxyPrefix(parsed.hostname)}${parsed.pathname}${parsed.search}`;
  }

  return withVokinoToken(parsed.toString());
}
