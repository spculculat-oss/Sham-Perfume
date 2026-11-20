// Both the server and the browser enforce the same publisher-media contract. The photo is
// an optional illustration from a confirmed Commons file, never an arbitrary feed thumbnail.
export const HEADLINE_PHOTO_LICENSES = {
  'by/2.0': 'CC BY 2.0',
  'by/2.5': 'CC BY 2.5',
  'by/3.0': 'CC BY 3.0',
  'by/4.0': 'CC BY 4.0',
  'by-sa/2.0': 'CC BY-SA 2.0',
  'by-sa/2.5': 'CC BY-SA 2.5',
  'by-sa/3.0': 'CC BY-SA 3.0',
  'by-sa/4.0': 'CC BY-SA 4.0',
} as const;
export type HeadlinePhotoLicense = keyof typeof HEADLINE_PHOTO_LICENSES;
export interface HeadlinePhoto {
  url: string;
  source: string;
  license: HeadlinePhotoLicense;
  credit: string;
  alt: string;
}

export const cleanHeadlineText = (input: unknown, max = 400) => typeof input === 'string'
  ? input.replace(/[\s\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]+/g, ' ').trim().slice(0, max) : '';
const raster = /\.(?:jpe?g|png|webp)$/i;

function httpsUrl(input: unknown): URL | undefined {
  if (typeof input !== 'string' || input.length > 1800) return;
  try {
    const url = new URL(input);
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port) return url;
  } catch { /* invalid URL */ }
}

export function headlinePhotoLicense(input: unknown): HeadlinePhotoLicense | undefined {
  const url = httpsUrl(input);
  if (url?.hostname !== 'creativecommons.org') return;
  const id = /^\/licenses\/([a-z-]+\/\d\.\d)(?:\/deed(?:\.[\w-]+)?)?\/?$/i.exec(url.pathname)?.[1];
  if (id && Object.hasOwn(HEADLINE_PHOTO_LICENSES, id)) return id as HeadlinePhotoLicense;
}

// Commons treats underscores as spaces, normalizes Unicode and capitalizes only the first letter.
export function commonsFileTitle(encodedName: string): string | undefined {
  try {
    const name = decodeURIComponent(encodedName).normalize('NFC').replace(/[ _]+/g, ' ').trim();
    if (name.length > 200 || !raster.test(name) || /[\u0000-\u001f\u007f/\\|<>[\]{}#?]/.test(name)) return;
    return `File:${name[0].toUpperCase()}${name.slice(1)}`;
  } catch { /* invalid escapes */ }
}

export function headlineCommonsFile(input: unknown): { url: string; title: string } | undefined {
  const url = httpsUrl(input);
  if (url?.hostname !== 'commons.wikimedia.org' || !url.pathname.startsWith('/wiki/File:')) return;
  const title = commonsFileTitle(url.pathname.slice('/wiki/File:'.length));
  if (!title) return;
  return { url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title.slice(5).replace(/ /g, '_'))}`, title };
}

export function readHeadlinePhoto(input: unknown): HeadlinePhoto | undefined {
  if (!input || typeof input !== 'object') return;
  const raw = input as Partial<HeadlinePhoto>;
  const source = headlineCommonsFile(raw.source);
  const url = httpsUrl(raw.url);
  const credit = cleanHeadlineText(raw.credit, 240);
  if (!source || !url || !['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(url.hostname) || !credit
    || typeof raw.license !== 'string' || !Object.hasOwn(HEADLINE_PHOTO_LICENSES, raw.license)) return;
  const path = /^\/wikipedia\/commons\/(thumb\/)?[a-f0-9]\/[a-f0-9]{2}\/([^/]+)(?:\/[1-9]\d{1,3}px-([^/]+))?$/i.exec(url.pathname);
  if (!path || commonsFileTitle(path[2]) !== source.title || Boolean(path[1]) !== Boolean(path[3])
    || (path[3] && commonsFileTitle(path[3]) !== source.title)) return;
  // Do not send the Commons tracking parameters from the imageinfo response to the browser.
  url.search = '';
  url.hash = '';
  return { url: url.href, source: source.url, license: raw.license, credit, alt: cleanHeadlineText(raw.alt, 240) };
}
