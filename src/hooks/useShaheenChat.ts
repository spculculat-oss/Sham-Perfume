import { useSyncExternalStore } from 'react';
import { shaheenChatStore } from '../utils/chatStore';

export function useShaheenChat() {
  const state = useSyncExternalStore(shaheenChatStore.subscribe, shaheenChatStore.getSnapshot, shaheenChatStore.getSnapshot);
  return { ...state, setMessages: shaheenChatStore.setMessages, sendMessage: shaheenChatStore.send, clearHistory: shaheenChatStore.clear };
}
