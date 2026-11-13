/**
 * Customer Email Notification System for Sham Perfumes (شام للعطور).
 * Dispatches luxury, responsive, bilingual (Arabic & English) email notifications
 * to customers upon order/request status changes.
 *
 * Supports:
 * - Resend API (via RESEND_API_KEY)
 * - SendGrid API (via SENDGRID_API_KEY)
 * - Gmail, free (via SHAM_GMAIL_APP_PASSWORD — see server/core/mailer.ts)
 * - Outbound Webhook (via SHAM_WEBHOOK_URL)
 * - Built-in Resilient Simulator / Log buffer for zero-downtime auditing
 */
import { senderAddress, senderName, sendViaGmail } from './mailer';
import { contactEmail } from '../../src/config/contact';
import { randomUUID } from 'node:crypto';
import type { OrderItem, RequestStatus, RequestType, ServiceRequest } from './types';

export type EmailDeliveryStatus = 'sent' | 'simulated' | 'skipped' | 'failed';

export interface EmailLogEntry {
  id: string;
  requestId: string;
  orderRef: string;
  recipientEmail: string;
  customerName: string;
  status: RequestStatus;
  statusLabelAr: string;
  subject: string;
  sentAt: string;
  deliveryStatus: EmailDeliveryStatus;
  provider: string;
  error?: string;
  htmlContent: string;
  textContent: string;
}

export const STATUS_LABELS_AR: Record<RequestStatus, string> = {
  new: 'تم استلام الطلب',
  in_progress: 'قيد التنفيذ والتجهيز',
  quoted: 'تم إعداد عرض السعر',
  confirmed: 'تم تأكيد الطلب',
  completed: 'اكتمل الطلب وجاهز للتسليم',
  cancelled: 'تم إلغاء الطلب',
};

export const STATUS_LABELS_EN: Record<RequestStatus, string> = {
  new: 'Order Received',
  in_progress: 'In Progress & Compounding',
  quoted: 'Quotation Ready',
  confirmed: 'Order Confirmed',
  completed: 'Completed & Ready',
  cancelled: 'Order Cancelled',
};

export const REQUEST_TYPE_LABELS_AR: Record<RequestType, string> = {
  order: 'طلب متجر',
  custom_formula: 'عطر مخصص',
  b2b_quote: 'عرض جملة وتصنيع',
  consultation: 'استشارة عطرية',
  support: 'تذكرة دعم',
  service: 'طلب خدمة',
};

export const STATUS_ACCENT_COLORS: Record<RequestStatus, { bg: string; text: string; border: string; badge: string }> = {
  new: { bg: '#fffbeb', text: '#b45309', border: '#fcd34d', badge: '#fef3c7' },
  in_progress: { bg: '#eff6ff', text: '#1d4ed8', border: '#93c5fd', badge: '#dbeafe' },
  quoted: { bg: '#faf5ff', text: '#7e22ce', border: '#d8b4fe', badge: '#f3e8ff' },
  confirmed: { bg: '#f0fdf4', text: '#15803d', border: '#86efac', badge: '#dcfce7' },
  completed: { bg: '#ecfdf5', text: '#047857', border: '#6ee7b7', badge: '#d1fae5' },
  cancelled: { bg: '#fef2f2', text: '#b91c1c', border: '#fca5a5', badge: '#fee2e2' },
};

export const STATUS_DESCRIPTIONS_AR: Record<RequestStatus, string> = {
  new: 'نشكرك على ثقتك في شام للعطور. تم استلام طلبك بنجاح وهو الآن قيد المراجعة والتدقيق بواسطة خبرائنا.',
  in_progress: 'يسعدنا إعلامك بأن فريق شام قد بدأ العمل الفعلي على تحضير وتجهيز طلبك بعناية فائقة وفق أعلى معايير الجودة العطرية.',
  quoted: 'قام خبراؤنا بدراسة متطلباتك وإعداد عرض السعر الرسمي والمواصفات لطلبك. يسعدنا اطلاعك وموافقتك للبدء الفوري.',
  confirmed: 'تم تأكيد طلبك واعتماده رسمياً في سجلاتنا. جاري إتمام المراحل النهائية والشحن.',
  completed: 'يسرنا إبلاغك باكتمال طلبك بنجاح! تم تجهيز طلبك وجاهز للاستلام أو في طريقه إليك عبر شركة الشحن. نأمل أن تنال إبداعات شام رضاك التام.',
  cancelled: 'نحيطك علماً بأنه تم إلغاء هذا الطلب. إذا كان لديك أي استفسار أو ترغب في إعادة الطلب أو الاستفسار، يسعد فريقنا مساعدتك في أي وقت.',
};

