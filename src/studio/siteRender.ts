/**
 * «استوديو شاهين»: the site data (siteSpec.ts) turned into real pages — responsive, right-to-left for Arabic,
 * readable colours (palette.ts), gentle motion that respects «reduce motion», a working menu on phones and a contact
 * form that opens the visitor's own mail app (no server needed). Everything the visitor typed is escaped.
 *   - `renderPage(spec, slug, 'preview')`: one page for the builder's preview (links between pages tell the builder);
 *   - `exportSite(spec)`: the files of the finished site (index.html, the other pages, styles.css, images, README),
 *     ready to upload to any host (GitHub Pages, Netlify, cPanel…).
 */
import { fontPair, paletteFrom } from './palette';
import type { ImageRef, Item, Page, Section, SiteSpec } from './siteSpec';

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const para = (s?: string) => (s ? s.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('') : '');
type Mode = 'preview' | 'export' | 'single';

export function siteCss(spec: SiteSpec): string {
  const p = paletteFrom(spec.theme.base, { harmony: spec.theme.harmony, dark: spec.theme.dark });
  const f = fontPair(spec.theme.font, spec.dir === 'rtl');
  const r = { sharp: '4px', soft: '14px', round: '26px' }[spec.theme.radius];
  return `:root{--primary:${p.primary};--on-primary:${p.onPrimary};--accent:${p.accent};--bg:${p.bg};--surface:${p.surface};--text:${p.text};--muted:${p.muted};--radius:${r};--heading:'${f.heading}',system-ui,sans-serif;--body:'${f.body}',system-ui,sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:var(--body);background:var(--bg);color:var(--text);line-height:1.7;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}a{color:var(--primary)}h1,h2,h3{font-family:var(--heading);line-height:1.25;margin:0 0 .6em}h1{font-size:clamp(2rem,5vw,3.6rem)}h2{font-size:clamp(1.5rem,3.2vw,2.3rem)}h3{font-size:1.15rem}
.wrap{width:min(1120px,92%);margin-inline:auto}section{padding:clamp(3rem,7vw,6rem) 0}.muted{color:var(--muted)}
.nav{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid color-mix(in srgb,var(--text) 10%,transparent)}
.nav .wrap{display:flex;align-items:center;justify-content:space-between;gap:1rem;min-height:66px}.brand{display:flex;align-items:center;gap:.6rem;font-family:var(--heading);font-weight:800;font-size:1.2rem;color:var(--text);text-decoration:none}.brand svg,.brand img{height:38px;width:auto;max-width:170px}
.links{display:flex;gap:1.4rem;list-style:none;margin:0;padding:0}.links a{color:var(--text);text-decoration:none;font-weight:600;opacity:.8}.links a:hover,.links a[aria-current]{opacity:1;color:var(--primary)}
.menu{display:none;background:none;border:0;font-size:1.6rem;color:var(--text);cursor:pointer}
@media(max-width:760px){.menu{display:block}.links{display:none;position:absolute;inset-inline:0;top:66px;flex-direction:column;background:var(--surface);padding:1rem 4%;box-shadow:0 12px 30px rgba(0,0,0,.12)}.links.open{display:flex}}
.btn{display:inline-block;background:var(--primary);color:var(--on-primary);padding:.85rem 1.6rem;border-radius:var(--radius);font-weight:700;text-decoration:none;border:0;cursor:pointer;transition:transform .2s,box-shadow .2s}.btn:hover{transform:translateY(-2px);box-shadow:0 10px 24px color-mix(in srgb,var(--primary) 35%,transparent)}
.hero{position:relative;min-height:min(82vh,760px);display:grid;align-items:center;overflow:hidden;color:#fff;padding:0}.hero .bg{position:absolute;inset:0;background:linear-gradient(135deg,var(--primary),var(--accent))}.hero .bg img{width:100%;height:100%;object-fit:cover}
.hero .bg::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.72),rgba(0,0,0,.25))}.hero .wrap{position:relative;padding:5rem 0}.hero p{font-size:clamp(1.05rem,2vw,1.3rem);max-width:640px;opacity:.95}
.grid{display:grid;gap:1.4rem;grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}.card{background:var(--surface);border-radius:var(--radius);padding:1.6rem;box-shadow:0 1px 2px rgba(0,0,0,.05),0 8px 28px rgba(0,0,0,.06);border:1px solid color-mix(in srgb,var(--text) 7%,transparent)}
.icon{font-size:2rem;margin-bottom:.5rem}.card .ph,.card img{aspect-ratio:4/3;width:100%;object-fit:cover;border-radius:calc(var(--radius) - 4px);margin-bottom:1rem}.ph{background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 70%,#fff),color-mix(in srgb,var(--accent) 70%,#fff))}
.price{font-weight:800;color:var(--primary);font-size:1.1rem}.split{display:grid;gap:2.5rem;align-items:center;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}.split img,.split .ph{border-radius:var(--radius);aspect-ratio:5/4;width:100%;object-fit:cover}
.steps{counter-reset:s}.steps .card{position:relative;padding-top:2.6rem}.steps .card::before{counter-increment:s;content:counter(s);position:absolute;top:-1rem;inset-inline-start:1.4rem;width:2.4rem;height:2.4rem;border-radius:50%;display:grid;place-items:center;background:var(--primary);color:var(--on-primary);font-weight:800}
details{background:var(--surface);border-radius:var(--radius);padding:1rem 1.3rem;margin-bottom:.8rem;border:1px solid color-mix(in srgb,var(--text) 8%,transparent)}summary{cursor:pointer;font-weight:700}
.cta{background:linear-gradient(135deg,var(--primary),var(--accent));color:var(--on-primary);text-align:center;border-radius:var(--radius)}.cta .btn{background:var(--surface);color:var(--primary)}
form{display:grid;gap:.9rem}input,textarea{font:inherit;padding:.85rem 1rem;border-radius:var(--radius);border:1px solid color-mix(in srgb,var(--text) 18%,transparent);background:var(--surface);color:var(--text)}textarea{min-height:140px}
.contact-lines{list-style:none;padding:0;display:grid;gap:.5rem}footer{padding:2.2rem 0;text-align:center;color:var(--muted);border-top:1px solid color-mix(in srgb,var(--text) 10%,transparent)}
.reveal{opacity:0;transform:translateY(18px);transition:opacity .7s ease,transform .7s ease}.reveal.in{opacity:1;transform:none}@media(prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}.btn{transition:none}}`;
}

