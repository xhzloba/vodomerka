export const AI_OPEN_PLUGINS_EVENT = 'vodomerka:open-ai-plugins';

let pendingAiPluginsTab = false;

export function openAiPluginsTab(): void {
  pendingAiPluginsTab = true;
  window.dispatchEvent(new CustomEvent(AI_OPEN_PLUGINS_EVENT));
}

export function consumeOpenAiPluginsTab(): boolean {
  if (!pendingAiPluginsTab) {
    return false;
  }

  pendingAiPluginsTab = false;
  return true;
}
