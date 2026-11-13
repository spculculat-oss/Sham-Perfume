/**
 * «الربط المباشر بين وكيل شاهين وشاهين» — the owner's order (2026-10-22): «نعمل ربط مباشر بين وكيل شاهين وشاهين تحت
 * نظر دولة المنصة».
 *
 * With the link on, «وكيل شاهين» thinks with Shaheen on every question: he reads it with the conversation before it,
 * and a shopping wish is answered from the store itself (real products, notes, prices and why — what no platform
 * knows) before anything else. Everything else follows the owner's rule «طول ما هما شغالين خليه يتعلم منهم ويعتمد
 * عليهم»: the platforms answer while they work (and are learned from); the moment they stop, the agent answers —
 * the designer (with the store's close perfumes), the school's experts, the library and his memory.
 *
 * Under the State's eye (rule S-10): the State may pause the link or bring it back with an order (target
 * «agent_link»), every answer says which part of his brain wrote it (store / designer / agent) and how sure it is,
 * and the owner's orders are above the State's. Pure (browser-safe): the server, the State and the tests read it.
 */
import type { OwnerControls } from './ownerAuthority';
import type { StateOrders } from './platformState';

export const AGENT_LINK = {
  id: 'agent_link',
  nameAr: 'الربط المباشر بين وكيل شاهين وشاهين',
  nameEn: 'Direct link: Shaheen’s agent ⇄ Shaheen',
} as const;

/** Where an answer of the linked brain came from (shown to the admin, never a vendor name). */
export type LinkSource = 'store' | 'designer' | 'agent' | 'context';

/** Is the link on? Off when the State paused it or the owner stopped the chat robot (the brake stops runs, not the chat). */
export function agentLinkOn(orders: Pick<StateOrders, 'paused'> | undefined, controls?: OwnerControls): boolean {
  if (orders?.paused.includes(AGENT_LINK.id)) return false;
  if (controls?.paused.includes('chat')) return false;
  return true;
}

/** The link's state in plain Arabic (the State's room and the operations map). */
export function agentLinkStatusAr(orders: Pick<StateOrders, 'paused'> | undefined, controls?: OwnerControls): string {
  if (orders?.paused.includes(AGENT_LINK.id)) return 'موقوف بأمر دولة المنصة — شاهين بيرجع لوكيله بس لما المنصات تقف';
  if (controls?.paused.includes('chat')) return 'موقوف بأمر صاحب الموقع';
  return 'شغال تحت نظر دولة المنصة — الوكيل بيفكر مع شاهين في كل سؤال: الشراء من المتجر نفسه، وسياق المحادثة، ولما المنصات تقف بيرد هو (المصمم، المدرسة، المكتبة)';
}
