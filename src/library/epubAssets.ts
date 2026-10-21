/** Only checked-in, explicitly published assets. Do not accept arbitrary remote URLs. */
export const READING_GUIDE = {
  id: 'SHAM-GUIDE-001',
  title: 'دليل القراءة والتوثيق في مكتبة شام',
  file: 'books/sham-reading-guide.epub',
};
export function epubAssetUrl(path: string, base: string): string {
  if (!/^books\/[a-z0-9-]+\.epub$/.test(path)) throw new Error('Invalid library asset');
  return `${base.endsWith('/') ? base : `${base}/`}${path}`;
}
