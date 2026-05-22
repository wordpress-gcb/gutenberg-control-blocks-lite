import { getComponentBySlug } from './wpBlockHelpers';

/**
 * The contract with gcb-lite's HtmlExtractor:
 *
 *   <wp-block-wrapper data-block-name="{slug}" data-cache-timestamp="{ts}">
 *     ...component HTML...
 *   </wp-block-wrapper>
 *
 * The plugin's PHP rewrites <wp-block-wrapper> tags into HTML comment markers
 * and extracts everything between them. Anything outside the wrapper (the
 * Next.js doctype, head, scripts, styles) is discarded.
 *
 * data-cache-timestamp lets the plugin tell when our process has restarted —
 * the same value across requests means the cached HTML is still valid.
 */
function WPBlockWrapper({ blockName, cacheTimestamp, children }) {
  return (
    <wp-block-wrapper data-block-name={blockName} data-cache-timestamp={cacheTimestamp}>
      {children}
    </wp-block-wrapper>
  );
}

export function renderWordPressBlockWithMarkers(blockSlug, attributes, innerBlocks, innerHtml, cacheTimestamp) {
  const Entry = getComponentBySlug(blockSlug);

  if (!Entry) {
    return (
      <WPBlockWrapper blockName={blockSlug} cacheTimestamp={cacheTimestamp}>
        <div className="p-4 border border-dashed border-red-400 bg-red-50 text-red-700 text-sm">
          Block not registered on component server: <code>gcb/{blockSlug}</code>
        </div>
      </WPBlockWrapper>
    );
  }

  // Components can be a single default export OR { admin, frontend }.
  // The editor preview always wants the admin variant.
  const Component = Entry.admin || Entry;

  return (
    <WPBlockWrapper blockName={blockSlug} cacheTimestamp={cacheTimestamp}>
      <Component attributes={attributes} innerBlocks={innerBlocks} innerHtml={innerHtml} />
    </WPBlockWrapper>
  );
}
