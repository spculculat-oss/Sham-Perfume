export interface AgentDocument { name: string; text: string }
export interface AgentArtifact { name: string; content: string }
export interface AgentStep { tool: string; status: 'completed' | 'failed' }
export interface AgentReport { steps: AgentStep[]; artifacts: AgentArtifact[] }

// Shared validation for untrusted responses AND browser storage. No executable artifacts.
export function validArtifact(value: unknown): value is AgentArtifact {
  if (!value || typeof value !== 'object') return false;
  const artifact = value as AgentArtifact;
  return typeof artifact.name === 'string' && /^[a-zA-Z0-9_-]{1,64}\.(txt|md|json|csv)$/.test(artifact.name) &&
    typeof artifact.content === 'string' && artifact.content.length > 0 && artifact.content.length <= 8000;
}
export function validAgentReport(value: unknown): value is AgentReport {
  if (!value || typeof value !== 'object') return false;
  const report = value as AgentReport;
  return Array.isArray(report.steps) && report.steps.length <= 5 && report.steps.every((step) =>
    step && typeof step.tool === 'string' && /^[a-z_]{1,40}$/.test(step.tool) && ['completed', 'failed'].includes(step.status)) &&
    Array.isArray(report.artifacts) && report.artifacts.length <= 2 && report.artifacts.every(validArtifact);
}
