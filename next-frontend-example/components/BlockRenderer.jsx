import { getComponentBySlug } from '@/wordpress/config/wpBlockHelpers';
import { renderBlocksViaPlugin } from '@/lib/wpRestClient';

/**
 * Walk a parsed block tree and render each one.
 *
 * Rules per block:
 *   - gcb/* with a React component in WP_BLOCK_REGISTRY → render the component
 *   - gcb/* without a React component               → fetch HTML from the
 *                                                     plugin's /render-batch
 *                                                     (which falls back to
 *                                                     render.php or the
 *                                                     component server again)
 *   - core blocks                                   → use the parser's
 *                                                     innerHTML directly
 *   - blank/whitespace blocks                       → skip
 *
 * This is a server component — fetching happens during SSR, not on the client.
 */
export default async function BlockRenderer({ blocks, blockDefaults = {} }) {
  if (!blocks?.length) return null;

  // Merge the registered defaults under the saved attrs. WP only persists
  // values that differ from defaults, so without this the React components
  // see `undefined` for any default-valued field.
  const withDefaults = (block) => {
    if (!block?.blockName) return block;
    const defaults = blockDefaults[block.blockName];
    if (!defaults) return block;
    return { ...block, attrs: { ...defaults, ...(block.attrs || {}) } };
  };

  // Apply defaults up front so both render paths see the same shape.
  const resolvedBlocks = blocks.map(withDefaults);

  // First pass: figure out which gcb blocks need an HTTP render. Group those
  // into one batched request and assign each block an index so we can stitch
  // results back in order.
  const renderRequests = [];
  const blockTags = resolvedBlocks.map((block, i) => {
    if (!block?.blockName) return { kind: 'skip' };
    if (block.blockName.startsWith('gcb/')) {
      const slug = block.blockName.slice('gcb/'.length);
      if (getComponentBySlug(slug)) {
        return { kind: 'react', slug };
      }
      const requestIndex = renderRequests.length;
      renderRequests.push({
        clientId: `block-${i}`,
        blockName: block.blockName,
        attributes: block.attrs || {},
        innerBlocks: block.innerBlocks || [],
      });
      return { kind: 'remote', requestIndex };
    }
    return { kind: 'core' };
  });

  // Second pass: one batched call for everything that needs it.
  let remoteResults = {};
  if (renderRequests.length > 0) {
    remoteResults = await renderBlocksViaPlugin(renderRequests);
  }

  return (
    <>
      {resolvedBlocks.map((block, i) => {
        const tag = blockTags[i];

        if (tag.kind === 'skip') return null;

        if (tag.kind === 'react') {
          const Entry = getComponentBySlug(tag.slug);
          const Component = Entry.frontend || Entry;
          return (
            <Component
              key={i}
              attributes={block.attrs || {}}
              innerBlocks={block.innerBlocks || []}
            />
          );
        }

        if (tag.kind === 'remote') {
          const html = remoteResults[`block-${i}`] || '';
          if (!html.trim()) return null;
          return (
            /* eslint-disable-next-line react/no-danger */
            <div key={i} dangerouslySetInnerHTML={{ __html: html }} />
          );
        }

        // Core block.
        const html = block.innerHTML || (block.innerContent || []).filter(Boolean).join('');
        if (!html.trim()) return null;
        return (
          /* eslint-disable-next-line react/no-danger */
          <div key={i} dangerouslySetInnerHTML={{ __html: html }} />
        );
      })}
    </>
  );
}
