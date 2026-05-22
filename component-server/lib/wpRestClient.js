/**
 * Talks to the gcblitewp WordPress install over the core REST API.
 * We don't use any gcb-specific endpoints here — /wp/v2/pages already returns
 * everything we need (raw block markup + per-block rendered HTML).
 */

import { parse } from '@wordpress/block-serialization-default-parser';

const WP_URL = process.env.NEXT_PUBLIC_WP_URL || 'http://gcblitewp.test';
const API_BASE = `${WP_URL}/wp-json/wp/v2`;

export async function getPageBySlug(slug) {
  const res = await fetch(`${API_BASE}/pages?slug=${encodeURIComponent(slug)}&_embed=1`, {
    // Soft cache during dev so editing in WP shows up within a minute.
    next: { revalidate: 30 },
  });

  if (!res.ok) {
    throw new Error(`WP REST returned ${res.status} for slug=${slug}`);
  }

  const pages = await res.json();
  return pages[0] || null;
}

export async function getPostBySlug(slug) {
  const res = await fetch(`${API_BASE}/posts?slug=${encodeURIComponent(slug)}&_embed=1`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`WP REST returned ${res.status} for slug=${slug}`);
  const posts = await res.json();
  return posts[0] || null;
}

/**
 * Pull the right block source off a WP REST entity. Prefers the plugin's
 * `blocks_raw` field (registered by GCBLite\RestAPI\RawBlocksField) which
 * keeps the block comments needed to identify gcb/* blocks by name.
 * Currently unused by the page route — we render content.rendered directly
 * — but kept here for the React-component-swap iteration.
 */
export function blockSourceFromEntity(entity) {
  if (!entity) return '';
  return entity.blocks_raw || entity.content?.rendered || '';
}

/**
 * Turn raw block markup into a tree of:
 *   { blockName, attrs, innerBlocks, innerHTML, innerContent }
 */
export function parseBlocks(content) {
  if (!content) return [];
  return parse(content);
}

/**
 * Fetch the attribute defaults for every registered gcb/* block. Used by
 * the page renderer to fill in attrs WordPress didn't persist (it only
 * stores values that differ from the default).
 *
 * @returns {Promise<Record<string, Record<string, any>>>} block name → { attrKey: default }
 */
export async function getBlockDefaults() {
  const res = await fetch(`${WP_URL}/wp-json/gcblite/v1/blocks`, {
    next: { revalidate: 300 }, // schemas barely change; cache 5 min
  });
  if (!res.ok) return {};
  const data = await res.json();
  const out = {};
  for (const [name, info] of Object.entries(data?.blocks || {})) {
    const defaults = {};
    for (const [k, v] of Object.entries(info?.attributes || {})) {
      // null defaults from core "lock/style/className" attrs aren't useful —
      // skip so they don't override real values further up the chain.
      if (v?.default !== null && v?.default !== undefined) {
        defaults[k] = v.default;
      }
    }
    out[name] = defaults;
  }
  return out;
}

/**
 * Ask the plugin to render gcb/* blocks that this component server doesn't
 * have a React component for. The plugin's render-batch endpoint falls back
 * to render.php (for blocks that have one) or recursively to the component
 * server (for blocks that don't). Either way we get HTML back per clientId.
 *
 * @param {Array<{clientId, blockName, attributes, innerBlocks?}>} requests
 * @returns {Promise<Record<string, string>>} map of clientId → rendered HTML
 */
export async function renderBlocksViaPlugin(requests) {
  if (!requests?.length) return {};

  const res = await fetch(`${WP_URL}/wp-json/gcblite/v1/render-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks: requests }),
    next: { revalidate: 30 },
  });

  if (!res.ok) {
    console.warn(`/render-batch returned ${res.status}`);
    return {};
  }

  const data = await res.json();
  if (!data?.success || !data?.results) return {};

  const out = {};
  for (const [clientId, result] of Object.entries(data.results)) {
    if (result?.success && result.html) out[clientId] = result.html;
  }
  return out;
}
