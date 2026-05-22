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
import { InnerBlocks, useInnerBlocksProps } from '@wordpress/block-editor';
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
 * <Repeater> replacement — InnerBlocks locked to the allowedBlocks plus an Add button.
 */
function RepeaterTag({ clientId, allowedBlocks, addButtonLabel, min, max, defaultChildren, template }) {
	const innerBlocksProps = useInnerBlocksProps(
		{ className: 'gcb-repeater__items' },
		{
			allowedBlocks: allowedBlocks === 'all' ? undefined : allowedBlocks,
			templateLock: false,
			renderAppender: false,
			template,
		}
	);

	const { insertBlock } = useDispatch('core/block-editor');
	const childOrder = useSelect(
		(select) => select('core/block-editor').getBlockOrder(clientId),
		[clientId]
	);
	const childCount = childOrder.length;

	const canAddMore = !max || childCount < max;
	const firstAllowed = Array.isArray(allowedBlocks) ? allowedBlocks[0] : null;

	const addItem = () => {
		if (!firstAllowed) return;
		insertBlock(createBlock(firstAllowed), childCount, clientId, false);
	};

	return (
		<div className="gcb-repeater">
			<div {...innerBlocksProps} />
			{canAddMore && firstAllowed && (
				<div className="gcb-repeater__appender">
					<Button variant="primary" onClick={addItem}>
						{addButtonLabel || __('Add item', 'gcblite')}
					</Button>
				</div>
			)}
		</div>
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
