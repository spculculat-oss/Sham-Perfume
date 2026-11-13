import { useSyncExternalStore } from 'react';
import type { AgentDocument } from '../types/agent';

let settings = { agent: false, documents: [] as AgentDocument[], webSearch: false };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
export const agentSettings = {
  getSnapshot: () => settings,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  update(patch: Partial<typeof settings>) { settings = { ...settings, ...patch }; notify(); },
  clearDocuments() { settings = { ...settings, documents: [] }; notify(); },
};
// In-memory only: uploaded contents are never added to localStorage/chat history.
export function useShaheenAgent() {
  return { ...useSyncExternalStore(agentSettings.subscribe, agentSettings.getSnapshot, agentSettings.getSnapshot), update: agentSettings.update };
}
