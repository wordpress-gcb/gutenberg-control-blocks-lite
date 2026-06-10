/**
 * Repeater editing layouts — how a repeater's InnerBlocks children are arranged for
 * EDITING in the block editor. The published front end is unaffected (it renders the
 * normal block); this only changes the authoring experience.
 *
 * Built from the design handoff (design_handoff_slide_layouts). Six layouts:
 *   carousel  — one item at a time, WYSIWYG, prev/next arrows (default).
 *   stacked   — every item as a card, top to bottom; see everything at once.
 *   tabs      — one item at a time, switch from a compact tab strip.
 *   accordion — every item as a collapsible row; expand one to edit it.
 *   filmstrip — one big editing stage + a thumbnail strip beneath.
 *   overflow  — a horizontal strip of cards you scroll sideways.
 *
 * Approach: render the REAL InnerBlocks (so every child stays a live, editable block)
 * inside an arrangement container. The arrangement adds chrome (numbers, tab strip,
 * accordion headers, thumbnails) and, for one-at-a-time layouts, sets an
 * `is-active-N` class on the container so CSS reveals only the active child. The
 * active/expanded index is editor-local state — it is NOT saved to the block.
 *
 * The chrome that needs to address individual children (tab labels, accordion
 * headers, thumbnails) is driven by `childOrder` (the children's clientIds) — the
 * arrangements never reach into InnerBlocks' own DOM except via CSS.
 */

import { Fragment, useState, useEffect, useRef } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';

/** The layouts in scope (id + copy for the rail picker's explainer). */
export const REPEATER_LAYOUTS = [
	{ id: 'carousel', name: 'Carousel' },
	{ id: 'stacked', name: 'Stacked' },
	{ id: 'tabs', name: 'Tabs' },
	{ id: 'accordion', name: 'Accordion' },
	{ id: 'filmstrip', name: 'Filmstrip' },
	{ id: 'overflow', name: 'Overflow' },
];

/**
 * Layouts that show ONE child at a time (need an active index + a hiding class).
 *
 * NOTE: carousel is deliberately NOT here. The editor flattens InnerBlocks
 * wrappers with `display: contents` (a high-specificity `[class*="wp-block-gcb-"]`
 * rule) for WYSIWYG grid layout — which makes a "hide all but the active child"
 * CSS reveal unreliable as the DEFAULT layout (a missed reveal = a blank block,
 * the worst failure). Carousel therefore shows every child (safe) with nav chrome;
 * the genuinely one-at-a-time layouts (tabs/filmstrip) carry their own visible
 * chrome so a hidden child is clearly intentional, never a blank-block surprise.
 */
const ONE_AT_A_TIME = [ 'tabs', 'filmstrip' ];

/**
 * The shared Add button (appends a child of the first allowed type).
 * @param {Object}   root0
 * @param {string}   root0.label
 * @param {Function} root0.onAdd
 * @param {boolean}  root0.full
 */
function AddButton( { label, onAdd, full = true } ) {
	return (
		<Button
			variant="secondary"
			onClick={ onAdd }
			className={ 'gcb-replayout__add' + ( full ? ' is-full' : '' ) }
		>
			+ { label || __( 'Add item', 'gcblite' ) }
		</Button>
	);
}

/**
 * Read a short, human label for each child block (for tab/accordion/thumbnail
 * chrome). We take the block's first string-ish attribute (a heading, title,
 * label…) and fall back to "Item N". Read-only — never mutates the block.
 *
 * @param {string[]} childOrder child clientIds, in order
 * @return {string[]} a label per child
 */
function useChildLabels( childOrder ) {
	return useSelect(
		( select ) => {
			const be = select( 'core/block-editor' );
			return childOrder.map( ( id, i ) => {
				const attrs = be.getBlockAttributes( id ) || {};
				// Prefer obvious title-ish keys, then any short-ish string attr.
				const preferred = [
					'title',
					'heading',
					'label',
					'name',
					'eyebrow',
					'text',
				];
				for ( const key of preferred ) {
					const v = attrs[ key ];
					if ( typeof v === 'string' && v.trim() ) {
						return v.trim();
					}
				}
				for ( const v of Object.values( attrs ) ) {
					if (
						typeof v === 'string' &&
						v.trim() &&
						v.length <= 60 &&
						! /^https?:|^#|^\d+$/.test( v )
					) {
						return v.trim();
					}
				}
				return sprintf(
					/* translators: %d: item number */
					__( 'Item %d', 'gcblite' ),
					i + 1
				);
			} );
		},
		[ childOrder ]
	);
}

