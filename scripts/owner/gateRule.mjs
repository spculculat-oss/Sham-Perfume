/**
 * The owner's switch, as a rule: may these robots run? Shared by the workflows' gate (gate.mjs) and the robots'
 * server (scripts/robots) so both obey the owner and «دولة المنصة» the same way. Plain JS, no dependencies.
 *   controls    — src/data/owner/controls.json (changed only from the owner's GitHub account)
 *   stateOrders — src/data/owner/state-orders.json (the State's pauses; the owner's «رجّع» clears them)
 *   live        — false for branch rehearsals and pull-request checks (they always run)
 */
export function ownerDecision(bots, controls = {}, stateOrders = {}, live = true) {
  const paused = Array.isArray(controls?.paused) ? bots.filter((b) => controls.paused.includes(b)) : [];
  const byState = Array.isArray(stateOrders?.paused) ? bots.filter((b) => stateOrders.paused.includes(b)) : [];
  const frozen = controls?.frozen === true;
  const stopped = Boolean(live) && (frozen || paused.length > 0 || byState.length > 0);
  const why = frozen ? 'كل الروبوتات موقوفة بأمر صاحب الموقع (فرامل الطوارئ)'
    : paused.length ? `موقوف بأمر صاحب الموقع: ${paused.join('، ')}` : `موقوف بأمر دولة المنصة: ${byState.join('، ')}`;
  const who = frozen || paused.length ? 'صاحب الموقع' : 'دولة المنصة أو صاحب الموقع';
  return { allowed: !stopped, by: !stopped ? undefined : frozen ? 'frozen' : paused.length ? 'owner' : 'state', why: stopped ? why : '', who };
}
