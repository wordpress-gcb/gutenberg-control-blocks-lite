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
 *   <h2 data-gcb-field="headline" data-gcb-field-type="text">…</h2>
 *     → RichText bound to the block attribute — the author clicks the
 *       headline ON THE CANVAS and types ("WP driven" = edit in place;
 *       the sidebar input still works, both write the same attribute).
 *
 * Anything else passes through as plain HTML.
 */

import parse, { attributesToProps, domToReact } from 'html-react-parser';
import { Fragment, createElement } from '@wordpress/element';
import { InnerBlocks, RichText } from '@wordpress/block-editor';
import { Button } from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { createBlock } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import RepeaterLayout from '../repeater-layouts';

/**
 * Read a string-shaped HTML attribute value and try to parse it as JSON.
 * Falls back to the literal string if it isn't.
 * @param raw
 */
function parseAttrValue( raw ) {
	if ( raw == null ) {
		return undefined;
	}
	if ( raw === 'all' ) {
		return 'all';
	}
	const decoded = decodeHtmlEntities( raw );
	try {
		return JSON.parse( decoded );
	} catch {
		return decoded;
	}
}

function decodeHtmlEntities( s ) {
	const txt = document.createElement( 'textarea' );
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
 * @param root0
 * @param root0.clientId
 * @param root0.allowedBlocks
 * @param root0.addButtonLabel
 * @param root0.min
 * @param root0.max
 * @param root0.defaultChildren
 * @param root0.template
 */
function RepeaterTag( {
	clientId,
	allowedBlocks,
	addButtonLabel,
	editLayout: markerLayout,
	min,
	max,
	defaultChildren,
	template,
} ) {
	const { insertBlock } = useDispatch( 'core/block-editor' );
	const { childOrder, attrLayout } = useSelect(
		( select ) => {
			const be = select( 'core/block-editor' );
			return {
				childOrder: be.getBlockOrder( clientId ),
				// Editor-only attribute set by the Studio layout picker; how the
				// children are ARRANGED for editing (front end is unaffected).
				attrLayout: be.getBlockAttributes( clientId )?.editLayout,
			};
		},
		[ clientId ]
	);
	// Marker layout (e.g. a compiled card list that wants a side-by-side grid,
	// not the one-at-a-time carousel) wins over the Studio-picked attribute,
	// which wins over the carousel default.
	const editLayout = markerLayout || attrLayout || 'carousel';
	const childCount = childOrder.length;

	const firstAllowed = Array.isArray( allowedBlocks )
		? allowedBlocks[ 0 ]
		: null;
	const canAddMore = ! max || childCount < max;

	// NOTE: seeding (defaultChildren) and the min floor are NOT handled here.
	// This component is re-parsed from the PHP-preview HTML on every refresh,
	// so any "seed once" ref resets constantly and races the remount. Seeding
	// lives in useRepeaterSeeding(), anchored to the stable PHPPreviewEdit
	// component (keyed on clientId). See src/hooks/useRepeaterSeeding.js.

	const addItem = () => {
		if ( ! firstAllowed ) {
			return;
		}
		insertBlock( createBlock( firstAllowed ), childCount, clientId, false );
	};

	return (
		<RepeaterLayout
			layout={ editLayout }
			childOrder={ childOrder }
			onAdd={ addItem }
			addLabel={ addButtonLabel || __( 'Add item', 'gcblite' ) }
			canAdd={ canAddMore && !! firstAllowed }
		>
			<InnerBlocks
				allowedBlocks={
					allowedBlocks === 'all' ? undefined : allowedBlocks
				}
				templateLock={ false }
				renderAppender={ false }
				template={ template }
			/>
		</RepeaterLayout>
	);
}

/**
 * INLINE FIELD EDITING — the tag set a text/textarea field element may use
 * and still be swapped for RichText. Lists (ul/ol from list-mode text) and
 * anything exotic keep the sidebar as their only channel: RichText can't
 * honestly represent their markup, and a wrong swap breaks the layout.
 */
export const INLINE_FIELD_TAGS = new Set( [
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'p',
	'div',
	'span',
] );

/**
 * data-gcb-field id → the block attribute key, mirroring
 * ChildBlockParser::extract_fields (sanitize_key, non-[a-z0-9_] → '_',
 * leading digits/underscores trimmed). The two MUST stay in sync or the
 * inline editor binds to a key the block never registered.
 * @param fieldId
 */
export function fieldAttributeKey( fieldId ) {
	return String( fieldId || '' )
		.toLowerCase()
		.replace( /[^a-z0-9_-]/g, '' )
		.replace( /[^a-z0-9_]/g, '_' )
		.replace( /^[0-9_]+/, '' );
}

/**
 * Scan preview HTML for the field elements the parser will swap for inline
 * RichText, and return their attribute keys. usePHPPreview uses this to
 * EXCLUDE those attributes from the render fetch: their SSR text is
 * discarded (RichText shows the live attribute), so typing must not
 * refetch — the refetch would re-parse the tree mid-keystroke and risk
 * the caret, for HTML nobody looks at.
 * @param html
 */
export function inlineFieldKeys( html ) {
	const keys = new Set();
	if ( ! html || typeof window === 'undefined' ) {
		return keys;
	}
	const doc = new window.DOMParser().parseFromString( html, 'text/html' );
	doc.querySelectorAll( '[data-gcb-field]' ).forEach( ( el ) => {
		const type = el.getAttribute( 'data-gcb-field-type' );
		if (
			( type === 'text' || type === 'textarea' ) &&
			INLINE_FIELD_TAGS.has( el.tagName.toLowerCase() )
		) {
			const key = fieldAttributeKey(
				el.getAttribute( 'data-gcb-field' )
			);
			if ( key ) {
				keys.add( key );
			}
		}
	} );
	return keys;
}

/** Plain attribute text → the HTML string RichText edits (escape + <br>). */
function textToRich( text, multiline ) {
	const escaped = String( text ?? '' )
		.replace( /&/g, '&amp;' )
		.replace( /</g, '&lt;' )
		.replace( />/g, '&gt;' );
	return multiline ? escaped.replace( /\n/g, '<br>' ) : escaped;
}

/** RichText's HTML → the plain text the attribute stores (front end runs
 *  esc_html/nl2br over it, so rich markup must never survive the trip). */
function richToText( html, multiline ) {
	let s = String( html ?? '' ).replace( /<br\s*\/?>/gi, '\n' );
	s = s.replace( /<[^>]*>/g, '' );
	const txt = document.createElement( 'textarea' );
	txt.innerHTML = s;
	s = txt.value;
	return multiline ? s : s.replace( /\n+/g, ' ' );
}

/**
 * A text/textarea FIELD element, editable in place: the same tag with the
 * same classes/style (visual parity with the front end), but its content is
 * a RichText bound to the block attribute. Plain text only — allowedFormats
 * is empty because render.php escapes the value (esc_html), so any rich
 * markup typed here would ship as literal angle brackets.
 *
 * Falls back to the server-rendered content untouched when the attribute
 * isn't a registered text control (a hand-authored template tagging
 * something we don't know about).
 * @param root0
 * @param root0.clientId
 * @param root0.tagName
 * @param root0.attribs
 * @param root0.fallback
 */
function InlineFieldTag( { clientId, tagName, attribs, fallback } ) {
	const attrKey = fieldAttributeKey( attribs[ 'data-gcb-field' ] );
	const multiline = attribs[ 'data-gcb-field-type' ] === 'textarea';
	const { value, control } = useSelect(
		( select ) => {
			const be = select( 'core/block-editor' );
			const name = clientId ? be.getBlockName( clientId ) : null;
			const controls =
				( name && window.gcbLite?.blocks?.[ name ]?.controls ) || [];
			return {
				value: clientId
					? be.getBlockAttributes( clientId )?.[ attrKey ]
					: undefined,
				control: controls.find(
					( c ) =>
						c.attributeKey === attrKey &&
						( c.type === 'text' || c.type === 'textarea' )
				),
			};
		},
		[ clientId, attrKey ]
	);
	const { updateBlockAttributes } = useDispatch( 'core/block-editor' );

	const props = attributesToProps( attribs );
	if ( ! clientId || ! control ) {
		return createElement( tagName, props, fallback );
	}
	return (
		<RichText
			{ ...props }
			tagName={ tagName }
			identifier={ attrKey }
			value={ textToRich( value ?? '', multiline ) }
			onChange={ ( next ) =>
				updateBlockAttributes( clientId, {
					[ attrKey ]: richToText( next, multiline ),
				} )
			}
			allowedFormats={ [] }
			withoutInteractiveFormatting
			disableLineBreaks={ ! multiline }
			placeholder={ control.placeholder || control.label || '' }
		/>
	);
}

/**
 * <InnerBlocks> replacement — pass-through to the WP component.
 * @param root0
 * @param root0.allowedBlocks
 * @param root0.template
 * @param root0.templateLock
 */
function InnerBlocksTag( { allowedBlocks, template, templateLock } ) {
	return (
		<InnerBlocks
			allowedBlocks={
				allowedBlocks === 'all' ? undefined : allowedBlocks
			}
			template={ template }
			templateLock={ templateLock === 'false' ? false : templateLock }
		/>
	);
}

/**
 * Parse the preview HTML and return a React tree.
 * @param html
 * @param root0
 * @param root0.clientId
 */
export function parsePreview( html, { clientId } = {} ) {
	if ( ! html ) {
		return null;
	}

	return parse( html, {
		replace( domNode ) {
			if ( domNode.type !== 'tag' ) {
				return;
			}

			const name = domNode.name?.toLowerCase();

			// A text FIELD element → RichText bound to its attribute (edit
			// in place on the canvas; the sidebar input still works).
			const fieldType = domNode.attribs?.[ 'data-gcb-field-type' ];
			if (
				( fieldType === 'text' || fieldType === 'textarea' ) &&
				domNode.attribs?.[ 'data-gcb-field' ] &&
				INLINE_FIELD_TAGS.has( name )
			) {
				return (
					<InlineFieldTag
						clientId={ clientId }
						tagName={ name }
						attribs={ domNode.attribs }
						fallback={ domToReact( domNode.children ) }
					/>
				);
			}

			if ( name === 'repeater' ) {
				const a = domNode.attribs || {};
				return (
					<RepeaterTag
						clientId={ clientId }
						allowedBlocks={ parseAttrValue( a.allowedblocks ) }
						addButtonLabel={ a.addbuttonlabel }
						editLayout={ a.editlayout || undefined }
						min={ a.min ? parseInt( a.min, 10 ) : 0 }
						max={ a.max ? parseInt( a.max, 10 ) : 0 }
						defaultChildren={
							a.defaultchildren
								? parseInt( a.defaultchildren, 10 )
								: 0
						}
						template={
							a.template
								? parseAttrValue( a.template )
								: undefined
						}
					/>
				);
			}

			if ( name === 'innerblocks' ) {
				const a = domNode.attribs || {};
				return (
					<InnerBlocksTag
						allowedBlocks={ parseAttrValue( a.allowedblocks ) }
						template={
							a.template
								? parseAttrValue( a.template )
								: undefined
						}
						templateLock={ a.templatelock }
					/>
				);
			}
		},
	} );
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
 * @param html
 * @param root0
 * @param root0.clientId
 */
export function parsePreviewWithRoot( html, { clientId } = {} ) {
	if ( ! html ) {
		return null;
	}

	const tree = parsePreview( html, { clientId } );
	const flat = Array.isArray( tree ) ? tree : [ tree ];

	// Meaningful top-level nodes = element nodes plus any non-whitespace text.
	// (Whitespace-only text between tags is layout noise, not content.)
	const meaningful = flat.filter( ( node ) => {
		if ( node && typeof node === 'object' && node.type ) {
			return true;
		}
		if ( typeof node === 'string' ) {
			return node.trim() !== '';
		}
		return false;
	} );

	const elements = meaningful.filter(
		( node ) =>
			node && typeof node === 'object' && typeof node.type === 'string'
	);

	// Single-element output (the common, recommended shape): PROMOTE that
	// element to be the block wrapper itself — no extra <div> — so a parent
	// grid/flex targets the real element. This is the Tailwind-friendly path.
	if ( meaningful.length === 1 && elements.length === 1 ) {
		const root = elements[ 0 ];
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
	if ( meaningful.length === 0 ) {
		return null; // nothing usable yet (first render in flight)
	}
	return { nodes: flat };
}
