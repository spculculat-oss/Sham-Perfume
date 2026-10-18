/**
 * Keeps the SPA's head in sync with the open tab. Search engines mostly see the static tool pages
 * (tools/*.html) and product pages; this is for sharing, for the browser tab, and for crawlers that
 * render JavaScript. Canonical points at the static page of the tab, never at a hash URL.
 */
import { useEffect } from 'react';
import { absoluteUrl } from '../seo/site';
import { tabSeo } from '../seo/pages';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}
function upsertLink(rel: string, href: string) {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
}

export function useSeo(tab: string, extra?: { title?: string; description?: string; path?: string }) {
  useEffect(() => {
    const page = tabSeo(tab);
    const title = extra?.title || page.title;
    const description = extra?.description || page.description;
    // The deployment serving the app is the origin visitors (and crawlers that execute JS) actually see.
    const base = `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;
    const canonical = page.path ? absoluteUrl(page.path, base) : extra?.path ? absoluteUrl(extra.path, base) : base;
    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', 'index,follow,max-image-preview:large');
    upsertLink('canonical', canonical);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:locale', 'ar_EG');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
  }, [tab, extra?.title, extra?.description, extra?.path]);
}
