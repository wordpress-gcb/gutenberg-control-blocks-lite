/**
 * Repeater — switches output based on which prop you pass.
 *
 *   <Repeater blocks={[...]} ... />     → render the blocks as React components
 *                                          (public frontend path)
 *   <Repeater html="..." ... />          → render pre-rendered HTML
 *                                          (e.g. core blocks rendered by WP)
 *   <Repeater /> (no children/blocks)    → emit a <repeater> marker tag
 *                                          (editor preview path — gcb-lite's
 *                                          parse-preview.js swaps this for a
 *                                          real InnerBlocks UI with an Add
 *                                          button)
 *
 * Lowercase `<repeater>` is intentional: React passes lowercase elements
 * through to the DOM as-is rather than treating them as components. The
 * HTML lowercases attribute names automatically, which is why we lowercase
 * them here too — `parse-preview.js` looks at `attribs.allowedblocks`, not
 * `allowedBlocks`.
 *
 * Mirrors the pattern used in the bigger ~/sites/component-server/ setup.
 */

import BlockRenderer from './BlockRenderer';

export default function Repeater({
  blocks,
  children,
  html,
  blockDefaults = {},
  // Editor-side configuration. Only used in the marker mode.
  allowedBlocks = null,
  addButtonLabel = null,
  min = null,
  max = null,
  defaultChildren = null,
}) {
  // Frontend: caller already gave us React children. Just render them.
  if (children) {
    return <>{children}</>;
  }

  // Frontend: caller gave us a parsed blocks array. Recurse.
  if (Array.isArray(blocks) && blocks.length > 0) {
    return <BlockRenderer blocks={blocks} blockDefaults={blockDefaults} />;
  }

  // Frontend fallback: caller gave us pre-rendered HTML.
  if (html) {
    /* eslint-disable-next-line react/no-danger */
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }

  // Editor preview: emit the marker. parse-preview.js finds <repeater>,
  // reads the attributes, and renders a real InnerBlocks UI in its place.
  const attrs = {};
  if (allowedBlocks)    attrs.allowedblocks    = JSON.stringify(allowedBlocks);
  if (addButtonLabel)   attrs.addbuttonlabel   = addButtonLabel;
  if (min != null)      attrs.min              = min;
  if (max != null)      attrs.max              = max;
  if (defaultChildren != null) attrs.defaultchildren = defaultChildren;

  // Non-self-closing on purpose — gcb-lite's InnerBlocks UI needs a real
  // start+end pair, not just a void marker.
  return <repeater {...attrs}></repeater>;
}
