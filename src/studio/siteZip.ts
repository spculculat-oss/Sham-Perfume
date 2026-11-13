/** «استوديو شاهين»: the finished site as one ZIP file, and a saved ZIP (or its site.json) opened again for editing. */
import { strToU8, strFromU8, unzipSync, zipSync } from 'fflate';
import { exportSite } from './siteRender';
import { cleanSiteSpec, type SiteSpec } from './siteSpec';

export function zipSite(spec: SiteSpec): Uint8Array {
  const files = exportSite(spec);
  const entries: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(files)) entries[name] = typeof data === 'string' ? strToU8(data) : data;
  return zipSync(entries, { level: 6 });
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
function base64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
/** A site.json text, or a ZIP made by the studio (its pictures come back too). Undefined when it is neither. */
export function openSite(data: Uint8Array | string, fallbackLang = 'ar'): SiteSpec | undefined {
  try {
    if (typeof data === 'string') return cleanSiteSpec(JSON.parse(data), fallbackLang);
    if (data[0] === 0x7b) return cleanSiteSpec(JSON.parse(strFromU8(data)), fallbackLang); // «{»
    const files = unzipSync(data, { filter: (f) => f.name === 'site.json' || f.name === 'assets/logo.svg' || /^assets\/image-\d+\.(?:png|jpe?g|webp|gif)$/.test(f.name) });
    const json = files['site.json'];
    if (!json) return undefined;
    const raw = JSON.parse(strFromU8(json), (key, value) => {
      if (key === 'src' && typeof value === 'string' && files[value]) return `data:${MIME[value.split('.').pop()!]};base64,${base64(files[value]!)}`;
      return value;
    }) as Record<string, unknown>;
    if (!raw.logo && files['assets/logo.svg']) raw.logo = strFromU8(files['assets/logo.svg']);
    return cleanSiteSpec(raw, fallbackLang);
  } catch { return undefined; }
}
