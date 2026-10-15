/**
 * Node loader hook used by `npm test`: image imports (and other static assets)
 * resolve to an empty string so data modules such as src/data/perfumeNews.ts can
 * be imported in tests. Vite still bundles the real assets for the app.
 */
const ASSET = /\.(png|jpe?g|gif|svg|webp|avif|ico|mp3|wav|woff2?|ttf|otf)$/i;

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && ASSET.test(new URL(url).pathname)) {
    return { format: 'module', shortCircuit: true, source: 'export default "";' };
  }
  return nextLoad(url, context);
}
