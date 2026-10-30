/**
 * Owner-only queue for the WorldFirst rail behind Sham Bank.
 * It records how a confirmed sale would split. It does not call WorldFirst and does not mark anything sent.
 */
import { ValidationError } from '../core/repository';
import type { Store } from '../core/store';
import { isAccountCurrency } from '../../src/bank/shamAccount';
import { toMinor } from '../../src/finance/money';
import {
  prepareSaleSettlement,
  worldFirstApiConfigured,
  worldFirstSnapshot,
  type SaleSettlement,
} from '../../src/bank/worldFirstRail';

function isSettlement(value: SaleSettlement | undefined): value is SaleSettlement {
  return Boolean(value && value.id && value.status === 'queued' && value.sent === false && value.externalRef === ''
    && Number.isSafeInteger(value.customerPaidMinor) && Number.isSafeInteger(value.profitMinor)
    && value.legs.every((leg) => leg.status === 'queued' && leg.sent === false));
}

export class WorldFirstRail {
  constructor(private store: Store, private now: () => string, private env: Record<string, string | undefined>) {}

  async snapshot() {
    const items = (await this.store.list('shamSettlement')).filter(isSettlement);
    return { ...worldFirstSnapshot(worldFirstApiConfigured(this.env), items.length), items };
  }

  async queue(body: Record<string, unknown> | undefined): Promise<SaleSettlement> {
    const raw = body || {};
    if ('sent' in raw || 'externalRef' in raw || 'iban' in raw || 'accountNumber' in raw) {
      throw new ValidationError('SECRET', 'لا يُقبل رقم حساب أو إشارة إرسال من المتصفح.');
    }
    const currency = String(raw.currency || '').toUpperCase();
    if (!isAccountCurrency(currency)) throw new ValidationError('INVALID_CURRENCY', 'هذه العملة ليست من أرصدة الحساب.');
    let item: SaleSettlement;
    try {
      item = prepareSaleSettlement({
        saleId: String(raw.saleId || ''),
        currency,
        customerPaidMinor: toMinor(raw.customerPaid, currency),
        merchantCostMinor: raw.merchantCost === undefined || raw.merchantCost === '' ? 0 : toMinor(raw.merchantCost, currency),
        shippingMinor: raw.shipping === undefined || raw.shipping === '' ? 0 : toMinor(raw.shipping, currency),
        at: this.now(),
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'INVALID_SALE') throw new ValidationError('INVALID_SALE', 'مرجع العملية من ٨ إلى ٤٠ حرفاً، بلا مسافات.');
      if (code === 'INVALID_CURRENCY') throw new ValidationError('INVALID_CURRENCY', 'هذه العملة ليست من أرصدة الحساب.');
      throw new ValidationError('INVALID_AMOUNT', 'مبالغ العملية غير صالحة. تكلفة التاجر والشحن لا تتجاوز ما دفعه العميل.');
    }
    const existing = await this.store.get('shamSettlement', item.id);
    if (isSettlement(existing)) {
      if (existing.customerPaidMinor !== item.customerPaidMinor || existing.merchantCostMinor !== item.merchantCostMinor || existing.currency !== item.currency) {
        throw new ValidationError('CONFLICT', 'هذه العملية مسجّلة بمبالغ مختلفة.');
      }
      return existing;
    }
    if (!(await this.store.create('shamSettlement', item.id, item))) throw new ValidationError('CONFLICT', 'تعارض في تسجيل التسوية. أعد المحاولة.');
    return item;
  }
}