/** In-memory ring buffer for audit and verification */
const emailLogsBuffer: EmailLogEntry[] = [];
const MAX_LOGS = 150;

export function getEmailHistory(): EmailLogEntry[] {
  return [...emailLogsBuffer].reverse();
}

export function clearEmailHistory(): void {
  emailLogsBuffer.length = 0;
}

export function recordEmailLog(entry: EmailLogEntry): void {
  emailLogsBuffer.push(entry);
  if (emailLogsBuffer.length > MAX_LOGS) {
    emailLogsBuffer.shift();
  }
}

export interface RenderEmailOptions {
  request: ServiceRequest;
  status: RequestStatus;
  customNote?: string;
  senderName?: string;
  brandTitle?: string;
  trackingBaseUrl?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  recipientEmail: string;
  customerName: string;
}

/**
 * Builds a styled, responsive, luxury HTML and plain-text email
 * matching the Sham Perfumes visual brand.
 */
export function renderOrderStatusEmail(options: RenderEmailOptions): RenderedEmail {
  const { request, status, customNote, brandTitle = 'شام للعطور — Sham Perfumes' } = options;
  const recipientEmail = request.contact.email?.trim() || '';
  const customerName = request.contact.name || 'عميلنا العزيز';
  const statusLabelAr = STATUS_LABELS_AR[status];
  const statusLabelEn = STATUS_LABELS_EN[status];
  const typeLabelAr = REQUEST_TYPE_LABELS_AR[request.type] || request.type;
  const statusDescAr = STATUS_DESCRIPTIONS_AR[status];
  const colors = STATUS_ACCENT_COLORS[status];

  const subject = `[شام للعطور] تحديث حالة طلبك ${request.ref}: ${statusLabelAr} (${statusLabelEn})`;

  const formattedDate = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const trackingQuery = `ref=${encodeURIComponent(request.ref)}&contact=${encodeURIComponent(recipientEmail || request.contact.phone || '')}`;
  const trackingUrl = options.trackingBaseUrl ? `${options.trackingBaseUrl}#track?${trackingQuery}` : `#track?${trackingQuery}`;

  // Render items rows if present
  let itemsHtml = '';
  let itemsText = '';
  if (request.items && request.items.length > 0) {
    const rows = request.items.map((item: OrderItem) => {
      const lineTotal = Math.round(item.unitPrice * item.quantity * 100) / 100;
      return `
        <tr style="border-bottom: 1px solid #e7e5e4;">
          <td style="padding: 10px 12px; text-align: right; font-weight: 500; color: #1c1917;">
            ${escapeHtml(item.name)}
            <br><span style="font-size: 11px; color: #78716c;" dir="ltr">${escapeHtml(item.sku)}</span>
          </td>
          <td style="padding: 10px 12px; text-align: center; color: #44403c;">${item.quantity}</td>
          <td style="padding: 10px 12px; text-align: left; color: #1c1917; font-family: monospace;" dir="ltr">
            ${item.unitPrice} ${escapeHtml(item.currency)}
          </td>
          <td style="padding: 10px 12px; text-align: left; font-weight: 600; color: #b45309; font-family: monospace;" dir="ltr">
            ${lineTotal} ${escapeHtml(item.currency)}
          </td>
        </tr>
      `;
    }).join('');

    itemsHtml = `
      <div style="margin: 20px 0; border: 1px solid #e7e5e4; border-radius: 12px; overflow: hidden;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background-color: #f5f5f4; color: #57534e; font-size: 12px;">
              <th style="padding: 10px 12px; text-align: right;">المنتج / المادة</th>
              <th style="padding: 10px 12px; text-align: center;">الكمية</th>
              <th style="padding: 10px 12px; text-align: left;">سعر الوحدة</th>
              <th style="padding: 10px 12px; text-align: left;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          ${request.total !== undefined ? `
            <tfoot>
              <tr style="background-color: #fafaf9; font-weight: bold; border-top: 2px solid #d6d3d1;">
                <td colspan="3" style="padding: 12px; text-align: right; color: #1c1917;">المجموع الإجمالي:</td>
                <td style="padding: 12px; text-align: left; color: #b45309; font-size: 15px; font-family: monospace;" dir="ltr">
                  ${request.total} ${escapeHtml(request.currency || '')}
                </td>
              </tr>
            </tfoot>
          ` : ''}
        </table>
      </div>
    `;

    itemsText = '\n--- تفاصيل المنتجات ---\n' +
      request.items.map((i: OrderItem) => `• ${i.name} (${i.sku}) × ${i.quantity} = ${i.unitPrice * i.quantity} ${i.currency}`).join('\n') +
      (request.total !== undefined ? `\nالإجمالي: ${request.total} ${request.currency || ''}\n` : '\n');
  }

  // Custom note block
  let noteHtml = '';
  let noteText = '';
  if (customNote && customNote.trim()) {
    noteHtml = `
      <div style="margin: 20px 0; padding: 14px 18px; background-color: #fffbeb; border-right: 4px solid #f59e0b; border-radius: 8px; color: #78350f;">
        <p style="margin: 0 0 6px 0; font-weight: bold; font-size: 13px;">💬 ملاحظة وتوجيهات خاصة من فريق العمل:</p>
        <p style="margin: 0; font-size: 13px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(customNote.trim())}</p>
      </div>
    `;
    noteText = `\n💬 ملاحظة من فريق العمل:\n${customNote.trim()}\n`;
  }

  // Fields summary (like address or preferred notes)
  let fieldsHtml = '';
  const fieldEntries = Object.entries(request.fields || {});
  if (fieldEntries.length > 0) {
    fieldsHtml = `
      <div style="margin: 16px 0; padding: 12px 16px; background-color: #f5f5f4; border-radius: 8px; font-size: 12px; color: #44403c;">
        <p style="margin: 0 0 8px 0; font-weight: bold; color: #1c1917;">تفاصيل إضافية للطلب:</p>
        <ul style="margin: 0; padding-right: 20px; line-height: 1.7;">
          ${fieldEntries.map(([k, v]) => `<li><b>${escapeHtml(k)}:</b> ${escapeHtml(String(v))}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; direction: rtl; text-align: right;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f4; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #e7e5e4;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1c1917 0%, #292524 100%); padding: 32px 24px; text-align: center; border-bottom: 3px solid #d97706;">
              <div style="display: inline-block; width: 44px; height: 44px; background: rgba(217, 119, 6, 0.15); border: 1px solid #d97706; border-radius: 12px; line-height: 44px; font-size: 24px; margin-bottom: 12px;">
                ✨
              </div>
              <h1 style="margin: 0; color: #fef3c7; font-size: 22px; font-weight: bold; letter-spacing: -0.5px;">
                ${escapeHtml(brandTitle)}
              </h1>
              <p style="margin: 6px 0 0 0; color: #a8a29e; font-size: 13px;">
                دار العطور الفاخرة وتصميم التركيبات المتخصصة
              </p>
            </td>
          </tr>

          <!-- Status Highlight Bar -->
          <tr>
            <td style="padding: 24px 28px 16px 28px;">
              <div style="background-color: ${colors.bg}; border: 1px solid ${colors.border}; border-radius: 12px; padding: 16px 20px; text-align: center;">
                <span style="display: inline-block; padding: 4px 12px; background-color: ${colors.badge}; color: ${colors.text}; font-size: 12px; font-weight: bold; border-radius: 20px; margin-bottom: 8px;">
                  ${escapeHtml(statusLabelEn.toUpperCase())}
                </span>
                <h2 style="margin: 0; color: ${colors.text}; font-size: 20px; font-weight: bold;">
                  ${escapeHtml(statusLabelAr)}
                </h2>
                <p style="margin: 8px 0 0 0; color: #44403c; font-size: 13px; line-height: 1.6;">
                  ${escapeHtml(statusDescAr)}
                </p>
              </div>
            </td>
          </tr>

          <!-- Order Summary Card -->
          <tr>
            <td style="padding: 8px 28px 20px 28px;">
              <p style="margin: 0 0 16px 0; color: #1c1917; font-size: 15px; font-weight: 600;">
                مرحباً <b>${escapeHtml(customerName)}</b> 👋
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafaf9; border-radius: 12px; border: 1px solid #f5f5f4; font-size: 13px; color: #44403c;">
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #f0eee9; width: 40%; font-weight: 600; color: #78716c;">رقم مرجع الطلب:</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #f0eee9; font-weight: bold; color: #b45309; font-family: monospace; font-size: 15px;" dir="ltr">${escapeHtml(request.ref)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #f0eee9; font-weight: 600; color: #78716c;">نوع الخدمة / الطلب:</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #f0eee9; font-weight: 500; color: #1c1917;">${escapeHtml(typeLabelAr)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #f0eee9; font-weight: 600; color: #78716c;">تاريخ التحديث:</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #f0eee9; color: #57534e;">${formattedDate}</td>
                </tr>
                ${request.contact.phone ? `
                <tr>
                  <td style="padding: 12px 16px; font-weight: 600; color: #78716c;">رقم الهاتف المسجل:</td>
                  <td style="padding: 12px 16px; color: #1c1917;" dir="ltr">${escapeHtml(request.contact.phone)}</td>
                </tr>
                ` : ''}
              </table>

              ${noteHtml}
              ${itemsHtml}
              ${fieldsHtml}

              <!-- Track Button -->
              <div style="text-align: center; margin: 28px 0 16px 0;">
                <a href="${trackingUrl}" style="display: inline-block; background: linear-gradient(135deg, #d97706 0%, #b45309 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: bold; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.3);">
                  🔍 تتبع حالة طلبك بالتفصيل
                </a>
                <p style="margin: 8px 0 0 0; font-size: 11px; color: #a8a29e;">
                  يمكنك أيضاً متابعة الطلب من خلال مساعد شام الذكي على مدار الساعة.
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f5f5f4; padding: 24px 28px; border-top: 1px solid #e7e5e4; text-align: center; color: #78716c; font-size: 12px; line-height: 1.6;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #44403c;">
                شام للعطور — تصميم وتركيب العطور الفاخرة
              </p>
              <p style="margin: 0 0 8px 0;">
                إذا كانت لديك أي استفسارات أو ترغب في تعديل تفاصيل طلبك، يمكنك الرد على هذه الرسالة أو التواصل معنا عبر مساعد الموقع.
              </p>
              <p style="margin: 0; font-size: 11px; color: #a8a29e;" dir="ltr">
                © ${new Date().getFullYear()} Sham Perfumes. All rights reserved. Ref: ${escapeHtml(request.ref)}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
${brandTitle}
=======================================
تحديث حالة طلبك: ${request.ref}
الحالة الجديدة: ${statusLabelAr} (${statusLabelEn})
=======================================

مرحباً ${customerName}،

${statusDescAr}

تفاصيل الطلب:
• رقم الطلب: ${request.ref}
• نوع الطلب: ${typeLabelAr}
• التاريخ: ${formattedDate}
${request.contact.phone ? `• الهاتف: ${request.contact.phone}` : ''}
${noteText}
${itemsText}

يمكنك تتبع طلبك في أي وقت عبر الرابط:
${trackingUrl}

فريق شام للعطور — تصميم وتركيب العطور الفاخرة
© ${new Date().getFullYear()} Sham Perfumes.
  `.trim();

  return {
    subject,
    html,
    text,
    recipientEmail,
    customerName,
  };
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface SendStatusEmailResult {
  success: boolean;
  delivery: EmailDeliveryStatus;
  provider: string;
  recipient: string;
  orderRef: string;
  error?: string;
}

/**
 * Dispatches the customer status notification email.
 * Evaluates provider configuration (Resend, SendGrid, Gmail, Webhook, Simulator).
 */
export async function sendCustomerStatusEmail(
  options: RenderEmailOptions,
  env: Record<string, string | undefined> = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<SendStatusEmailResult> {
  const { request, status } = options;
  const recipient = request.contact.email?.trim() || '';

  if (!recipient || !recipient.includes('@')) {
    return {
      success: false,
      delivery: 'skipped',
      provider: 'none',
      recipient: recipient || 'none',
      orderRef: request.ref,
      error: 'العميل لم يقم بتسجيل بريد إلكتروني في بيانات الطلب',
    };
  }

  const rendered = renderOrderStatusEmail(options);
  const fromName = options.senderName || senderName(env);
  const fromAddress = senderAddress(env);
  const fromHeader = `${fromName} <${fromAddress}>`;

  let delivery: EmailDeliveryStatus = 'simulated';
  let provider = 'simulator';
  let sendError: string | undefined;

  // 1. Check Resend
  const resendApiKey = env.RESEND_API_KEY?.trim();
  if (resendApiKey) {
    provider = 'resend';
    try {
      const response = await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: fromHeader,
          to: [recipient],
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        delivery = 'sent';
      } else {
        const errorData = await response.json().catch(() => null);
        delivery = 'failed';
        sendError = `Resend error (${response.status}): ${JSON.stringify(errorData)}`;
      }
    } catch (err: any) {
      delivery = 'failed';
      sendError = `Resend request failed: ${err?.message || err}`;
    }
  }

  // 2. Check SendGrid if not handled by Resend
  const sendgridApiKey = env.SENDGRID_API_KEY?.trim();
  if (delivery !== 'sent' && sendgridApiKey) {
    provider = 'sendgrid';
    try {
      const response = await fetchFn('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sendgridApiKey}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: recipient, name: rendered.customerName }] }],
          from: { email: fromAddress, name: fromName },
          subject: rendered.subject,
          content: [
            { type: 'text/plain', value: rendered.text },
            { type: 'text/html', value: rendered.html },
          ],
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (response.status >= 200 && response.status < 300) {
        delivery = 'sent';
        sendError = undefined;
      } else {
        const errText = await response.text().catch(() => '');
        delivery = 'failed';
        sendError = `SendGrid error (${response.status}): ${errText}`;
      }
    } catch (err: any) {
      delivery = 'failed';
      sendError = `SendGrid request failed: ${err?.message || err}`;
    }
  }

  // 3. Gmail (free): the store's own inbox sends the update
  const gmail = delivery !== 'sent' && !resendApiKey && !sendgridApiKey
    ? await sendViaGmail({ to: [recipient], subject: rendered.subject, html: rendered.html, text: rendered.text, replyTo: contactEmail('orders') }, env)
    : undefined;
  if (gmail) {
    provider = 'gmail';
    delivery = gmail.delivered ? 'sent' : 'failed';
    sendError = gmail.error;
  }

  // 4. Fallback to Outbound Webhook if configured and direct API wasn't configured
  const webhookUrl = env.SHAM_WEBHOOK_URL?.trim();
  if (delivery !== 'sent' && !resendApiKey && !sendgridApiKey && !gmail && webhookUrl) {
    provider = 'webhook';
    try {
      const response = await fetchFn(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sham-Event': 'order.status_changed' },
        body: JSON.stringify({
          event: 'order.status_changed',
          email: {
            to: recipient,
            name: rendered.customerName,
            from: fromHeader,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            orderRef: request.ref,
            status,
          },
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        delivery = 'sent';
      }
    } catch (err: any) {
      sendError = `Webhook dispatch failed: ${err?.message || err}`;
    }
  }

  // 4. If simulator/fallback, it marks delivery as simulated (success for admin workflow)
  if (delivery !== 'sent' && !sendError && !resendApiKey && !sendgridApiKey && !gmail) {
    delivery = 'simulated';
    provider = 'simulator';
  }

  // Log in ring buffer
  recordEmailLog({
    id: randomUUID(),
    requestId: request.id,
    orderRef: request.ref,
    recipientEmail: recipient,
    customerName: rendered.customerName,
    status,
    statusLabelAr: STATUS_LABELS_AR[status],
    subject: rendered.subject,
    sentAt: new Date().toISOString(),
    deliveryStatus: delivery,
    provider,
    error: sendError,
    htmlContent: rendered.html,
    textContent: rendered.text,
  });

  return {
    success: delivery === 'sent' || delivery === 'simulated',
    delivery,
    provider,
    recipient,
    orderRef: request.ref,
    error: sendError,
  };
}
