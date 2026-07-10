/// <reference types="vite/client" />

import type { ElectronApi } from '../contracts/ipc';

declare global {
  interface Window {
    electronAPI?: ElectronApi;
  }
}

export {};
