import { DomUtils, parseDocument } from 'htmlparser2';
import {
  cleanHeadlineText, headlineCommonsFile, headlinePhotoLicense, readHeadlinePhoto,
  type HeadlinePhoto, type HeadlinePhotoLicense,
} from '../src/utils/headlinePhoto';

export interface HeadlinePhotoCandidate { title: string; license: HeadlinePhotoLicense; alt: string }

/** Global Voices captions can link to a specific freely licensed Commons photo. No arbitrary
 * thumbnail, third-party attachment, article fetch, or HTML from a feed reaches the visitor. */
export function findGlobalVoicesPhoto(html: string): HeadlinePhotoCandidate | undefined {
  if (!html) return;
  try {
    const doc = parseDocument(html);
    const hasClass = (classes: string | undefined, name: string) => classes?.split(/\s+/).includes(name) ?? false;
    const wrappers = DomUtils.findAll((tag) => tag.name === 'figure' || hasClass(tag.attribs.class, 'wp-caption'), doc);
    for (const wrapper of wrappers) {
      const images = DomUtils.findAll((tag) => tag.name === 'img', wrapper);
      const caption = DomUtils.findOne((tag) => tag.name === 'figcaption' || hasClass(tag.attribs.class, 'wp-caption-text'), wrapper.children, false);
      if (!caption || images.length !== 1 || !images[0].attribs.src) continue;
      const links = DomUtils.findAll((tag) => tag.name === 'a' && Boolean(tag.attribs.href), caption);
      const files = links.flatMap(({ attribs }) => headlineCommonsFile(attribs.href) ?? []);
      const licenses = links.flatMap(({ attribs }) => headlinePhotoLicense(attribs.href) ?? []);
      if (files.length === 1 && licenses.length === 1) {
        return { title: files[0].title, license: licenses[0], alt: cleanHeadlineText(images[0].attribs.alt, 240) };
      }
    }
  } catch { /* A malformed or excessively nested caption is optional; keep the headline. */ }
}

export function commonsHeadlineQuery(files: readonly string[]): URL {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata', iiurlwidth: '640', iiextmetadatafilter: 'Artist|Attribution|LicenseUrl|Restrictions',
    titles: files.join('|'),
  }).toString();
  return url;
}

interface CommonsImage {
  thumburl?: unknown;
  mime?: unknown;
  descriptionurl?: unknown;
  extmetadata?: Partial<Record<'Artist' | 'Attribution' | 'LicenseUrl' | 'Restrictions', { value?: unknown }>>;
}

const plainCredit = (text: unknown) => typeof text === 'string' && text.length <= 1500
  ? cleanHeadlineText(DomUtils.textContent(parseDocument(text)), 240) : '';

/** The reusable license and the actual attribution must come from the file's own metadata.
 * A caption cannot turn an unlicensed photo into a licensed one. */
export function readCommonsHeadlinePhotos(payload: unknown): Map<string, HeadlinePhoto> {
  const data = payload as { query?: { pages?: { ns?: unknown; imagerepository?: unknown; imageinfo?: CommonsImage[] }[] } } | null;
  const photos = new Map<string, HeadlinePhoto>();
  if (!Array.isArray(data?.query?.pages)) return photos;
  for (const page of data.query.pages) {
    if (page?.ns !== 6 || page.imagerepository !== 'local' || !Array.isArray(page.imageinfo)) continue;
    const info = page.imageinfo[0];
    if (typeof info?.mime !== 'string' || !['image/jpeg', 'image/png', 'image/webp'].includes(info.mime)) continue;
    const meta = info.extmetadata;
    const restriction = meta?.Restrictions?.value;
    if (restriction != null && (typeof restriction !== 'string' || restriction.trim())) continue;
    const source = headlineCommonsFile(info.descriptionurl);
    const license = headlinePhotoLicense(meta?.LicenseUrl?.value);
    const credit = plainCredit(meta?.Attribution?.value) || plainCredit(meta?.Artist?.value);
    const photo = readHeadlinePhoto({ url: info.thumburl, source: source?.url, license, credit });
    if (source && photo) photos.set(source.title, photo);
  }
  return photos;
}
