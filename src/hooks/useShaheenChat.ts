import { useSyncExternalStore } from 'react';
import { shaheenChatStore } from '../utils/chatStore';

/** Both Shaheen surfaces (floating window + lab page) share this one store, so they never diverge. */
export function useShaheenChat() {
  const state = useSyncExternalStore(shaheenChatStore.subscribe, shaheenChatStore.getSnapshot, shaheenChatStore.getSnapshot);
  return { ...state, setMessages: shaheenChatStore.setMessages, sendMessage: shaheenChatStore.send,
    retryLast: shaheenChatStore.retry, clearHistory: shaheenChatStore.clear };
}
