/**
 * Versioned, privacy-safe-in-operation envelope for comparing conversation context builders.
 * This module has no storage, network, provider, logger, or global state. Context content is held
 * only by the caller; comparison summaries deliberately contain counts/booleans, never message text or IDs.
 */
export const UNIFIED_CONTEXT_VERSION = 1 as const;

export type ConversationRole = 'user' | 'assistant';
export type ConversationSurface = 'sham-core' | 'shaheen';

export interface UnifiedTurn {
  id?: string;
  role: ConversationRole;
  text: string;
  timestamp?: string;
  /** Exact source/citation metadata supplied by the surface. */
  sources?: readonly unknown[];
  /** Additional turn metadata (e.g. intent/engine), copied without interpretation. */
  metadata?: Readonly<Record<string, unknown>>;
}

export interface UnifiedConversationContext {
  version: typeof UNIFIED_CONTEXT_VERSION;
  surface: ConversationSurface;
  /** Scope is carried in memory for isolation checks; it is never emitted in comparison summaries. */
  scope?: { visitorId?: string; conversationId?: string };
  turns: readonly UnifiedTurn[];
  currentMessage?: UnifiedTurn;
}

export interface UnifiedContextInput {
  surface: ConversationSurface;
  scope?: { visitorId?: string; conversationId?: string };
  turns: readonly UnifiedTurn[];
  currentMessage?: UnifiedTurn;
}

export interface ShadowComparisonSummary {
  version: typeof UNIFIED_CONTEXT_VERSION;
  surface: ConversationSurface;
  legacyTurnCount: number;
  unifiedTurnCount: number;
  legacySequencePreserved: boolean;
  scopeBound: boolean;
}

const clone = <T>(value: T): T => structuredClone(value);

function cloneTurn(turn: UnifiedTurn): UnifiedTurn {
  if ((turn.role !== 'user' && turn.role !== 'assistant') || typeof turn.text !== 'string') {
    throw new TypeError('Unified conversation turns require a user/assistant role and string text');
  }
  return {
    ...(turn.id !== undefined ? { id: turn.id } : {}),
    role: turn.role,
    text: turn.text,
    ...(turn.timestamp !== undefined ? { timestamp: turn.timestamp } : {}),
    ...(turn.sources !== undefined ? { sources: clone([...turn.sources]) } : {}),
    ...(turn.metadata !== undefined ? { metadata: clone({ ...turn.metadata }) } : {}),
  };
}

/** Build a detached, versioned context snapshot. No trimming, summarizing, reordering, or redaction occurs here. */
export function createUnifiedConversationContext(input: UnifiedContextInput): UnifiedConversationContext {
  return {
    version: UNIFIED_CONTEXT_VERSION,
    surface: input.surface,
    ...(input.scope ? { scope: { ...input.scope } } : {}),
    turns: input.turns.map(cloneTurn),
    ...(input.currentMessage ? { currentMessage: cloneTurn(input.currentMessage) } : {}),
  };
}

/**
 * Compare the existing request sequence to the shadow snapshot. The result intentionally excludes text,
 * visitor/conversation IDs, source URLs and other potentially sensitive content.
 */
export function compareLegacyContext(
  legacyTurns: readonly Pick<UnifiedTurn, 'role' | 'text'>[],
  unified: UnifiedConversationContext,
): ShadowComparisonSummary {
  const combined = unified.currentMessage ? [...unified.turns, unified.currentMessage] : [...unified.turns];
  let cursor = 0;
  let preserved = true;
  for (const legacy of legacyTurns) {
    while (cursor < combined.length && (combined[cursor].role !== legacy.role || combined[cursor].text !== legacy.text)) cursor++;
    if (cursor >= combined.length) { preserved = false; break; }
    cursor++;
  }
  return {
    version: unified.version,
    surface: unified.surface,
    legacyTurnCount: legacyTurns.length,
    unifiedTurnCount: combined.length,
    legacySequencePreserved: preserved,
    scopeBound: Boolean(unified.scope?.visitorId && unified.scope?.conversationId),
  };
}

/** Convert a stored Sham Core turn while preserving its original record as metadata. */
export function coreMessageToUnifiedTurn<T extends {
  id?: string; role: ConversationRole; text: string; at?: string; citations?: readonly unknown[];
}>(message: T): UnifiedTurn {
  const { id, role, text, at, citations, ...rest } = message;
  const metadata = rest as Record<string, unknown>;
  return {
    ...(id !== undefined ? { id } : {}), role, text,
    ...(at !== undefined ? { timestamp: at } : {}),
    ...(citations !== undefined ? { sources: citations } : {}),
    metadata: {
      ...metadata,
      ...(at !== undefined ? { at } : {}),
      ...(citations !== undefined ? { citations } : {}),
    },
  };
}

/** Convert a Shaheen client/server turn; source citations and provider metadata stay attached to their turn. */
export function shaheenMessageToUnifiedTurn<T extends {
  id?: string; role: ConversationRole; text: string; timestamp?: string; sources?: readonly unknown[];
}>(message: T): UnifiedTurn {
  const { id, role, text, timestamp, sources, ...rest } = message;
  const metadata = rest as Record<string, unknown>;
  return {
    ...(id !== undefined ? { id } : {}), role, text,
    ...(timestamp !== undefined ? { timestamp } : {}),
    ...(sources !== undefined ? { sources } : {}),
    metadata,
  };
}
