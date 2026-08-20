import Hls from 'hls.js';

/**
 * In-app HLS player for Hero trailers.
 * Remote URLs must already be wrapped via electronAPI.api.proxyHlsUrl
 * so manifests/segments come from 127.0.0.1 (no CORS, no base64 IPC).
 */
export function createInAppHlsPlayer(): Hls {
  return new Hls({
    autoStartLoad: true,
    enableWorker: true,
    lowLatencyMode: false,
    // Trailers: start quickly, keep a modest buffer.
    startLevel: -1,
    maxBufferLength: 20,
    maxMaxBufferLength: 40,
  });
}

export async function toPlayableHlsUrl(sourceUrl: string): Promise<string> {
  if (window.electronAPI?.api?.proxyHlsUrl) {
    return window.electronAPI.api.proxyHlsUrl(sourceUrl);
  }
  return sourceUrl;
}