const img = (ref: ImageRef | undefined, cls = '', mode: Mode = 'export', images?: Map<string, string>) => {
  const src = ref?.src ? (mode === 'export' && images?.get(ref.src)) || ref.src : '';
  return src ? `<img src="${esc(src)}" alt="${esc(ref?.alt || '')}" loading="lazy" onerror="this.style.visibility='hidden'"${cls ? ` class="${cls}"` : ''}>` : `<div class="ph${cls ? ` ${cls}` : ''}" role="img" aria-label="${esc(ref?.alt || '')}"></div>`;
};
const pageHref = (slug: string, mode: Mode) => (mode === 'preview' ? `#` : slug === 'index' ? 'index.html' : `${slug}.html`);
/** A link inside the site: «about.html» → the page (the preview tells the builder instead of leaving). */
function link(href: string | undefined, spec: SiteSpec, mode: Mode): string {
  const h = href || '#';
  const page = h.match(/^([a-z0-9-]+)\.html$/)?.[1];
  if (page && mode === 'preview' && spec.pages.some((p) => p.slug === page)) return `href="#" data-page="${esc(page)}"`;
  if (page && mode === 'single' && spec.pages.some((p) => p.slug === page)) return `href="#/${esc(page)}"`;
  return `href="${esc(h)}"${/^https:/.test(h) ? ' target="_blank" rel="noopener"' : ''}`;
}

