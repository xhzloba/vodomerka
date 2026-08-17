import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  type AiChatMessage,
  type AiChatResult,
  type AiDeleteResult,
  type AiInstalledModel,
  type AiPullProgressEvent,
  type AiPullResult,
  type AiStatusSnapshot,
} from '../../contracts/ipc';
import {
  chatWithAi,
  cancelAiPull,
  deleteAiModel,
  getAiStatus,
  listAiModels,
  pullAiModel,
} from '../ai/ollama';

export function registerAiIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.ai.getStatus,
    async (_event, baseUrl?: string): Promise<AiStatusSnapshot> => getAiStatus(baseUrl),
  );

  ipcMain.handle(
    IPC_CHANNELS.ai.listModels,
    async (_event, baseUrl?: string): Promise<AiInstalledModel[]> => listAiModels(baseUrl),
  );

  ipcMain.handle(
    IPC_CHANNELS.ai.pullModel,
    async (_event, model: string, baseUrl?: string): Promise<AiPullResult> =>
      pullAiModel(model, baseUrl),
  );

  ipcMain.handle(IPC_CHANNELS.ai.cancelPull, async (): Promise<{ ok: true }> => cancelAiPull());

  ipcMain.handle(
    IPC_CHANNELS.ai.deleteModel,
    async (_event, model: string, baseUrl?: string): Promise<AiDeleteResult> =>
      deleteAiModel(model, baseUrl),
  );

  ipcMain.handle(
    IPC_CHANNELS.ai.chat,
    async (
      _event,
      messages: AiChatMessage[],
      options?: { model?: string; baseUrl?: string },
    ): Promise<AiChatResult> => chatWithAi(messages, options),
  );
}

export type { AiPullProgressEvent };
