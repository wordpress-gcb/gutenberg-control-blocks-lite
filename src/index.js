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
import {
	InnerBlocks,
	InspectorControls,
	useBlockProps,
} from '@wordpress/block-editor';
import { useSelect, select as dataSelect } from '@wordpress/data';
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
import IconListEdit from './blocks/icon-list/edit';
import IconListItemEdit from './blocks/icon-list-item/edit';
import './editor.scss';

// Mount the Storybook-style "rendering from" strip above the editor.
// Imperative DOM injection (not registerPlugin) — registerPlugin requires
// the edit-post container to be initialised before render, and on some
// page-edit screens the iframe canvas hadn't mounted yet, breaking the
// editor mount. Inject after the editor is in the DOM via mutation
// observer instead.
if ( typeof window !== 'undefined' ) {
	mountFrontendUrlBar();
	// Replace WP's generic save-failure notice with one that states the reason
	// and offers "Find the block". Editor-agnostic (fires off the rejected
	// request), so it works in the Site Editor too.
	installValidationNotice();
}

// Kit blocks with hand-written edit components — a list is typed, not
// form-filled, so these skip the generic PHP-preview pipeline and render
// native InnerBlocks/RichText edits. The inspector HOC below still adds
// their block.fields.json controls (that's where the icon picker lives).
const NATIVE_BLOCKS = {
	'gcb/icon-list': {
		edit: IconListEdit,
		save: () => <InnerBlocks.Content />,
	},
	'gcb/icon-list-item': {
		edit: IconListItemEdit,
		save: () => null,
		// Backspace-at-start / Delete-at-end grammar: WP's mergeBlocks
		// action folds one row's attributes into the other via this.
		merge: ( attributes, attributesToMerge ) => ( {
			...attributes,
			text: ( attributes.text || '' ) + ( attributesToMerge.text || '' ),
		} ),
	},
};

function registerBlocks() {
	const blocks = window.gcbLite?.blocks || {};
	Object.keys( blocks ).forEach( ( name ) => {
		if ( NATIVE_BLOCKS[ name ] ) {
			registerBlockType( name, NATIVE_BLOCKS[ name ] );
			return;
		}
		registerBlockType( name, {
			edit: ( props ) => (
				<PHPPreviewEdit { ...props } blockName={ name } />
			),
			save: () => <InnerBlocks.Content />,
		} );
	} );
}

