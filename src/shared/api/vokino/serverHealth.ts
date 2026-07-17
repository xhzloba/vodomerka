import {
  VOKINO_API_SERVERS,
  VOKINO_API_TOKEN,
  VOKINO_DEV_PROXY_PREFIX,
  VOKINO_DEV_PROXY_PREFIX_TV,
  withVokinoToken,
  type VokinoApiServerId,
} from '@/shared/config/api';

export type ApiServerHealthStatus = 'idle' | 'checking' | 'ok' | 'fail';

const HEALTH_TIMEOUT_MS = 6_000;

function getProbeUrl(serverId: VokinoApiServerId): string {
  const absolute = withVokinoToken(`${VOKINO_API_SERVERS[serverId].base}/main`);

  if (import.meta.env.DEV && typeof window !== 'undefined' && !window.electronAPI?.api?.get) {
    const parsed = new URL(absolute);
    const prefix = serverId === '2' ? VOKINO_DEV_PROXY_PREFIX_TV : VOKINO_DEV_PROXY_PREFIX;
    const path = parsed.pathname.replace(/^\/v2/, '') || '/main';
    if (!parsed.searchParams.has('token')) {
      parsed.searchParams.set('token', VOKINO_API_TOKEN);
    }
    return `${prefix}${path}${parsed.search}`;
  }

  return absolute;
}

async function probeOnce(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    if (window.electronAPI?.api?.get) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('timeout')), HEALTH_TIMEOUT_MS);
      });
      const data = await Promise.race([window.electronAPI.api.get(url), timeoutPromise]);
      return Boolean(data && typeof data === 'object');
    }

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return false;
    }

    const data: unknown = await response.json();
    return Boolean(data && typeof data === 'object');
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function probeApiServer(serverId: VokinoApiServerId): Promise<boolean> {
  return probeOnce(getProbeUrl(serverId));
}

export async function probeAllApiServers(): Promise<Record<VokinoApiServerId, boolean>> {
  const [server1, server2] = await Promise.all([probeApiServer('1'), probeApiServer('2')]);
  return { '1': server1, '2': server2 };
}
