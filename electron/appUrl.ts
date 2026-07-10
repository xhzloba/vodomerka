import path from 'path';

export function getRendererUrl(hash = ''): string {
  const normalizedHash = hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '';

  if (process.env.VITE_DEV_SERVER_URL) {
    return `${process.env.VITE_DEV_SERVER_URL}${normalizedHash}`;
  }

  return `file://${path.join(process.env.DIST!, 'index.html')}${normalizedHash}`;
}
