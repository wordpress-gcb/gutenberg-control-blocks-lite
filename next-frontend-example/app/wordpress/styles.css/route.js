/**
 * Stable URL for WordPress (and anything else) to consume the component
 * server's CSS bundle.
 *
 *   GET /wordpress/styles.css
 *
 * Reads Next.js's build manifest to find whatever CSS file the layout entry
 * is currently using (fingerprinted in prod, plain-named in dev) and 302s
 * the caller to it. The plugin only needs to know this one URL — the
 * redirect handles the fingerprint churn that happens on every prod build.
 *
 * If the manifest isn't available yet (very first dev start, before any
 * page has been requested), fall back to the known unfingerprinted dev
 * path.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

const FALLBACK = '/_next/static/css/app/layout.css';

export async function GET() {
  let cssPath = FALLBACK;

  try {
    const manifestPath = path.join(process.cwd(), '.next', 'app-build-manifest.json');
    const raw = await readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(raw);
    const layoutAssets = manifest?.pages?.['/layout'] || [];
    const css = layoutAssets.find((p) => p.endsWith('.css'));
    if (css) cssPath = '/_next/' + css.replace(/^\//, '');
  } catch {
    // Manifest not ready yet — fall back.
  }

  // 302 + no-store so each request re-resolves. The fingerprint changes per
  // build in prod; we don't want a stale Location stuck in browser cache.
  return new Response(null, {
    status: 302,
    headers: {
      Location: cssPath,
      'Cache-Control': 'no-store',
    },
  });
}
