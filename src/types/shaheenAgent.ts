import type { ExtractedAIPerfume } from '../utils/aiFormulaExtractor';
import type { ToolLink } from '../utils/shaheenTools';
import type { SupportedLanguage } from './i18n';

export type AgentReasoningDepth = 'standard' | 'deep' | 'max';

export type AgentMode = 'agent' | 'arena' | 'architect';

export type AgentArtifactLanguage =
  | 'html'
  | 'react'
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'sql'
  | 'css'
  | 'json'
  | 'mermaid'
  | 'svg';

export interface CodeVerificationDiagnostic {
  level: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
}

export interface CodeVerificationReport {
  valid: boolean;
  score: number;
  diagnostics: CodeVerificationDiagnostic[];
  metrics: {
    lines: number;
    characters: number;
    functionsEstimate: number;
  };
}

export interface AgentArtifact {
  id: string;
  title: string;
  filename: string;
  language: AgentArtifactLanguage;
  summary: string;
  code: string;
  previewHtml?: string;
  runnable: boolean;
  verification?: CodeVerificationReport;
  contenderId?: 'a' | 'b' | 'merged';
  createdAt?: number;
}

export interface AgentPlanTask {
  id: string;
  title: string;
  phase: 'research' | 'design' | 'build' | 'verify';
  status: 'pending' | 'in_progress' | 'done';
  detail?: string;
}

export interface AgentPlan {
  goal: string;
  tasks: AgentPlanTask[];
}

export interface ArenaScoreBreakdown {
  accuracy: number;
  architecture: number;
  clarity: number;
  completeness: number;
  overall: number;
}

export interface ArenaContenderResult {
  id: 'a' | 'b';
  label: string;
  styleTag: string;
  reply: string;
  artifacts: AgentArtifact[];
  durationMs: number;
  score: ArenaScoreBreakdown;
  strengths: string[];
}

export type ArenaVoteChoice = 'a' | 'b' | 'tie' | 'merged';

export interface ArenaVoteTotals {
  a: number;
  b: number;
  tie: number;
  merged: number;
}

export interface ArenaBattleResult {
  battleId: string;
  contenders: ArenaContenderResult[];
  winner: 'a' | 'b' | 'tie';
  judgeSummary: string;
  synthesizedReply: string;
  synthesizedArtifacts: AgentArtifact[];
  userVote?: ArenaVoteChoice;
  voteTotals?: ArenaVoteTotals;
}

export interface AgentStep {
  id: string;
  kind: 'thought' | 'tool' | 'web' | 'action' | 'code' | 'arena';
  tool?: string;
  label: string;
  status: 'running' | 'done' | 'error';
  detail?: string;
  durationMs?: number;
}

export interface AgentGroundingSource {
  title: string;
  uri: string;
}

export type AgentActionType =
  | 'apply_formula'
  | 'apply_pyramid'
  | 'save_recipe'
  | 'calculate_costing'
  | 'print_spec_sheet'
  | 'open_tool';

export interface AgentAction {
  id: string;
  type: AgentActionType;
  label: string;
  formula?: ExtractedAIPerfume;
  toolLink?: ToolLink;
  applied?: boolean;
}

export interface AgentAttachmentInput {
  name: string;
  mimeType: string;
  data: string;
}

export interface ChatAttachmentPreview {
  id: string;
  name: string;
  mimeType: string;
  previewUrl?: string;
}

export interface LabContextSnapshot {
  activeTab?: string;
  formulaTitle?: string;
  formulation?: {
    bottleVolumeMl: number;
    batchCount: number;
    concentrationPercent: number;
    concentrationType: string;
    alcoholPercentage: number;
    waterPercent: number;
    fixativePercent: number;
    unitMode: string;
  };
  pyramidNotes?: {
    nameAr: string;
    nameEn?: string;
    category: 'top' | 'heart' | 'base';
    percentageOfOil: number;
  }[];
  macerationDays?: number;
  savedCount?: number;
  currencyCode?: string;
  countryName?: string;
}

export interface ActiveArtifactContext {
  id: string;
  filename: string;
  language: string;
  code: string;
}

export interface AgentRequestPayload {
  message: string;
  language: SupportedLanguage;
  agentMode?: AgentMode;
  reasoningDepth?: AgentReasoningDepth;
  autoWebSearch?: boolean;
  conversationHistory?: { role: 'user' | 'assistant'; text: string }[];
  attachments?: AgentAttachmentInput[];
  labContext?: LabContextSnapshot;
  activeArtifact?: ActiveArtifactContext;
  visitorId?: string;
}

export type AgentStreamEvent =
  | { type: 'status'; phase: string }
  | { type: 'thought'; stepId: string; text: string }
  | { type: 'plan'; goal: string; tasks: AgentPlanTask[] }
  | { type: 'artifact'; artifact: AgentArtifact }
  | {
      type: 'arena_start';
      battleId: string;
      contenders: { id: 'a' | 'b'; label: string; styleTag: string }[];
    }
  | { type: 'arena_contender'; contender: ArenaContenderResult }
  | {
      type: 'arena_judge';
      winner: 'a' | 'b' | 'tie';
      judgeSummary: string;
    }
  | { type: 'tool_call'; stepId: string; tool: string; label: string; detail?: string }
  | { type: 'tool_result'; stepId: string; tool: string; status: 'done' | 'error'; detail?: string; durationMs?: number }
  | { type: 'grounding'; sources: AgentGroundingSource[] }
  | { type: 'action'; action: AgentAction }
  | { type: 'chunk'; text: string }
  | {
      type: 'done';
      reply: string;
      steps: AgentStep[];
      sources: AgentGroundingSource[];
      actions: AgentAction[];
      plan?: AgentPlan;
      artifacts?: AgentArtifact[];
      arena?: ArenaBattleResult;
      engine: {
        id: string;
        name: string;
        badge: string;
        provider: 'shaheen';
        accentColor: string;
      };
    }
  | { type: 'error'; code: string; message: string };