function cards(items: Item[] = [], mode: Mode, images?: Map<string, string>, withImage = false): string {
  return `<div class="grid">${items.map((it) => `<article class="card reveal">${withImage ? img(it.image, '', mode, images) : ''}${it.icon ? `<div class="icon" aria-hidden="true">${esc(it.icon)}</div>` : ''}${it.title ? `<h3>${esc(it.title)}</h3>` : ''}${it.text ? `<p class="muted">${esc(it.text)}</p>` : ''}${it.price ? `<div class="price">${esc(it.price)}</div>` : ''}</article>`).join('')}</div>`;
}
export function renderSection(s: Section, spec: SiteSpec, mode: Mode = 'export', images?: Map<string, string>): string {
  const id = `id="${esc(s.id)}"`;
  const head = s.title ? `<h2 class="reveal">${esc(s.title)}</h2>` : '';
  switch (s.type) {
    case 'hero':
      return `<section class="hero" ${id}><div class="bg">${s.image?.src ? img(s.image, '', mode, images) : ''}</div><div class="wrap"><h1>${esc(s.title || spec.name)}</h1>${para(s.text)}${s.button ? `<a class="btn" ${link(s.link, spec, mode)}>${esc(s.button)}</a>` : ''}</div></section>`;
    case 'features':
      return `<section ${id}><div class="wrap">${head}${s.text ? `<div class="muted reveal">${para(s.text)}</div>` : ''}${cards(s.items, mode, images)}</div></section>`;
    case 'products': case 'gallery':
      return `<section ${id}><div class="wrap">${head}${s.text ? `<div class="muted reveal">${para(s.text)}</div>` : ''}${cards(s.items, mode, images, true)}</div></section>`;
    case 'about':
      return `<section ${id}><div class="wrap split"><div class="reveal">${head}${para(s.text)}${s.button ? `<a class="btn" ${link(s.link, spec, mode)}>${esc(s.button)}</a>` : ''}</div><div class="reveal">${img(s.image, '', mode, images)}</div></div></section>`;
    case 'steps':
      return `<section ${id}><div class="wrap">${head}<div class="grid steps">${(s.items || []).map((it) => `<article class="card reveal"><h3>${esc(it.title)}</h3><p class="muted">${esc(it.text)}</p></article>`).join('')}</div></div></section>`;
    case 'faq':
      return `<section ${id}><div class="wrap">${head}${(s.items || []).map((it) => `<details class="reveal"><summary>${esc(it.q || it.title)}</summary><p>${esc(it.a || it.text)}</p></details>`).join('')}</div></section>`;
    case 'cta':
      return `<section ${id}><div class="wrap"><div class="cta" style="padding:clamp(2rem,5vw,4rem)"><h2>${esc(s.title)}</h2>${para(s.text)}${s.button ? `<a class="btn" ${link(s.link, spec, mode)}>${esc(s.button)}</a>` : ''}</div></div></section>`;
    case 'contact': {
      const rtl = spec.dir === 'rtl';
      const words = rtl ? { name: 'الاسم', email: 'إيميلك', msg: 'رسالتك', send: 'إرسال', none: 'ضيف إيميل التواصل علشان الفورم يشتغل.' } : { name: 'Your name', email: 'Your email', msg: 'Your message', send: 'Send', none: 'Add a contact email so the form works.' };
      const lines = [s.email ? `<li>✉️ <a href="mailto:${esc(s.email)}">${esc(s.email)}</a></li>` : '', s.phone ? `<li>📞 <a href="tel:${esc(s.phone.replace(/[^\d+]/g, ''))}" dir="ltr">${esc(s.phone)}</a></li>` : '',
        s.whatsapp ? `<li>💬 <a href="https://wa.me/${esc(s.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener" dir="ltr">WhatsApp</a></li>` : '', s.address ? `<li>📍 ${esc(s.address)}</li>` : ''].join('');
      return `<section ${id}><div class="wrap split"><div class="reveal">${head}${para(s.text)}<ul class="contact-lines">${lines}</ul></div><form class="card reveal" data-mail="${esc(s.email || '')}"><input name="name" placeholder="${words.name}" required><input name="email" type="email" placeholder="${words.email}" required><textarea name="message" placeholder="${words.msg}" required></textarea><button class="btn" type="submit">${words.send}</button>${s.email ? '' : `<small class="muted">${words.none}</small>`}</form></div></section>`;
    }
    default:
      return `<section ${id}><div class="wrap reveal">${head}${para(s.text)}</div></section>`;
  }
}

const SCRIPT = (mode: Mode) => `<script>
document.querySelector('.menu')?.addEventListener('click',function(){var l=document.querySelector('.links');var o=l.classList.toggle('open');this.setAttribute('aria-expanded',o)});
var io='IntersectionObserver' in window?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12}):null;
document.querySelectorAll('.reveal').forEach(function(el){io?io.observe(el):el.classList.add('in')});
document.querySelectorAll('form[data-mail]').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();var to=f.dataset.mail;if(!to)return;var d=new FormData(f);location.href='mailto:'+to+'?subject='+encodeURIComponent(d.get('name')||'')+'&body='+encodeURIComponent((d.get('message')||'')+'\\n\\n'+(d.get('email')||''))})});
${mode === 'single' ? "function route(){var s=(location.hash.match(/^#\\/([a-z0-9-]+)/)||[])[1]||'index';var m=document.querySelector('main[data-page=\"'+s+'\"]')?s:'index';document.querySelectorAll('main[data-page]').forEach(function(x){x.hidden=x.dataset.page!==m});document.querySelectorAll('.links a').forEach(function(a){a.toggleAttribute('aria-current',a.getAttribute('href')==='#/'+m)});document.querySelectorAll('main:not([hidden]) .reveal').forEach(function(el){el.classList.add('in')});scrollTo(0,0)}addEventListener('hashchange',route);route();" : ''}
${mode === 'preview' ? "document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a');if(!a)return;var p=a.getAttribute('data-page');if(p){e.preventDefault();parent.postMessage({shamStudioPage:p},'*');return}if(a.getAttribute('href')==='#'){e.preventDefault()}else if(/^#/.test(a.getAttribute('href')||'')){e.preventDefault();var t=document.getElementById(a.getAttribute('href').slice(1));t&&t.scrollIntoView({behavior:'smooth'})}});" : ''}
</script>`;

