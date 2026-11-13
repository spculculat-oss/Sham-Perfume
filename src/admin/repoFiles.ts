/**
 * The site's files as the owner's room reads them for Shaheen: the public repository on GitHub (no key, nothing
 * private). The list is fetched once per tab; each file once per tab too.
 */
import { isReadablePath, rawFileUrl, treeUrl } from '../utils/ownerFiles';

const TREE_KEY = 'sham_owner_tree_v1';
const TREE_TTL = 30 * 60_000;
let treeCache: Promise<string[]> | undefined;
const fileCache = new Map<string, Promise<string | undefined>>();

/** Every file path of the site (empty when GitHub cannot be reached right now). */
export function repoTree(): Promise<string[]> {
  if (treeCache) return treeCache;
  treeCache = (async () => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(TREE_KEY) || 'null') as { at: number; paths: string[] } | null;
      if (saved && Date.now() - saved.at < TREE_TTL && Array.isArray(saved.paths)) return saved.paths;
    } catch { /* private mode */ }
    try {
      const res = await fetch(treeUrl(), { headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json() as { tree?: { path: string; type: string }[] };
      const paths = (data.tree || []).filter((t) => t.type === 'blob').map((t) => t.path);
      try { sessionStorage.setItem(TREE_KEY, JSON.stringify({ at: Date.now(), paths })); } catch { /* full */ }
      return paths;
    } catch { treeCache = undefined; return []; }
  })();
  return treeCache;
}

/** A file's text from the newest main, or undefined when it does not exist (or cannot be read now). */
export function repoFile(path: string): Promise<string | undefined> {
  if (!isReadablePath(path)) return Promise.resolve(undefined);
  let p = fileCache.get(path);
  if (!p) {
    p = fetch(rawFileUrl(path), { cache: 'no-store' }).then((r) => (r.ok ? r.text() : undefined)).catch(() => undefined);
    p.then((t) => { if (t === undefined) fileCache.delete(path); }, () => fileCache.delete(path));
    fileCache.set(path, p);
  }
  return p;
}

/** Several files at once, keeping only those that could be read. */
export async function repoFiles(paths: string[]): Promise<{ path: string; content: string }[]> {
  const out = await Promise.all(paths.map(async (path) => ({ path, content: await repoFile(path) })));
  return out.filter((f): f is { path: string; content: string } => typeof f.content === 'string');
}

/** Forget cached copies (after a change went live, the card re-reads the newest files). */
export const forgetRepoFiles = () => { fileCache.clear(); };
