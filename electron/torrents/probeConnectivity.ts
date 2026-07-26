import dgram from 'node:dgram';
import dns from 'node:dns/promises';
import type { TorrentConnectivityProbeResult } from '../../contracts/ipc';

/** Same public trackers we append to magnets — smoke-test reachability before download. */
const PROBE_TRACKERS = [
  'http://tracker.opentrackr.org:1337/announce',
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'http://bt4.t-ru.org/ann?magnet',
] as const;

const PROBE_TIMEOUT_MS = 3500;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: timeout`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

async function probeDns(): Promise<{ ok: boolean; ms: number; error?: string }> {
  const started = Date.now();
  try {
    await withTimeout(dns.lookup('tracker.opentrackr.org'), PROBE_TIMEOUT_MS, 'dns');
    return { ok: true, ms: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function probeHttpTracker(url: string): Promise<{ ok: boolean; ms: number; error?: string }> {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      // Any HTTP response means the tracker host is reachable (4xx is fine).
      await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'VodomerkaTorrentProbe/1.0' },
      });
      return { ok: true, ms: Date.now() - started };
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Abort / network failures = unreachable
    return { ok: false, ms: Date.now() - started, error: message };
  }
}

function parseUdpTracker(url: string): { host: string; port: number } | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'udp:') {
      return null;
    }
    const port = Number(parsed.port || 80);
    if (!parsed.hostname || !Number.isFinite(port) || port <= 0) {
      return null;
    }
    return { host: parsed.hostname, port };
  } catch {
    return null;
  }
}

/** BitTorrent UDP tracker connect (BEP 15) — any response = reachable. */
async function probeUdpTracker(url: string): Promise<{ ok: boolean; ms: number; error?: string }> {
  const target = parseUdpTracker(url);
  if (!target) {
    return { ok: false, ms: 0, error: 'bad udp url' };
  }

  const started = Date.now();
  try {
    const resolved = await withTimeout(dns.lookup(target.host), PROBE_TIMEOUT_MS, 'udp-dns');

    const packet = Buffer.alloc(16);
    // magic connection_id for connect
    packet.writeUInt32BE(0x00000417, 0);
    packet.writeUInt32BE(0x27101980, 4);
    packet.writeUInt32BE(0, 8); // action = connect
    packet.writeUInt32BE((Math.random() * 0xffffffff) >>> 0, 12);

    await withTimeout(
      new Promise<void>((resolve, reject) => {
        const socket = dgram.createSocket(resolved.family === 6 ? 'udp6' : 'udp4');
        const fail = (error: Error) => {
          try {
            socket.close();
          } catch {
            // ignore
          }
          reject(error);
        };

        socket.once('error', (error) => fail(error));
        socket.once('message', () => {
          try {
            socket.close();
          } catch {
            // ignore
          }
          resolve();
        });

        socket.send(packet, target.port, resolved.address, (error) => {
          if (error) {
            fail(error);
          }
        });
      }),
      PROBE_TIMEOUT_MS,
      'udp',
    );

    return { ok: true, ms: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function probeTracker(
  url: string,
): Promise<{ url: string; ok: boolean; ms: number; error?: string }> {
  const result = url.startsWith('udp:')
    ? await probeUdpTracker(url)
    : await probeHttpTracker(url);
  return { url, ...result };
}

export async function probeTorrentConnectivity(): Promise<TorrentConnectivityProbeResult> {
  const checkedAt = Date.now();
  const dnsResult = await probeDns();
  const trackers = await Promise.all(PROBE_TRACKERS.map((url) => probeTracker(url)));
  const okCount = trackers.filter((item) => item.ok).length;
  const ok = dnsResult.ok && okCount > 0;

  let message: string;
  if (ok) {
    message = `Сеть OK · трекеры ${okCount}/${trackers.length}`;
  } else if (!dnsResult.ok) {
    message = 'Нет DNS/интернета — скачивание скорее всего не стартует';
  } else if (okCount === 0) {
    message = 'Трекеры недоступны — сиды из каталога не гарантируют раздачу';
  } else {
    message = 'Соединение нестабильно';
  }

  return {
    ok,
    checkedAt,
    dnsOk: dnsResult.ok,
    trackersOk: okCount,
    trackersTotal: trackers.length,
    trackers,
    message,
  };
}
