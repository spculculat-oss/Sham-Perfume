/**
 * The platform's contact addresses — ONE place for the whole site, the e-mails it sends and the legal pages.
 *
 * Free setup (2026-10-20): every role goes to the owner's single Gmail inbox. Roles are told apart by the
 * subject tag (for example «[شام | الدعم]»), so the owner can filter them in Gmail with one rule per tag.
 * When a real domain is bought later, change the addresses here only (and SHAM_MAIL_DOMAIN on the server).
 *
 * No invented addresses: a test fails if the old placeholder domains come back anywhere in the code or docs.
 */
export const STORE_EMAIL = 's.p.culculat@gmail.com';

export const STORE_NAME = { ar: 'شام للعطور', en: 'Sham Perfumes' } as const;

export const CONTACT_ROLES = ['support', 'orders', 'privacy', 'dpo', 'legal', 'security'] as const;
export type ContactRole = typeof CONTACT_ROLES[number];

/** Who handles what. All roles share one inbox in the free setup; the tag keeps them apart. */
export const CONTACT: Record<ContactRole, { email: string; ar: string; en: string }> = {
  support: { email: STORE_EMAIL, ar: 'الدعم', en: 'Support' },
  orders: { email: STORE_EMAIL, ar: 'الطلبات', en: 'Orders' },
  privacy: { email: STORE_EMAIL, ar: 'الخصوصية', en: 'Privacy' },
  dpo: { email: STORE_EMAIL, ar: 'حماية البيانات', en: 'Data protection' },
  legal: { email: STORE_EMAIL, ar: 'القانوني', en: 'Legal' },
  security: { email: STORE_EMAIL, ar: 'الأمان', en: 'Security' },
};

export const contactEmail = (role: ContactRole = 'support') => CONTACT[role].email;

/** The subject tag Gmail filters can match, e.g. «[شام | الخصوصية]» / «[Sham | Privacy]». */
export const contactTag = (role: ContactRole, lang: string = 'ar') =>
  lang === 'ar' ? `[شام | ${CONTACT[role].ar}]` : `[Sham | ${CONTACT[role].en}]`;

/** A ready mailto: link with the role's tag (and optional subject/body) — works on GitHub Pages with no server. */
export function contactMailto(role: ContactRole, lang: string = 'ar', subject = '', body = ''): string {
  const fullSubject = `${contactTag(role, lang)}${subject.trim() ? ` ${subject.trim()}` : ''}`;
  const params = [`subject=${encodeURIComponent(fullSubject)}`];
  if (body.trim()) params.push(`body=${encodeURIComponent(body.trim())}`);
  return `mailto:${contactEmail(role)}?${params.join('&')}`;
}

/** Mailbox providers whose domain can never be «our» domain (no handle@gmail.com reply addresses, ever). */
export const PUBLIC_MAIL_DOMAINS = ['gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'icloud.com', 'proton.me', 'protonmail.com', 'aol.com', 'yandex.com', 'mail.ru'];
export const isPublicMailDomain = (domain: string) => PUBLIC_MAIL_DOMAINS.includes(domain.trim().toLowerCase());
