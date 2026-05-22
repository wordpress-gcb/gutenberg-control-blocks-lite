/**
 * Public-frontend catch-all. Resolves the URL slug to a WordPress page (or
 * post), parses the block markup, and renders the tree.
 *
 * Routes the route doesn't handle (because Next.js picks more-specific ones
 * first):
 *   - /                              → handled by app/page.jsx
 *   - /wordpress/render/{block}      → handled by app/wordpress/render/[block]
 */

import { notFound } from 'next/navigation';
import {
  getPageBySlug,
  getPostBySlug,
  parseBlocks,
  blockSourceFromEntity,
  getBlockDefaults,
} from '@/lib/wpRestClient';
import BlockRenderer from '@/components/BlockRenderer';

export default async function CatchAllPage({ params }) {
  const { slug } = await params;

  // For nested slugs (/blog/foo) we only use the last segment — WordPress
  // slugs are flat. Pretty permalinks may include date or parent prefixes,
  // but for a smoke test against /sample-page this is enough.
  const lookupSlug = Array.isArray(slug) ? slug[slug.length - 1] : slug;

  let entity = null;
  let error = null;

  try {
    entity = await getPageBySlug(lookupSlug);
    if (!entity) {
      entity = await getPostBySlug(lookupSlug);
    }
  } catch (e) {
    error = e.message;
  }

  if (error) {
    return (
      <main className="max-w-3xl mx-auto p-8">
        <div className="bg-red-50 border border-red-300 text-red-700 p-4 rounded">
          <p className="font-medium">Couldn't reach WordPress</p>
          <p className="text-sm mt-1">{error}</p>
          <p className="text-sm mt-2">
            Set <code>NEXT_PUBLIC_WP_URL</code> in <code>.env.local</code> to your WP URL.
          </p>
        </div>
      </main>
    );
  }

  if (!entity) {
    notFound();
  }

  // Walk blocks_raw rather than dumping content.rendered. That way React-
  // registry blocks render as components, gcb/* blocks with render.php go
  // through the plugin, and core blocks fall back to their saved HTML.
  const source = blockSourceFromEntity(entity);
  const blocks = parseBlocks(source);

  // WP only persists attrs that differ from defaults, so we need to pull
  // defaults explicitly. Fetched once, shared across BlockRenderer.
  const blockDefaults = await getBlockDefaults();

  return (
    <main className="max-w-5xl mx-auto p-8">
      <h1 className="text-4xl font-semibold mb-6">{entity.title?.rendered || ''}</h1>
      <BlockRenderer blocks={blocks} blockDefaults={blockDefaults} />
    </main>
  );
}
