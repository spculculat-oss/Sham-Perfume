/**
 * Sends one of the owner's answers to his desk: opens a GitHub request from his own account with the request inside
 * (src/utils/ownerDesk.ts). When the request is too long for a link it goes through the clipboard.
 */
import { T } from './adminL10n';
import { CHANGE_LIMITS, encodePayload, newIssueUrl } from '../utils/ownerFiles';
import { deskIssue, type DeskDraft } from '../utils/ownerDesk';

/** Returns a note for the owner when he has to paste (empty when the link carried everything). */
export async function sendDeskRequest({ title, lines, payload }: DeskDraft): Promise<string> {
  const issue = deskIssue(title, lines, await encodePayload(payload));
  let url = newIssueUrl(issue.title, issue.body);
  let note = '';
  if (url.length > CHANGE_LIMITS.urlChars) {
    await navigator.clipboard.writeText(issue.body);
    url = newIssueUrl(issue.title, T('امسح السطر ده والصق التعديل هنا (Ctrl+V)، وبعدين اضغط (Submit new issue = إنشاء الطلب).'));
    note = T('التعديل كبير على اللينك، فنسخته لك. في صفحة GitHub امسح السطر اللي مكتوب والصق مكانه (Ctrl+V).');
  }
  window.open(url, '_blank', 'noopener');
  return note;
}
