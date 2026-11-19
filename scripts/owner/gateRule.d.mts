/** Types for gateRule.mjs (the owner's switch, shared by the workflows' gate and the robots' server). */
export function ownerDecision(bots: string[], controls?: object, stateOrders?: object, live?: boolean): {
  allowed: boolean; by: 'frozen' | 'owner' | 'state' | undefined; why: string; who: string;
};
