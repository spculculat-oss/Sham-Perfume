import type { AgentAction } from '../types/shaheenAgent';
import type { ExtractedAIPerfume } from './aiFormulaExtractor';
import type { ToolLink } from './shaheenTools';

export interface AgentWorkspaceHandlers {
  onApplyToConcentrationCalculator: (formula: ExtractedAIPerfume) => void;
  onApplyToPyramidCalculator: (formula: ExtractedAIPerfume) => void;
  onRecordToRecipeLibrary: (formula: ExtractedAIPerfume) => void;
  onCalculateCosting: (formula: ExtractedAIPerfume) => void;
  onPrintSpecSheet: (formula: ExtractedAIPerfume) => void;
  onOpenTool?: (link: ToolLink) => void;
}

export function executeShaheenAgentAction(action: AgentAction, handlers: AgentWorkspaceHandlers): boolean {
  if (action.type === 'open_tool' && action.toolLink && handlers.onOpenTool) {
    handlers.onOpenTool(action.toolLink);
    return true;
  }
  if (!action.formula) return false;
  switch (action.type) {
    case 'apply_formula':
      handlers.onApplyToConcentrationCalculator(action.formula);
      return true;
    case 'apply_pyramid':
      handlers.onApplyToPyramidCalculator(action.formula);
      return true;
    case 'save_recipe':
      handlers.onRecordToRecipeLibrary(action.formula);
      return true;
    case 'calculate_costing':
      handlers.onCalculateCosting(action.formula);
      return true;
    case 'print_spec_sheet':
      handlers.onPrintSpecSheet(action.formula);
      return true;
    default:
      return false;
  }
}