/**
 * Clamp an index into [0, count-1]; 0 if empty.
 * @param {number} i
 * @param {number} count
 * @return {number} the clamped index
 */
function clampIndex( i, count ) {
	if ( count <= 0 ) {
		return 0;
	}
	return Math.max( 0, Math.min( i, count - 1 ) );
}

/**
 * STACKED — every child as a full card, top to bottom. The card chrome (number +
 * frame) is CSS-driven over each InnerBlocks child; children render in order.
 *
 * @param {Object}   props
 * @param {Node}     props.children rendered <InnerBlocks/>
 * @param {boolean}  props.canAdd
 * @param {Function} props.onAdd
 * @param {string}   props.addLabel
 */
function Stacked( { children, onAdd, addLabel, canAdd } ) {
	return (
		<div className="gcb-replayout gcb-replayout--stacked">
			<div className="gcb-replayout__items">{ children }</div>
			{ canAdd && <AddButton label={ addLabel } onAdd={ onAdd } /> }
		</div>
	);
}

/**
 * CAROUSEL (default) — one slide at a time, WYSIWYG. Instead of CSS-hiding the
 * other children (fragile — a missed reveal blanks the block), every child renders
 * in a horizontal SCROLL TRACK where each slide is 100% wide and the track
 * scroll-snaps. Arrows/dots scroll to a slide. So all children are always in the
 * DOM and visible-when-scrolled-to — it can never go blank, and it reads exactly
 * like a real carousel (one slide framed, the rest just off-stage).
 *
 * @param {Object}   props
 * @param {Node}     props.children
 * @param {string[]} props.childOrder
 * @param {number}   props.active
 * @param {Function} props.setActive
 * @param {boolean}  props.canAdd
 * @param {Function} props.onAdd
 * @param {string}   props.addLabel
 */
function Carousel( {
	children,
	childOrder,
	active,
	setActive,
	onAdd,
	addLabel,
	canAdd,
} ) {
	const count = childOrder.length;
	const stageRef = useRef( null );

	// Scroll the active slide into view whenever `active` changes. We scroll the
	// TRACK directly (set its scrollLeft) rather than calling scrollIntoView — the
	// latter walks up and can scroll the whole editor/iframe instead of just the
	// track, which is why the arrows/dots appeared to do nothing. The real scroll
	// container is the InnerBlocks layout (it carries overflow-x:auto), not the
	// stage wrapper.
	useEffect( () => {
		const stage = stageRef.current;
		if ( ! stage ) {
			return;
		}
		const layout = stage.querySelector(
			'.block-editor-block-list__layout'
		);
		if ( ! layout ) {
			return;
		}
		const slide = layout.querySelector(
			`:scope > .wp-block:nth-child(${ active + 1 })`
		);
		if ( ! slide ) {
			return;
		}
		// offsetLeft is relative to the offset parent; subtract the layout's own
		// offset so we land at the slide's position within the track.
		const left = slide.offsetLeft - layout.offsetLeft;
		layout.scrollTo( { left, behavior: 'smooth' } );
	}, [ active, count ] );

	return (
		<div className="gcb-replayout gcb-replayout--carousel">
			{ /* Editor nav bar — labelled, distinct from the block's OWN front-end
			   arrows, so there's no ambiguity about which control moves the editing
			   view. Sits ABOVE the stage as a toolbar, not floating over the slide. */ }
			<div className="gcb-replayout__editbar">
				<span className="gcb-replayout__editbar-label">
					{ __( 'Editing slide', 'gcblite' ) }
				</span>
				<span className="gcb-replayout__editbar-count">
					{ count ? `${ active + 1 } / ${ count }` : '0 / 0' }
				</span>
				<span className="gcb-replayout__editbar-nav">
					<button
						type="button"
						className="gcb-replayout__navbtn"
						onClick={ () => setActive( active - 1 ) }
						disabled={ active <= 0 }
					>
						{ __( '‹ Prev', 'gcblite' ) }
					</button>
					<button
						type="button"
						className="gcb-replayout__navbtn"
						onClick={ () => setActive( active + 1 ) }
						disabled={ active >= count - 1 }
					>
						{ __( 'Next ›', 'gcblite' ) }
					</button>
				</span>
			</div>
			<div className="gcb-replayout__stage" ref={ stageRef }>
				{ children }
			</div>
			<div className="gcb-replayout__foot">
				<div className="gcb-replayout__dots">
					{ childOrder.map( ( id, i ) => (
						<button
							key={ id }
							type="button"
							className={
								'gcb-replayout__dot' +
								( i === active ? ' is-on' : '' )
							}
							onClick={ () => setActive( i ) }
							aria-label={ sprintf(
								/* translators: %d: item number */
								__( 'Go to item %d', 'gcblite' ),
								i + 1
							) }
						/>
					) ) }
				</div>
				{ canAdd && (
					<AddButton
						label={ addLabel }
						onAdd={ onAdd }
						full={ false }
					/>
				) }
			</div>
		</div>
	);
}

