/**
 * InnerBlocks — switches output based on which prop you pass.
 *
 *   <InnerBlocks blocks={[...]} ... />     → render the blocks as React components
 *                                            (public frontend path)
 *   <InnerBlocks html="..." />              → render pre-rendered HTML
 *                                            (fallback for unrecognised content)
 *   <InnerBlocks>{children}</InnerBlocks>   → render React children directly
 *   <InnerBlocks /> (none of the above)     → emit an <innerblocks> marker tag
 *                                            (editor preview path — gcb-lite's
 *                                            parse-preview.js swaps it for a
 *                                            real WP InnerBlocks slot)
 *
 * Lowercase `<innerblocks>` is intentional. React passes lowercase tags
 * through to the DOM as-is rather than treating them as components. The
 * HTML lowercases attribute names automatically, which is why
 * parse-preview.js reads `attribs.allowedblocks`, not `allowedBlocks`.
 *
 * Mirrors the InnerBlocks component in the reference ~/sites/component-server/.
 */

import BlockRenderer from './BlockRenderer';

export default function InnerBlocks({
  blocks,
  children,
  html,
  blockDefaults = {},
  // Editor-only config. Ignored in the rendering branches.
  allowedBlocks = null,
  template = null,
  templateLock = null,
  orientation = null,
  renderAppender = null,
  placeholder = null,
}) {
  // Frontend: caller passed React children directly.
  if (children) {
    return <>{children}</>;
  }

  // Frontend: caller passed a parsed blocks array. Recurse.
  if (Array.isArray(blocks) && blocks.length > 0) {
    return <BlockRenderer blocks={blocks} blockDefaults={blockDefaults} />;
  }

  // Frontend fallback.
  if (html) {
    /* eslint-disable-next-line react/no-danger */
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }

  // Editor preview: emit the marker. parse-preview.js will swap this for a
  // standard wp-block-editor <InnerBlocks> slot.
  const attrs = {};
  if (allowedBlocks)         attrs.allowedblocks  = JSON.stringify(allowedBlocks);
  if (template)              attrs.template       = JSON.stringify(template);
  if (templateLock !== null) attrs.templatelock   = templateLock;
  if (orientation)           attrs.orientation    = orientation;
  if (renderAppender)        attrs.renderappender = renderAppender;
  if (placeholder)           attrs.placeholder    = placeholder;

  // Non-self-closing so the swap can wrap the real InnerBlocks slot in place.
  return <innerblocks {...attrs}></innerblocks>;
}
