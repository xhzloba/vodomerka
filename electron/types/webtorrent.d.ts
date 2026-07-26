declare module 'webtorrent' {
  export default class WebTorrent {
    add(
      magnetUriOrTorrentId: string | Uint8Array,
      opts?: { path?: string },
      onTorrent?: (torrent: WebTorrent.Torrent) => void,
    ): WebTorrent.Torrent;
    get(torrentId: string): WebTorrent.Torrent | undefined;
    remove(
      torrentId: string,
      opts?: { destroyStore?: boolean },
      cb?: (err?: Error | string) => void,
    ): void;
    destroy(cb?: (err?: Error) => void): void;
  }

  namespace WebTorrent {
    interface Torrent {
      infoHash: string;
      name: string;
      magnetURI: string;
      progress: number;
      downloadSpeed: number;
      uploaded: number;
      downloaded: number;
      length: number;
      done: boolean;
      path: string;
      files: Array<{ name: string; path: string; length: number }>;
      destroy(opts?: { destroyStore?: boolean }, cb?: (err?: Error | string) => void): void;
      on(event: string, listener: (...args: unknown[]) => void): void;
    }
  }
}