/**
 * TABS — a compact strip of labelled tabs; the active tab's child is shown.
 *
 * @param {Object}   props
 * @param {Node}     props.children
 * @param {string[]} props.childOrder
 * @param {number}   props.active
 * @param {Function} props.setActive
 * @param {boolean}  props.canAdd
 * @param {Function} props.onAdd
 * @param {string}   props.addLabel
 */
function Tabs( {
	children,
	childOrder,
	active,
	setActive,
	onAdd,
	addLabel,
	canAdd,
} ) {
	const labels = useChildLabels( childOrder );
	return (
		<div
			className={ `gcb-replayout gcb-replayout--tabs is-active-${ active }` }
		>
			<div className="gcb-replayout__tabstrip" role="tablist">
				{ childOrder.map( ( id, i ) => (
					<button
						key={ id }
						type="button"
						role="tab"
						aria-selected={ i === active }
						className={
							'gcb-replayout__tab' +
							( i === active ? ' is-on' : '' )
						}
						onClick={ () => setActive( i ) }
					>
						<span className="gcb-replayout__tab-num">
							{ i + 1 }
						</span>
						<span className="gcb-replayout__tab-label">
							{ labels[ i ] }
						</span>
					</button>
				) ) }
				{ canAdd && (
					<button
						type="button"
						className="gcb-replayout__tab is-add"
						onClick={ onAdd }
						aria-label={ addLabel }
					>
						+
					</button>
				) }
			</div>
			<div className="gcb-replayout__stage">{ children }</div>
		</div>
	);
}

/**
 * ACCORDION — every child is a collapsible row. Clicking a header expands it (and
 * collapses the others); the expanded child's content shows DIRECTLY UNDER ITS
 * HEADER, like a real accordion.
 *
 * The InnerBlocks children must stay one contiguous tree (WP owns it), so we can't
 * physically place each child under its header. Instead the container is a flex
 * COLUMN holding the N headers plus the single shared stage, and we use flex
 * `order` to slot the stage in immediately after the active header:
 *   header i → order 2*i ; the stage → order (2*active + 1).
 * The stage CSS-reveals only child `active`, so the expanded content lands right
 * below its own header. Collapsed → all headers in order, no body.
 *
 * @param {Object}   props
 * @param {Node}     props.children
 * @param {string[]} props.childOrder
 * @param {number}   props.active
 * @param {Function} props.setActive
 * @param {boolean}  props.canAdd
 * @param {Function} props.onAdd
 * @param {string}   props.addLabel
 */
function Accordion( {
	children,
	childOrder,
	active,
	setActive,
	onAdd,
	addLabel,
	canAdd,
} ) {
	const labels = useChildLabels( childOrder );
	// Stage sits right after the active header (order 2*active+1); when collapsed
	// (active === -1) park it at the end so no body shows between headers.
	const stageOrder = active >= 0 ? 2 * active + 1 : 2 * childOrder.length;
	return (
		<div
			className={ `gcb-replayout gcb-replayout--accordion is-active-${ active }` }
		>
			{ childOrder.map( ( id, i ) => (
				<button
					key={ id }
					type="button"
					aria-expanded={ i === active }
					className={
						'gcb-replayout__head' + ( i === active ? ' is-on' : '' )
					}
					style={ { order: 2 * i } }
					onClick={ () => setActive( i === active ? -1 : i ) }
				>
					<span className="gcb-replayout__head-num">{ i + 1 }</span>
					<span className="gcb-replayout__head-label">
						{ labels[ i ] }
					</span>
					<span className="gcb-replayout__head-caret" aria-hidden>
						▾
					</span>
				</button>
			) ) }
			<div
				className="gcb-replayout__stage"
				style={ { order: stageOrder } }
			>
				{ children }
			</div>
			{ canAdd && (
				<div
					className="gcb-replayout__addrow"
					style={ { order: 2 * childOrder.length + 1 } }
				>
					<AddButton label={ addLabel } onAdd={ onAdd } />
				</div>
			) }
		</div>
	);
}

/**
 * FILMSTRIP — one big editing stage plus a thumbnail strip beneath. Clicking a
 * thumbnail makes that child the stage. (Thumbnails are numbered labels, not
 * live renders — cheap and clear.)
 *
 * @param {Object}   props
 * @param {Node}     props.children
 * @param {string[]} props.childOrder
 * @param {number}   props.active
 * @param {Function} props.setActive
 * @param {boolean}  props.canAdd
 * @param {Function} props.onAdd
 * @param {string}   props.addLabel
 */
