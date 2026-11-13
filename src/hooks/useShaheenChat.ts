import { agentSettings } from './useShaheenAgent';
import { useSyncExternalStore } from 'react';
import { shaheenChatStore } from '../utils/chatStore';

/** Both Shaheen surfaces (floating window + lab page) share this one store, so they never diverge. */
export function useShaheenChat() {
  const state = useSyncExternalStore(shaheenChatStore.subscribe, shaheenChatStore.getSnapshot, shaheenChatStore.getSnapshot);
  return { ...state, setMessages: shaheenChatStore.setMessages, sendMessage: (options: Parameters<typeof shaheenChatStore.send>[0]) => shaheenChatStore.send({ ...options, ...agentSettings.getSnapshot() }),
    retryLast: (options: Parameters<typeof shaheenChatStore.retry>[0]) => shaheenChatStore.retry({ ...options, ...agentSettings.getSnapshot() }),
    clearHistory: () => { agentSettings.clearDocuments(); shaheenChatStore.clear(); }, cancelRequest: shaheenChatStore.cancel };
}
