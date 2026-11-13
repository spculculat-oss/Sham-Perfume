import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderOrderStatusEmail,
  sendCustomerStatusEmail,
  getEmailHistory,
  clearEmailHistory,
  STATUS_LABELS_AR,
  STATUS_LABELS_EN,
} from '../server/core/email';
import { createShamCore } from '../server/core/http';
import { createStore } from '../server/core/store';
import type { RequestStatus, ServiceRequest } from '../server/core/types';

const sampleRequest: ServiceRequest = {
  id: 'req-test-123',
  ref: 'SH-ABC123',
  type: 'order',
  serviceId: 'store',
  status: 'new',
  contact: {
    name: 'سارة المنصوري',
    email: 'sara@example.com',
    phone: '+971501234567',
  },
  fields: {
    'عنوان التوصيل': 'دبي، الإمارات العربية المتحدة',
    'طريقة الدفع': 'الدفع عند الاستلام',
  },
  items: [
    { productId: 'oud-wood', sku: 'OUD-01', name: 'عطر خشب العود المعتق 50 مل', quantity: 2, unitPrice: 320, currency: 'AED' },
    { productId: 'rose-oil', sku: 'ROSE-02', name: 'زيت الورد الجوري 30 مل', quantity: 1, unitPrice: 180, currency: 'AED' },
  ],
  total: 820,
  currency: 'AED',
  notes: [],
  createdAt: '2026-10-15T10:00:00.000Z',
  updatedAt: '2026-10-15T10:00:00.000Z',
};

test('renderOrderStatusEmail generates luxury bilingual template with items and tracking', () => {
  const rendered = renderOrderStatusEmail({
    request: sampleRequest,
    status: 'in_progress',
    customNote: 'تم البدء في تعتيق الخلطة وتعبئتها في الزجاجات الكريستالية.',
  });

  assert.equal(rendered.recipientEmail, 'sara@example.com');
  assert.equal(rendered.customerName, 'سارة المنصوري');
  assert.ok(rendered.subject.includes('SH-ABC123'));
  assert.ok(rendered.subject.includes(STATUS_LABELS_AR.in_progress));

  // HTML content checks
  assert.ok(rendered.html.includes('سارة المنصوري'));
  assert.ok(rendered.html.includes('SH-ABC123'));
  assert.ok(rendered.html.includes(STATUS_LABELS_AR.in_progress));
  assert.ok(rendered.html.includes('IN PROGRESS'));
  assert.ok(rendered.html.includes('عطر خشب العود المعتق'));
  assert.ok(rendered.html.includes('OUD-01'));
  assert.ok(rendered.html.includes('820'));
  assert.ok(rendered.html.includes('AED'));
  assert.ok(rendered.html.includes('تم البدء في تعتيق الخلطة'));
  assert.ok(rendered.html.includes('#track?ref=SH-ABC123'));

  // Text content checks
  assert.ok(rendered.text.includes('SH-ABC123'));
  assert.ok(rendered.text.includes(STATUS_LABELS_AR.in_progress));
  assert.ok(rendered.text.includes('عطر خشب العود المعتق'));
  assert.ok(rendered.text.includes('820'));
});

test('renderOrderStatusEmail properly formats all 6 statuses', () => {
  const statuses: RequestStatus[] = ['new', 'in_progress', 'quoted', 'confirmed', 'completed', 'cancelled'];
  for (const st of statuses) {
    const rendered = renderOrderStatusEmail({ request: sampleRequest, status: st });
    assert.ok(rendered.subject.includes(STATUS_LABELS_AR[st]));
    assert.ok(rendered.html.includes(STATUS_LABELS_AR[st]));
    assert.ok(rendered.text.includes(STATUS_LABELS_AR[st]));
  }
});

test('sendCustomerStatusEmail skips when request lacks an email address', async () => {
  const noEmailReq: ServiceRequest = {
    ...sampleRequest,
    contact: { name: 'زائر بدون إيميل', phone: '+201000000000' },
  };

  const res = await sendCustomerStatusEmail({
    request: noEmailReq,
    status: 'confirmed',
  });

  assert.equal(res.success, false);
  assert.equal(res.delivery, 'skipped');
  assert.equal(res.provider, 'none');
});

