export type DownloadProgressCallback = (progress: number) => void;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export async function fetchJsonWithProgress(
  url: string,
  onProgress?: DownloadProgressCallback,
): Promise<unknown> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const totalHeader = response.headers.get('content-length');
  const total = totalHeader ? Number(totalHeader) : 0;
  const hasTotal = Number.isFinite(total) && total > 0;

  if (!response.body) {
    const data = await response.json();
    onProgress?.(1);
    return data;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    chunks.push(value);
    received += value.byteLength;

    if (hasTotal) {
      onProgress?.(clamp01(received / total));
    } else {
      onProgress?.(clamp01(1 - 1 / (1 + received / 8192)));
    }
  }

  onProgress?.(1);

  const merged = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return JSON.parse(merged.toString('utf8')) as unknown;
}