function Filmstrip( {
	children,
	childOrder,
	active,
	setActive,
	onAdd,
	addLabel,
	canAdd,
} ) {
	const labels = useChildLabels( childOrder );
	return (
		<div
			className={ `gcb-replayout gcb-replayout--filmstrip is-active-${ active }` }
		>
			<div className="gcb-replayout__stage">{ children }</div>
			<div className="gcb-replayout__strip">
				{ childOrder.map( ( id, i ) => (
					<button
						key={ id }
						type="button"
						className={
							'gcb-replayout__thumb' +
							( i === active ? ' is-on' : '' )
						}
						onClick={ () => setActive( i ) }
						title={ labels[ i ] }
					>
						<span className="gcb-replayout__thumb-num">
							{ i + 1 }
						</span>
						<span className="gcb-replayout__thumb-label">
							{ labels[ i ] }
						</span>
					</button>
				) ) }
				{ canAdd && (
					<button
						type="button"
						className="gcb-replayout__thumb is-add"
						onClick={ onAdd }
						aria-label={ addLabel }
					>
						+
					</button>
				) }
			</div>
		</div>
	);
}

/**
 * OVERFLOW — a horizontal strip of cards the editor scrolls sideways. Every
 * child shows (like Stacked) but laid out in a row with horizontal scroll.
 *
 * @param {Object}   props
 * @param {Node}     props.children
 * @param {boolean}  props.canAdd
 * @param {Function} props.onAdd
 * @param {string}   props.addLabel
 */
function Overflow( { children, onAdd, addLabel, canAdd } ) {
	return (
		<div className="gcb-replayout gcb-replayout--overflow">
			<div className="gcb-replayout__track">{ children }</div>
			{ canAdd && <AddButton label={ addLabel } onAdd={ onAdd } /> }
		</div>
	);
}

/**
 * The arrangement dispatcher. Owns the editor-local active index (for the
 * one-at-a-time layouts), keeps it clamped as children are added/removed, then
 * renders the chosen arrangement around the (already-rendered) InnerBlocks.
 *
 * Unknown layout → carousel (the default).
 *
 * @param {Object}   props
 * @param {string}   props.layout     editLayout id
 * @param {Node}     props.children   rendered <InnerBlocks/>
 * @param {string[]} props.childOrder child clientIds, in order
 * @param {Function} props.onAdd
 * @param {string}   props.addLabel
 * @param {boolean}  props.canAdd
 */
export default function RepeaterLayout( {
	layout,
	children,
	childOrder = [],
	onAdd,
	addLabel,
	canAdd,
} ) {
	const count = childOrder.length;
	const [ active, setActiveRaw ] = useState( 0 );

	// Keep the active index in range as items come and go. (-1 is a valid
	// "all collapsed" state for the accordion; otherwise clamp into range.)
	useEffect( () => {
		setActiveRaw( ( cur ) => {
			if ( cur === -1 && layout === 'accordion' ) {
				return cur;
			}
			return clampIndex( cur, count );
		} );
	}, [ count, layout ] );

	const setActive = ( i ) => {
		if ( i === -1 ) {
			setActiveRaw( -1 );
			return;
		}
		setActiveRaw( clampIndex( i, count ) );
	};

	// Carousel + the one-at-a-time layouts track a real slide index, so clamp it.
	// (Accordion's -1 "all collapsed" is preserved by setActive, not clamped here.)
	const indexed = layout === 'carousel' || ONE_AT_A_TIME.includes( layout );
	const shared = {
		children,
		childOrder,
		active: indexed ? clampIndex( active, count ) : active,
		setActive,
		onAdd,
		addLabel,
		canAdd,
	};

	switch ( layout ) {
		case 'stacked':
			return <Stacked { ...shared } />;
		case 'tabs':
			return <Tabs { ...shared } />;
		case 'accordion':
			return <Accordion { ...shared } />;
		case 'filmstrip':
			return <Filmstrip { ...shared } />;
		case 'overflow':
			return <Overflow { ...shared } />;
		case 'carousel':
			return <Carousel { ...shared } />;
		default:
			// Unknown / legacy: behave like the old default — children render
			// directly so a front-end grid/flex still applies, plus an add button.
			return (
				<Fragment>
					{ children }
					{ canAdd && (
						<AddButton
							label={ addLabel }
							onAdd={ onAdd }
							full={ false }
						/>
					) }
				</Fragment>
			);
	}
}