export function renderPage(spec: SiteSpec, slug: string, mode: Mode = 'export', images?: Map<string, string>): string {
  const page: Page = spec.pages.find((p) => p.slug === slug) || spec.pages[0]!;
  const f = fontPair(spec.theme.font, spec.dir === 'rtl');
  const href = (slug: string) => (mode === 'preview' ? `href="#" data-page="${esc(slug)}"` : mode === 'single' ? `href="#/${esc(slug)}"` : `href="${pageHref(slug, mode)}"`);
  const nav = spec.pages.length > 1 || page.sections.length > 3
    ? `<ul class="links">${spec.pages.map((p) => `<li><a ${href(p.slug)}${p.slug === page.slug ? ' aria-current="page"' : ''}>${esc(p.title)}</a></li>`).join('')}</ul>` : '<span></span>';
  const css = mode === 'export' ? '<link rel="stylesheet" href="styles.css">' : `<style>${siteCss(spec)}</style>`;
  const logo = spec.logo ? spec.logo : '';
  return `<!doctype html>
<html lang="${esc(spec.lang)}" dir="${spec.dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(page.slug === 'index' ? `${spec.name}${spec.tagline ? ` — ${spec.tagline}` : ''}` : `${page.title} — ${spec.name}`)}</title>
<meta name="description" content="${esc(spec.tagline || spec.name)}"><meta property="og:title" content="${esc(spec.name)}"><meta name="theme-color" content="${esc(paletteFrom(spec.theme.base, { harmony: spec.theme.harmony, dark: spec.theme.dark }).primary)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${esc(f.css)}">
${css}
</head>
<body>
<header class="nav"><div class="wrap"><a class="brand" ${href('index')}>${logo}${esc(spec.name)}</a><button class="menu" aria-label="Menu" aria-expanded="false">☰</button><nav>${nav}</nav></div></header>
<main>
${page.sections.map((s) => renderSection(s, spec, mode, images)).join('\n')}
</main>
<footer><div class="wrap">© ${new Date().getFullYear()} ${esc(spec.name)}${spec.tagline ? ` · ${esc(spec.tagline)}` : ''}</div></footer>
${SCRIPT(mode)}
</body>
</html>`;
}

/** Every file of the finished site. Pictures made on this page (data: URLs) become files in assets/. */
export function exportSite(spec: SiteSpec): Record<string, string | Uint8Array> {
  const files: Record<string, string | Uint8Array> = {};
  const images = new Map<string, string>();
  let n = 0;
  const visit = (ref?: ImageRef) => {
    const src = ref?.src;
    if (!src || images.has(src)) return;
    const m = src.match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/);
    if (!m) return;
    n += 1;
    const name = `assets/image-${n}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
    const bin = atob(m[2]!);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    files[name] = bytes;
    images.set(src, name);
  };
  for (const page of spec.pages) for (const s of page.sections) { visit(s.image); (s.items || []).forEach((it) => visit(it.image)); }
  files['styles.css'] = siteCss(spec);
  for (const page of spec.pages) files[page.slug === 'index' ? 'index.html' : `${page.slug}.html`] = renderPage(spec, page.slug, 'export', images);
  if (spec.logo) files['assets/logo.svg'] = spec.logo;
  files['site.json'] = JSON.stringify({ ...spec, pages: spec.pages.map((p) => ({ ...p, sections: p.sections.map((s) => JSON.parse(JSON.stringify(s, (k, v) => (k === 'src' && typeof v === 'string' && images.has(v) ? images.get(v) : v)))) })) }, null, 2);
  files['README.txt'] = `${spec.name}\n\nMade with Shaheen Studio (Sham).\nUpload every file in this folder to any web host (GitHub Pages, Netlify, Cloudflare Pages, cPanel…). index.html is the home page.\nsite.json lets Shaheen Studio open and edit the site again.\n`;
  return files;
}
/** All pages in one file, switched by the address (#/about) — for «افتح في صفحة جديدة» and the code editor. */
export function singleFile(spec: SiteSpec): string {
  const first = renderPage(spec, 'index', 'single');
  const mains = spec.pages.map((p) => `<main data-page="${esc(p.slug)}"${p.slug === 'index' ? '' : ' hidden'}>\n${p.sections.map((s) => renderSection(s, spec, 'single')).join('\n')}\n</main>`).join('\n');
  return first.replace(/<main>[\s\S]*?<\/main>/, () => mains);
}
