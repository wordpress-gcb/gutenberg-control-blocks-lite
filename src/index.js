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
import { Fragment, createElement, useMemo } from '@wordpress/element';
import { InnerBlocks, InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import { Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { renderInspector } from '@wordpress-gcb/fields';
import { usePHPPreview } from './hooks/usePHPPreview';
import { useRepeaterSeeding } from './hooks/useRepeaterSeeding';
import { useRepeaterValidation } from './hooks/useRepeaterValidation';
import { extractRepeaterConfig } from './utils/repeater-config';
import { parsePreviewWithRoot } from './utils/parse-preview';
import { focusInspectorField, focusFieldAttribute } from './utils/focusField';
import { useForceOpenPanelIds } from './utils/panelOpenStore';
import { mountFrontendUrlBar } from './FrontendUrlBar';
import { installValidationNotice } from './utils/validation-notice';
import './editor.scss';

// Mount the Storybook-style "rendering from" strip above the editor.
// Imperative DOM injection (not registerPlugin) — registerPlugin requires
// the edit-post container to be initialised before render, and on some
// page-edit screens the iframe canvas hadn't mounted yet, breaking the
// editor mount. Inject after the editor is in the DOM via mutation
// observer instead.
if (typeof window !== 'undefined') {
	mountFrontendUrlBar();
	// Replace WP's generic save-failure notice with one that states the reason
	// and offers "Find the block". Editor-agnostic (fires off the rejected
	// request), so it works in the Site Editor too.
	installValidationNotice();
}

function registerBlocks() {
	const blocks = window.gcbLite?.blocks || {};
	Object.keys(blocks).forEach((name) => {
		registerBlockType(name, {
			edit: (props) => <PHPPreviewEdit {...props} blockName={name} />,
			save: () => <InnerBlocks.Content />,
		});
	});
}

function PHPPreviewEdit({ blockName, attributes, clientId, isSelected }) {
	const { html, wrapperAttributes, loading, error } = usePHPPreview({
		blockName,
		attributes,
		clientId,
	});

	// Repeater behaviour (defaultChildren seeding + min/max enforcement) is
	// driven off the <repeater> marker in the preview HTML, handled HERE in the
	// stable per-clientId edit component — not in the transient parsed tree,
	// which is rebuilt on every preview refresh. null when the block has no
	// repeater. See useRepeaterSeeding / useRepeaterValidation.
	const repeaterConfig = useMemo(() => extractRepeaterConfig(html), [html]);
	useRepeaterSeeding(clientId, repeaterConfig);

	// Human title for messages ("Gcb Block"), not the slug ("gcb/gcb-block").
	const blockLabel = useSelect(
		(select) => select('core/blocks').getBlockType(blockName)?.title || blockName,
		[blockName]
	);
	const validation = useRepeaterValidation(clientId, repeaterConfig, blockLabel);

	// Inline error indicator rendered INSIDE the block. The reliable "which
	// block?" signal — a top-of-page notice can't point at one of 40 blocks,
	// but this banner sits in the block itself, and gives the editor's notice
	// a #gcblite-error-<id> target. The message already names the block, so no
	// separate heading; no outline on the block (the banner is enough).
	const validationBanner = validation.hasErrors ? (
		<div
			id={`gcblite-error-${clientId}`}
			className="gcblite-block-error"
			role="alert"
			style={{
				background: '#fcf0f1',
				borderLeft: '4px solid #d63638',
				color: '#8a1f23',
				padding: '8px 12px',
				margin: '0 0 8px',
				fontSize: 13,
				lineHeight: 1.5,
				borderRadius: 3,
			}}
		>
			{Object.values(validation.errors).join(' ')}
		</div>
	) : null;

	// Click-to-focus-Inspector: when the author clicks any element in
	// the preview that render.php has tagged with the focus-field
	// attribute (default: data-focus-field), open the matching Inspector
	// panel + scroll-into-view + flash the field. Only active when this
	// block is currently selected — clicks on unselected blocks should
	// still go through to WP's "select this block" handler, not skip
	// ahead to field focus.
	//
	// The attribute name itself is filterable via the
	// `gcblite_focus_field_attribute` PHP filter so site owners can
	// remap if `data-focus-field` collides with another plugin.
	const onPreviewClick = (e) => {
		if (!isSelected) return;

		// Links in the editor preview should NEVER navigate. The
		// preview is preview, not a live page — a click on an author's
		// "Visit site →" CTA shouldn't yank the wp-admin tab elsewhere.
		// Suppress the navigation regardless of whether the link sits
		// inside a focus-field wrapper.
		const link = e.target?.closest?.('a');
		if (link) {
			e.preventDefault();
		}

		const attr = focusFieldAttribute();
		if (!attr) return; // Feature disabled (empty filter return).

		// Form fields keep their normal behaviour even in the preview —
		// authors editing inline (input, textarea, select) shouldn't have
		// the click stolen.
		if (e.target.closest('input, textarea, select')) return;

		// Resolve a focus-field host for this click. Two strategies in
		// order: (1) walk up from e.target — the common case for fields
		// whose visible content is a descendant of the focus-field host;
		// (2) if no ancestor matches, look at every element stacked under
		// the click point and take the deepest one with the attribute.
		// (2) catches the awkward case where a sibling overlay (absolute,
		// on top, sometimes pointer-events:none, sometimes not) sits
		// over a focus-field with no shared ancestry — e.g. a background-
		// image hero with a separate decorative overlay sibling.
		const trigger = e.target?.closest?.(`[${attr}]`)
			|| underlyingFocusField(e, attr);
		if (!trigger) return;
		const key = trigger.getAttribute(attr);
		if (!key) return;
		e.preventDefault();
		e.stopPropagation();
		focusInspectorField(key, { clientId, blockName });
	};

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

	// Loading indicator: slim 2px indeterminate progress bar pinned to
	// the top edge of the block. No spinner, no text. Same element shown
	// on initial load AND on subsequent re-fetches (so the user knows a
	// background revalidate is in flight) — when html is empty the bar
	// sits on an empty wrapper; when html is populated the bar overlays
	// the existing content so the user keeps seeing the cached version
	// while the fresh one loads.
	const progressBar = loading ? (
		<div
			className="gcblite-progress-bar"
			aria-hidden="true"
			role="presentation"
		/>
	) : null;

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
		// Empty wrapper while the first render is in flight. Position
		// relative so the absolutely-positioned progress bar lays out
		// against this element.
		return (
			<div {...blockProps} style={{ ...blockProps.style, position: 'relative', minHeight: 4 }}>
				{progressBar}
				{validationBanner}
			</div>
		);
	}
	// Multi-node output (e.g. a stray <style>/<script> or text before the
	// markup) can't be promoted to a single wrapper without dropping nodes, so
	// render everything inside the standard blockProps container. Nothing gets
	// silently discarded — "it's just HTML".
	if (rooted.nodes) {
		return (
			<div
				{...blockProps}
				style={{ ...blockProps.style, position: 'relative' }}
				onClick={onPreviewClick}
			>
				{progressBar}
				{validationBanner}
				{rooted.nodes}
			</div>
		);
	}
	return createElement(
		rooted.tag,
		{
			...blockProps,
			style: { ...blockProps.style, position: 'relative' },
			onClick: onPreviewClick,
		},
		<>
			{progressBar}
			{validationBanner}
			{rooted.children}
		</>
	);
}

/**
 * When the click's target has no focus-field ancestor, look at every
 * element under the click point (deepest-first) and return the first
 * one that carries the focus-field attribute. Solves the case where
 * a sibling overlay element sits on top of a focus-field (e.g. a
 * decorative gradient over a background-image hero) — those don't
 * share ancestry, so closest() walking up from the overlay never
 * finds the field.
 *
 * `elementsFromPoint` returns elements in painting order, topmost
 * first. We skip the topmost (that's e.target — already failed the
 * closest-walk) and check the rest. Walking up from each candidate
 * with closest() handles the case where the underlying element is
 * itself a descendant of the focus-field host rather than the host.
 */
function underlyingFocusField(e, attr) {
	const doc = e.target?.ownerDocument || (typeof document !== 'undefined' ? document : null);
	if (!doc?.elementsFromPoint) return null;
	const stack = doc.elementsFromPoint(e.clientX, e.clientY);
	for (const el of stack) {
		if (el === e.target) continue;
		const hit = el.closest?.(`[${attr}]`);
		if (hit) return hit;
	}
	return null;
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
		// Subscribe to the click-to-focus store BEFORE the early return.
		// React hooks have to run unconditionally on every render path.
		const forceOpenPanelIds = useForceOpenPanelIds(props.clientId);
		if (!blockConfig || !Array.isArray(blockConfig.controls) || blockConfig.controls.length === 0) {
			return <BlockEdit {...props} />;
		}

		return (
			<Fragment>
				<BlockEdit {...props} />
				<InspectorControls>
					{renderInspector(blockConfig.controls, props.attributes, props.setAttributes, { forceOpenPanelIds })}
				</InspectorControls>
			</Fragment>
		);
	};
}, 'withGCBLiteInspector');

addFilter('editor.BlockEdit', 'gcb-lite/with-inspector', withGCBLiteInspector);