function PHPPreviewEdit( { blockName, attributes, clientId, isSelected } ) {
	const { html, wrapperAttributes, loading, error } = usePHPPreview( {
		blockName,
		attributes,
		clientId,
	} );

	// Repeater behaviour (defaultChildren seeding + min/max enforcement) is
	// driven off the <repeater> marker in the preview HTML, handled HERE in the
	// stable per-clientId edit component — not in the transient parsed tree,
	// which is rebuilt on every preview refresh. null when the block has no
	// repeater. See useRepeaterSeeding / useRepeaterValidation.
	const repeaterConfig = useMemo(
		() => extractRepeaterConfig( html ),
		[ html ]
	);
	useRepeaterSeeding( clientId, repeaterConfig );

	// Human title for messages ("Gcb Block"), not the slug ("gcb/gcb-block").
	const blockLabel = useSelect(
		( select ) =>
			select( 'core/blocks' ).getBlockType( blockName )?.title ||
			blockName,
		[ blockName ]
	);
	const validation = useRepeaterValidation(
		clientId,
		repeaterConfig,
		blockLabel
	);

	// Inline error indicator rendered INSIDE the block. The reliable "which
	// block?" signal — a top-of-page notice can't point at one of 40 blocks,
	// but this banner sits in the block itself, and gives the editor's notice
	// a #gcblite-error-<id> target. The message already names the block, so no
	// separate heading; no outline on the block (the banner is enough).
	const validationBanner = validation.hasErrors ? (
		<div
			id={ `gcblite-error-${ clientId }` }
			className="gcblite-block-error"
			role="alert"
			style={ {
				background: '#fcf0f1',
				borderLeft: '4px solid #d63638',
				color: '#8a1f23',
				padding: '8px 12px',
				margin: '0 0 8px',
				fontSize: 13,
				lineHeight: 1.5,
				borderRadius: 3,
			} }
		>
			{ Object.values( validation.errors ).join( ' ' ) }
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
	const onPreviewClick = ( e ) => {
		if ( ! isSelected ) {
			return;
		}

		// Links in the editor preview should NEVER navigate. The
		// preview is preview, not a live page — a click on an author's
		// "Visit site →" CTA shouldn't yank the wp-admin tab elsewhere.
		// Suppress the navigation regardless of whether the link sits
		// inside a focus-field wrapper.
		const link = e.target?.closest?.( 'a' );
		if ( link ) {
			e.preventDefault();
		}

		const attr = focusFieldAttribute();
		if ( ! attr ) {
			return;
		} // Feature disabled (empty filter return).

		// Form fields keep their normal behaviour even in the preview —
		// authors editing inline (input, textarea, select, and the
		// RichText-bound field elements, which are contenteditable)
		// shouldn't have the click stolen.
		if (
			e.target.closest(
				'input, textarea, select, [contenteditable="true"]'
			)
		) {
			return;
		}

		// Resolve a focus-field host for this click. Two strategies in
		// order: (1) walk up from e.target — the common case for fields
		// whose visible content is a descendant of the focus-field host;
		// (2) if no ancestor matches, look at every element stacked under
		// the click point and take the deepest one with the attribute.
		// (2) catches the awkward case where a sibling overlay (absolute,
		// on top, sometimes pointer-events:none, sometimes not) sits
		// over a focus-field with no shared ancestry — e.g. a background-
		// image hero with a separate decorative overlay sibling.
		const trigger =
			e.target?.closest?.( `[${ attr }]` ) ||
			underlyingFocusField( e, attr );
		if ( ! trigger ) {
			return;
		}
		const key = trigger.getAttribute( attr );
		if ( ! key ) {
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		focusInspectorField( key, { clientId, blockName } );
	};

	// Apply the renderer's root-element attributes to the editor wrapper so
	// the editor preview matches the frontend exactly (same classes, same
	// data-*, same inline style). { tag } is the parser's own key, not an
	// HTML attribute — drop it.
	const {
		tag: _tag,
		class: className,
		style,
		...rest
	} = wrapperAttributes || {};
	const blockProps = useBlockProps( {
		className,
		style: typeof style === 'string' ? parseStyle( style ) : style,
		...rest,
	} );

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

	if ( error ) {
		return (
			<div { ...blockProps }>
				<Notice status="error" isDismissible={ false }>
					<strong>{ __( 'Preview failed:', 'gcblite' ) }</strong>{ ' ' }
					{ error }
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
	const rooted = parsePreviewWithRoot( html, { clientId } );
	if ( ! rooted ) {
		// Empty wrapper while the first render is in flight. Position
		// relative so the absolutely-positioned progress bar lays out
		// against this element.
		return (
			<div
				{ ...blockProps }
				style={ {
					...blockProps.style,
					position: 'relative',
					minHeight: 4,
				} }
			>
				{ progressBar }
				{ validationBanner }
			</div>
		);
	}
	// Multi-node output (e.g. a stray <style>/<script> or text before the
	// markup) can't be promoted to a single wrapper without dropping nodes, so
	// render everything inside the standard blockProps container. Nothing gets
	// silently discarded — "it's just HTML".
	if ( rooted.nodes ) {
		return (
			<div
				{ ...blockProps }
				style={ { ...blockProps.style, position: 'relative' } }
				onClick={ onPreviewClick }
			>
				{ progressBar }
				{ validationBanner }
				{ rooted.nodes }
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
			{ progressBar }
			{ validationBanner }
			{ rooted.children }
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
 * @param e
 * @param attr
 */
function underlyingFocusField( e, attr ) {
	const doc =
		e.target?.ownerDocument ||
		( typeof document !== 'undefined' ? document : null );
	if ( ! doc?.elementsFromPoint ) {
		return null;
	}
	const stack = doc.elementsFromPoint( e.clientX, e.clientY );
	for ( const el of stack ) {
		if ( el === e.target ) {
			continue;
		}
		const hit = el.closest?.( `[${ attr }]` );
		if ( hit ) {
			return hit;
		}
	}
	return null;
}

// inline style="a:1;b:2" → { a: '1', b: '2' } so React stops complaining.
function parseStyle( str ) {
	const out = {};
	str.split( ';' ).forEach( ( rule ) => {
		const [ prop, ...rest ] = rule.split( ':' );
		if ( ! prop || rest.length === 0 ) {
			return;
		}
		const key = prop
			.trim()
			.replace( /-([a-z])/g, ( _, c ) => c.toUpperCase() );
		out[ key ] = rest.join( ':' ).trim();
	} );
	return out;
}

registerBlocks();

// Inspector panels — added on top of every gcblite/* block.
const withGCBLiteInspector = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		const blockConfig = window.gcbLite?.blocks?.[ props.name ];
		// Subscribe to the click-to-focus store BEFORE the early return.
		// React hooks have to run unconditionally on every render path.
		const forceOpenPanelIds = useForceOpenPanelIds( props.clientId );
		if (
			! blockConfig ||
			! Array.isArray( blockConfig.controls ) ||
			blockConfig.controls.length === 0
		) {
			return <BlockEdit { ...props } />;
		}

		return (
			<Fragment>
				<BlockEdit { ...props } />
				<InspectorControls>
					{ renderInspector(
						blockConfig.controls,
						props.attributes,
						props.setAttributes,
						{ forceOpenPanelIds }
					) }
				</InspectorControls>
			</Fragment>
		);
	};
}, 'withGCBLiteInspector' );

addFilter(
	'editor.BlockEdit',
	'gcb-lite/with-inspector',
	withGCBLiteInspector
);

/**
 * EDITOR PERMISSIONS ([[editor-styling-power]] — "decide what styling power
 * the editor gets").
 *
 * A GCB region's author curates, in the studio's "Editor defaults" panel,
 * which design tokens the CLIENT may choose from. Those scoped sets ride the
 * block spec to `window.gcbLite.blocks[name].editorPerms`; this filter is
 * where they bite. `blockEditor.useSetting.before` runs ahead of every
 * settings lookup, so clamping here narrows the native pickers without
 * touching the render tree or the block's own attributes.
 *
 * The rules:
 *   - absent key      → unrestricted (return the value untouched)
 *   - curated array   → only those preset slugs survive
 *   - empty array     → nothing survives, and WP hides the control entirely
 *
 * Permissions are inherited: they belong to the REGION, so any block nested
 * inside it obeys them. We walk up from the block to the nearest gcb/* parent
 * that declares perms.
 */
const permsForClient = ( clientId ) => {
	const blocks = window.gcbLite?.blocks;
	if ( ! clientId || ! blocks ) {
		return null;
	}
	const be = dataSelect( 'core/block-editor' );
	if ( ! be ) {
		return null;
	}
	// nearest first: the block itself, then its ancestors outward. The
	// `ascending` flag already orders parents closest-first.
	const chain = [ clientId, ...( be.getBlockParents( clientId, true ) || [] ) ];
	for ( const id of chain ) {
		const name = be.getBlockName( id );
		const perms = name && blocks[ name ] && blocks[ name ].editorPerms;
		if ( perms ) {
			return perms;
		}
	}
	return null;
};

/**
 * Resolve a settings path the way core would, so the permissions filter has
 * something to clamp. Core hands the filter `undefined` and treats any
 * non-undefined return as final, so we can't "filter the list" — we have to
 * produce it. Editor settings hold the theme.json data under
 * `__experimentalFeatures`, keyed by the same dotted paths (minus origin).
 */
const resolveSetting = ( path ) => {
	const be = dataSelect( 'core/block-editor' );
	const settings = be && be.getSettings();
	const features = settings && settings.__experimentalFeatures;
	if ( ! features ) {
		return undefined;
	}
	let node = features;
	for ( const key of path.split( '.' ) ) {
		if ( node === undefined || node === null ) {
			return undefined;
		}
		node = node[ key ];
	}
	return node;
};

const clampPresets = ( value, allowed ) => {
	if ( ! Array.isArray( allowed ) ) {
		return value;
	}
	// A preset origin object ({theme:[], default:[], custom:[]}) or a flat list.
	if ( Array.isArray( value ) ) {
		return value.filter( ( v ) => v && allowed.includes( v.slug ) );
	}
	if ( value && typeof value === 'object' ) {
		const out = {};
		Object.keys( value ).forEach( ( origin ) => {
			out[ origin ] = Array.isArray( value[ origin ] )
				? value[ origin ].filter( ( v ) => v && allowed.includes( v.slug ) )
				: value[ origin ];
		} );
		return out;
	}
	return value;
};

/**
 * The permission record is keyed by FIELD ('typography:fontSize'), and each
 * field names the setting path it governs plus the custom-value gate that has
 * to close with it — a curated list is only guidance while the client can
 * still type a value and escape the scale.
 *
 * Several fields share one setting path (text colour, background colour and
 * border colour are all `color.palette`). When they disagree we take the
 * UNION of what any of them allows, because WP resolves the palette once for
 * the whole block; per-control palettes would need separate machinery.
 */
const FIELD_SETTINGS = {
	'typography:fontSize': {
		setting: 'typography.fontSizes',
		custom: 'typography.customFontSize',
	},
	'typography:textColor': { setting: 'color.palette', custom: 'color.custom' },
	'typography:fontFamily': { setting: 'typography.fontFamilies' },
	'background:backgroundColor': {
		setting: 'color.palette',
		custom: 'color.custom',
	},
	'background:gradient': {
		setting: 'color.gradients',
		custom: 'color.customGradient',
	},
	'border:borderColor': { setting: 'color.palette', custom: 'color.custom' },
	'styles:blockSpacing': { setting: 'spacing.spacingSizes' },
	'dimensions:padding': { setting: 'spacing.spacingSizes' },
	'dimensions:margin': { setting: 'spacing.spacingSizes' },
};

/** Collect every field record governing a given setting path. */
const recordsForSetting = ( perms, path ) => {
	const base = path.replace(
		/\.(theme|default|custom)$/,
		''
	);
	const out = [];
	Object.keys( perms || {} ).forEach( ( key ) => {
		const def = FIELD_SETTINGS[ key ];
		if ( def && def.setting === base ) {
			out.push( perms[ key ] );
		}
	} );
	return out;
};

/** Same, for the custom-value gates ('color.custom' etc.). */
const recordsForCustom = ( perms, path ) => {
	const out = [];
	Object.keys( perms || {} ).forEach( ( key ) => {
		const def = FIELD_SETTINGS[ key ];
		if ( def && def.custom === path ) {
			out.push( perms[ key ] );
		}
	} );
	return out;
};

addFilter(
	'blockEditor.useSetting.before',
	'gcb-lite/editor-permissions',
	( value, path, clientId ) => {
		const perms = permsForClient( clientId );
		if ( ! perms ) {
			return value;
		}

		/* THE CONTRACT (core's getBlockSettings): this filter is called with
		   value === undefined BEFORE core resolves anything, and whatever it
		   returns — if not undefined — WINS OUTRIGHT, short-circuiting core's
		   own lookup. So "filter the incoming list" is not a thing that works:
		   there is no incoming list. We must resolve the real value ourselves
		   and return the clamped copy. WP also asks BY ORIGIN
		   ('typography.fontSizes.theme', '.default', '.custom') as well as via
		   the composite path, so both forms have to match. */
		const governing = recordsForSetting( perms, path );
		if ( governing.length ) {
			// hidden → empty the option set (the control stops rendering);
			// limited → the union of the allow-lists; visible → no opinion.
			const anyVisible = governing.some(
				( r ) => ( r.access || 'visible' ) === 'visible'
			);
			if ( anyVisible ) {
				return value;
			}
			const allHidden = governing.every( ( r ) => r.access === 'hidden' );
			if ( allHidden ) {
				return clampPresets( resolveSetting( path ), [] );
			}
			const allowed = [];
			governing.forEach( ( r ) => {
				( r.allowed || [] ).forEach( ( slug ) => {
					if ( ! allowed.includes( slug ) ) {
						allowed.push( slug );
					}
				} );
			} );
			const resolved = resolveSetting( path );
			return resolved === undefined
				? undefined
				: clampPresets( resolved, allowed );
		}

		const gates = recordsForCustom( perms, path );
		if ( gates.length ) {
			// a curated or hidden field must not leave a custom escape open.
			const restricted = gates.every(
				( r ) => r.access === 'limited' || r.access === 'hidden'
			);
			return restricted ? false : value;
		}

		return value;
	}
);