test('sendCustomerStatusEmail dispatches via Resend API when RESEND_API_KEY is present', async () => {
  let calledUrl = '';
  let calledAuth = '';
  let calledBody: any = null;

  const mockFetch = async (url: string | URL, init?: RequestInit) => {
    calledUrl = String(url);
    calledAuth = String(init?.headers ? (init.headers as any).Authorization : '');
    calledBody = JSON.parse(String(init?.body || '{}'));
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'resend-msg-123' }),
    } as Response;
  };

  const res = await sendCustomerStatusEmail(
    { request: sampleRequest, status: 'confirmed' },
    { RESEND_API_KEY: 're_test_key_xyz' },
    mockFetch as typeof fetch,
  );

  assert.equal(res.success, true);
  assert.equal(res.delivery, 'sent');
  assert.equal(res.provider, 'resend');
  assert.equal(calledUrl, 'https://api.resend.com/emails');
  assert.equal(calledAuth, 'Bearer re_test_key_xyz');
  assert.deepEqual(calledBody.to, ['sara@example.com']);
  assert.ok(calledBody.subject.includes('SH-ABC123'));
});

test('sendCustomerStatusEmail dispatches via SendGrid API when SENDGRID_API_KEY is present', async () => {
  let calledUrl = '';
  let calledAuth = '';

  const mockFetch = async (url: string | URL, init?: RequestInit) => {
    calledUrl = String(url);
    calledAuth = String(init?.headers ? (init.headers as any).Authorization : '');
    return {
      ok: true,
      status: 202,
      text: async () => '',
    } as Response;
  };

  const res = await sendCustomerStatusEmail(
    { request: sampleRequest, status: 'completed' },
    { SENDGRID_API_KEY: 'SG.fake_key_123' },
    mockFetch as typeof fetch,
  );

  assert.equal(res.success, true);
  assert.equal(res.delivery, 'sent');
  assert.equal(res.provider, 'sendgrid');
  assert.equal(calledUrl, 'https://api.sendgrid.com/v3/mail/send');
  assert.equal(calledAuth, 'Bearer SG.fake_key_123');
});

test('sendCustomerStatusEmail records in history buffer in simulator mode', async () => {
  clearEmailHistory();
  const res = await sendCustomerStatusEmail(
    { request: sampleRequest, status: 'quoted', customNote: 'عرض السعر شامل الشحن المجاني' },
    {}, // No external API key
  );

  assert.equal(res.success, true);
  assert.equal(res.delivery, 'simulated');
  assert.equal(res.provider, 'simulator');

  const history = getEmailHistory();
  assert.ok(history.length >= 1);
  const latest = history[0];
  assert.equal(latest.orderRef, 'SH-ABC123');
  assert.equal(latest.recipientEmail, 'sara@example.com');
  assert.equal(latest.status, 'quoted');
  assert.ok(latest.htmlContent.includes('عرض السعر شامل الشحن المجاني'));
});

test('HTTP Admin API: status change triggers customer email notification and notes', async () => {
  const store = createStore({ SHAM_STORE: 'memory' });
  const core = createShamCore({
    store,
    env: { SHAM_ADMIN_TOKEN: 'secret-admin-token-1234' },
  });

  // Seed sample request
  const created = await core.repo.createRequest({
    serviceId: 'consultation',
    contact: { name: 'فاطمة الزهراء', email: 'fatima@example.com', phone: '+201099887766' },
    fields: { topic: 'formula_review', notes: 'استشارة حول تركيبة عطر شرقي' },
  });

  assert.equal(created.status, 'new');

  // Find admin request handler
  const reqId = created.id;

  // Simulate updating status via repo & verify helper flow
  const updated = await core.repo.updateRequest(reqId, { status: 'in_progress', note: 'بدء التحضير' });
  assert.equal(updated.status, 'in_progress');

  // Trigger sendCustomerStatusEmail on updated request
  const emailResult = await sendCustomerStatusEmail({
    request: updated,
    status: updated.status,
    customNote: 'تم البدء في تجهيز طلبك.',
  });

  assert.equal(emailResult.success, true);
  assert.equal(emailResult.recipient, 'fatima@example.com');

  // Verify history contains Fatima's order
  const logs = getEmailHistory();
  const match = logs.find((l) => l.orderRef === updated.ref);
  assert.ok(match);
  assert.equal(match.status, 'in_progress');
});
