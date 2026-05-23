/**
 * GET /wordpress/render/{block-slug}?attrs={url-encoded JSON}
 *
 * Called server-to-server by the gcb-lite plugin whenever the editor needs to
 * preview a block (and when the public frontend renders one).
 *
 * Returns the component wrapped in <wp-block-wrapper> markers. Everything
 * outside the markers is discarded by the plugin's HtmlExtractor.
 */

import { renderWordPressBlockWithMarkers } from '@/wordpress/config/helpers';

// Stamped into every response so the plugin can spot a process restart and
// invalidate its per-block cache. Defined at module top level on purpose:
// it's set once when this route is first loaded and shared by all requests.
const SERVER_START_TIME = Date.now();

export default async function WordPressRenderBlock({ params, searchParams }) {
  const { block } = await params;
  const sp = await searchParams;

  const attrs = sp.attrs ? safeParse(sp.attrs, {}) : {};
  const innerBlocks = sp.innerBlocks ? safeParse(sp.innerBlocks, null) : null;
  const innerHtml = sp.innerHtml || null;

  return renderWordPressBlockWithMarkers(block, attrs, innerBlocks, innerHtml, SERVER_START_TIME);
}

function safeParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
