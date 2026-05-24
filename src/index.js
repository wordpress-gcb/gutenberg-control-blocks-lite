/**
 * GCB Lite editor entry.
 *
 * For each gcb/* block:
 *   - Register the block on the JS side so the inserter lists it.
 *   - Edit view: ask the plugin's /gcblite/v1/render-batch for HTML. The
 *     plugin runs the theme's render.php if it exists, otherwise SSR-fetches
 *     from the configured Next.js frontend. Either way we get HTML back,
 *     parse it, and swap <repeater> / <innerblocks> marker tags for live
 *     React InnerBlocks components.
 *   - Inspector panels: render from the block's block.fields.json controls.
 *   - Save: <InnerBlocks.Content /> if the block has inner content (so
 *     children are persisted), null otherwise (server-rendered).
 */

import { registerBlockType } from '@wordpress/blocks';
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { Fragment } from '@wordpress/element';
import { InnerBlocks, InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { Spinner, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { createElement } from '@wordpress/element';
import { renderInspector } from './inspector';
import { usePHPPreview } from './hooks/usePHPPreview';
import { parsePreviewWithRoot } from './utils/parse-preview';
import './editor.scss';

function registerBlocks() {
	const blocks = window.gcbLite?.blocks || {};
	Object.keys(blocks).forEach((name) => {
		registerBlockType(name, {
			edit: (props) => <PHPPreviewEdit {...props} blockName={name} />,
			save: () => <InnerBlocks.Content />,
		});
	});
}

function PHPPreviewEdit({ blockName, attributes, clientId }) {
	const { html, wrapperAttributes, loading, error } = usePHPPreview({
		blockName,
		attributes,
		clientId,
	});

	// Apply the renderer's root-element attributes to the editor wrapper so
	// the editor preview matches the frontend exactly (same classes, same
	// data-*, same inline style). { tag } is the parser's own key, not an
	// HTML attribute — drop it.
	const { tag: _tag, class: className, style, ...rest } = wrapperAttributes || {};
	const blockProps = useBlockProps({
		className,
		style: typeof style === 'string' ? parseStyle(style) : style,
		...rest,
	});

	if (loading && !html) {
		return (
			<div {...blockProps}>
				<div style={{ padding: 16, textAlign: 'center', color: '#757575' }}>
					<Spinner />
					<div style={{ fontSize: 12, marginTop: 8 }}>
						{__('Rendering preview…', 'gcblite')}
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div {...blockProps}>
				<Notice status="error" isDismissible={false}>
					<strong>{__('Preview failed:', 'gcblite')}</strong> {error}
				</Notice>
			</div>
		);
	}

	// Render the React component's OWN root element as the WordPress block
	// wrapper, rather than nesting it inside an extra <div {...blockProps}>.
	// The extra <div> used to break Tailwind layouts: a parent's grid-cols-3
	// would target the useBlockProps wrappers instead of the actual cards,
	// so children laid out in a single column. By promoting the component's
	// root to be the wrapper, the grid sees the cards directly.
	//
	// Falls back to a plain wrapper div when parsing fails (e.g. preview HTML
	// is empty or has no element root yet).
	const rooted = parsePreviewWithRoot(html, { clientId });
	if (!rooted) {
		return <div {...blockProps} />;
	}
	return createElement(rooted.tag, blockProps, rooted.children);
}

// inline style="a:1;b:2" → { a: '1', b: '2' } so React stops complaining.
function parseStyle(str) {
	const out = {};
	str.split(';').forEach((rule) => {
		const [prop, ...rest] = rule.split(':');
		if (!prop || rest.length === 0) return;
		const key = prop.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
		out[key] = rest.join(':').trim();
	});
	return out;
}

registerBlocks();

// Inspector panels — added on top of every gcblite/* block.
const withGCBLiteInspector = createHigherOrderComponent((BlockEdit) => {
	return (props) => {
		const blockConfig = window.gcbLite?.blocks?.[props.name];
		if (!blockConfig || !Array.isArray(blockConfig.controls) || blockConfig.controls.length === 0) {
			return <BlockEdit {...props} />;
		}

		return (
			<Fragment>
				<BlockEdit {...props} />
				<InspectorControls>
					{renderInspector(blockConfig.controls, props.attributes, props.setAttributes)}
				</InspectorControls>
			</Fragment>
		);
	};
}, 'withGCBLiteInspector');

addFilter('editor.BlockEdit', 'gcb-lite/with-inspector', withGCBLiteInspector);
