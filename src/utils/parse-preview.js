/**
 * Parses HTML produced by a block's render.php and swaps editor-only tags for
 * live React components:
 *
 *   <Repeater allowedBlocks='[...]' addButtonLabel="..." />
 *     → InnerBlocks constrained to those allowed blocks, with an Add button.
 *
 *   <InnerBlocks allowedBlocks='[...]' />
 *     → standard wp-block-editor InnerBlocks.
 *
 * Anything else passes through as plain HTML.
 */

import parse from 'html-react-parser';
import { Fragment } from '@wordpress/element';
import { InnerBlocks } from '@wordpress/block-editor';
import { Button } from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { createBlock } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';

/**
 * Read a string-shaped HTML attribute value and try to parse it as JSON.
 * Falls back to the literal string if it isn't.
 */
function parseAttrValue(raw) {
	if (raw == null) return undefined;
	if (raw === 'all') return 'all';
	const decoded = decodeHtmlEntities(raw);
	try {
		return JSON.parse(decoded);
	} catch {
		return decoded;
	}
}

function decodeHtmlEntities(s) {
	const txt = document.createElement('textarea');
	txt.innerHTML = s;
	return txt.value;
}

/**
 * <Repeater> replacement — InnerBlocks locked to allowedBlocks plus an Add
 * button.
 *
 * We render as a Fragment so the inner blocks become DIRECT children of the
 * parent React component's root element. That matters because the parent
 * usually uses display:grid / display:flex on that root and expects its
 * children to be the actual items. An earlier version wrapped everything
 * in <div class="gcb-repeater"> + <div class="gcb-repeater__items"> — two
 * extra DOM nodes the public side doesn't have — and the grid stopped
 * working in the editor.
 *
 * Using <InnerBlocks> directly (rather than useInnerBlocksProps on a div)
 * lets the inner blocks render without an explicit DOM wrapper. The Add
 * button becomes a sibling — fine inside a grid, just takes a cell.
 */
function RepeaterTag({ clientId, allowedBlocks, addButtonLabel, min, max, defaultChildren, template }) {
	const { insertBlock } = useDispatch('core/block-editor');
	const childOrder = useSelect(
		(select) => select('core/block-editor').getBlockOrder(clientId),
		[clientId]
	);
	const childCount = childOrder.length;

	const firstAllowed = Array.isArray(allowedBlocks) ? allowedBlocks[0] : null;
	const canAddMore = !max || childCount < max;

	// NOTE: seeding (defaultChildren) and the min floor are NOT handled here.
	// This component is re-parsed from the PHP-preview HTML on every refresh,
	// so any "seed once" ref resets constantly and races the remount. Seeding
	// lives in useRepeaterSeeding(), anchored to the stable PHPPreviewEdit
	// component (keyed on clientId). See src/hooks/useRepeaterSeeding.js.

	const addItem = () => {
		if (!firstAllowed) return;
		insertBlock(createBlock(firstAllowed), childCount, clientId, false);
	};

	return (
		<Fragment>
			<InnerBlocks
				allowedBlocks={allowedBlocks === 'all' ? undefined : allowedBlocks}
				templateLock={false}
				renderAppender={false}
				template={template}
			/>
			{canAddMore && firstAllowed && (
				<Button
					variant="secondary"
					onClick={addItem}
					className="gcb-repeater__appender"
				>
					{addButtonLabel || __('Add item', 'gcblite')}
				</Button>
			)}
		</Fragment>
	);
}

/**
 * <InnerBlocks> replacement — pass-through to the WP component.
 */
function InnerBlocksTag({ allowedBlocks, template, templateLock }) {
	return (
		<InnerBlocks
			allowedBlocks={allowedBlocks === 'all' ? undefined : allowedBlocks}
			template={template}
			templateLock={templateLock === 'false' ? false : templateLock}
		/>
	);
}

/**
 * Parse the preview HTML and return a React tree.
 */
export function parsePreview(html, { clientId } = {}) {
	if (!html) return null;

	return parse(html, {
		replace(domNode) {
			if (domNode.type !== 'tag') return;

			const name = domNode.name?.toLowerCase();

			if (name === 'repeater') {
				const a = domNode.attribs || {};
				return (
					<RepeaterTag
						clientId={clientId}
						allowedBlocks={parseAttrValue(a.allowedblocks)}
						addButtonLabel={a.addbuttonlabel}
						min={a.min ? parseInt(a.min, 10) : 0}
						max={a.max ? parseInt(a.max, 10) : 0}
						defaultChildren={a.defaultchildren ? parseInt(a.defaultchildren, 10) : 0}
						template={a.template ? parseAttrValue(a.template) : undefined}
					/>
				);
			}

			if (name === 'innerblocks') {
				const a = domNode.attribs || {};
				return (
					<InnerBlocksTag
						allowedBlocks={parseAttrValue(a.allowedblocks)}
						template={a.template ? parseAttrValue(a.template) : undefined}
						templateLock={a.templatelock}
					/>
				);
			}
		},
	});
}

/**
 * Parse the preview HTML and return:
 *   { tag, children }
 *
 * `tag` is the root element's tag name (e.g. 'section').
 * `children` is a React tree of the root's INNER content (with <repeater>
 * and <innerblocks> already swapped for their live counterparts).
 *
 * Callers use this to render the root *as* the WordPress block wrapper —
 * `<Tag {...blockProps}>{children}</Tag>` — instead of nesting the
 * component's root inside an extra `useBlockProps` div. That nesting was
 * what made grid-cols-3 stop targeting cards correctly.
 *
 * Returns null if the HTML has no parseable root element.
 */
export function parsePreviewWithRoot(html, { clientId } = {}) {
	if (!html) return null;

	const tree = parsePreview(html, { clientId });
	const flat = Array.isArray(tree) ? tree : [tree];

	// Meaningful top-level nodes = element nodes plus any non-whitespace text.
	// (Whitespace-only text between tags is layout noise, not content.)
	const meaningful = flat.filter((node) => {
		if (node && typeof node === 'object' && node.type) return true;
		if (typeof node === 'string') return node.trim() !== '';
		return false;
	});

	const elements = meaningful.filter(
		(node) => node && typeof node === 'object' && typeof node.type === 'string'
	);

	// Single-element output (the common, recommended shape): PROMOTE that
	// element to be the block wrapper itself — no extra <div> — so a parent
	// grid/flex targets the real element. This is the Tailwind-friendly path.
	if (meaningful.length === 1 && elements.length === 1) {
		const root = elements[0];
		return {
			tag: root.type,
			children: root.props?.children ?? null,
		};
	}

	// Anything else — multiple top-level nodes (e.g. a stray <style>/<script>
	// or text before the markup), or no element at all — can't be promoted to
	// a single wrapper without dropping the rest. Hand back ALL the nodes so
	// the caller renders them inside the standard blockProps container. We
	// honour "it's just HTML": nothing gets silently discarded.
	if (meaningful.length === 0) {
		return null; // nothing usable yet (first render in flight)
	}
	return { nodes: flat };
}
