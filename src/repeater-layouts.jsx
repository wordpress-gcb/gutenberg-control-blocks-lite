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

/*
 * EDITING CHROME CARRIES `data-gcb-chrome` (2026-09-22). Everything here that
 * is not the block's own content — the edit bar, the dots, the tab strip, the
 * accordion heads, the thumbnails, the Add button — is marked, and a block's
 * scoped stylesheet (gcb-pro's Tailwind reset, `.gcb-block button {…}`) steps
 * round it. Without the mark, the block's reset out-ranked these rules and took
 * the face off Prev/Next: 36×20px of grey text a person could not find, beside
 * the block's own dead 48px front-end arrows.
 */
import { Fragment, createContext, createPortal, useState, useEffect, useLayoutEffect, useRef } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';
import { useRepeaterActive } from './utils/repeater-active';

/*
 * A LIST WHOSE ITEMS CARRY THEIR OWN TAB IS EDITED WHERE ITS TABS STAND (Mark, 2026-10-05: "the tabs almost work in
 * teh editor, but they should display more like the front end. ie. the tabs where they are on the front end wiwth
 * the add button at the bottom"). gcb-pro's kit tabs are ONE list — each item its own tab ([data-gcb-kit-tab]) and
 * its own panel — beside a box the design placed for the strip of tabs ([data-gcb-kit-tablist]), which the kit's
 * script fills on the front end. No script runs here, so the tabs layout does it the editor's way: it finds that
 * box, hands it down (this context), and each item's tab is drawn INTO it by a portal (parse-preview.js KitTabTag) —
 * still its item's own element, so its name and icon are edited in place — with the Add button under the last one.
 * The numbered strip this layout draws for any other list is then not needed.
 */
export const RepeaterStripContext = createContext( null );

/**
 * The box the design placed for the strip of tabs, for a list standing at `el`: the tablist of the kit tabs it is
 * in — not one the list itself stands inside, and not the strip of other tabs nested in a panel or standing round.
 *
 * @param {?Element} el the list's own element
 * @return {?Element} the strip's box, or null
 */
export function kitStripOf( el ) {
	const root = el && el.closest ? el.closest( '[data-gcb-kit="tabs"]' ) : null;
	if ( ! root ) {
		return null;
	}
	for ( const strip of root.querySelectorAll( '[data-gcb-kit-tablist]' ) ) {
		if ( strip.closest( '[data-gcb-kit="tabs"]' ) === root && ! strip.contains( el ) ) {
			return strip;
		}
	}
	return null;
}

/**
 * Which slide holds the editor's selection: the selected child itself, or
 * the child a nested selection sits inside. -1 when the selection is not in
 * this repeater. (Mark, 2026-09-22: "when you add a new one, focus into
 * that" — adding selects the new block; the arrangement follows.)
 *
 * @param {string[]} childOrder the children's clientIds, in order
 * @param {?string}  selected   the selected block's clientId
 * @param {string[]} parents    its ancestors, outermost first
 * @return {number} slide index, or -1
 */
export function slideForSelection( childOrder, selected, parents ) {
	if ( ! selected ) {
		return -1;
	}
	const direct = childOrder.indexOf( selected );
	if ( direct >= 0 ) {
		return direct;
	}
	for ( const p of parents || [] ) {
		const i = childOrder.indexOf( p );
		if ( i >= 0 ) {
			return i;
		}
	}
	return -1;
}

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

/*
 * NO ADD BUTTON IN ANY LAYOUT (2026-10-18): items are added from the one strip under the block (block-footer.jsx),
 * the same place for every layout. canAdd/onAdd/addLabel are still passed for layouts a theme may draw itself.
 */

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

	/* both ends go round (the page's carousel loops too); one slide has no arrows or dots */
	const go = ( i ) => setActive( ( ( i % count ) + count ) % count );
	return (
		<div className="gcb-replayout gcb-replayout--carousel">
			<div className="gcb-replayout__stage" ref={ stageRef }>
				{ children }
				{ count > 1 && (
					<>
						{ /* THE ARROWS AND DOTS AS THE PAGE DRAWS THEM (2026-10-18): over the slide, the same size, place
						   and look as the front end's, so the editor shows the design; here they choose the slide being
						   edited. The switcher with numbers is in the strip under the block. */ }
						<button
							type="button"
							className="gcb-replayout__arrow is-prev"
							data-gcb-chrome=""
							onClick={ () => go( active - 1 ) }
							aria-label={ __( 'Previous slide', 'gcblite' ) }
						>
							<Chevron dir="prev" />
						</button>
						<button
							type="button"
							className="gcb-replayout__arrow is-next"
							data-gcb-chrome=""
							onClick={ () => go( active + 1 ) }
							aria-label={ __( 'Next slide', 'gcblite' ) }
						>
							<Chevron dir="next" />
						</button>
						<div className="gcb-replayout__dots" data-gcb-chrome="">
							{ childOrder.map( ( id, i ) => (
								<button
									key={ id }
									type="button"
									className={ 'gcb-replayout__dot' + ( i === active ? ' is-on' : '' ) }
									onClick={ () => go( i ) }
									aria-current={ i === active ? 'true' : undefined }
									aria-label={ sprintf(
										/* translators: %d: slide number */
										__( 'Go to slide %d', 'gcblite' ),
										i + 1
									) }
								/>
							) ) }
						</div>
					</>
				) }
			</div>
		</div>
	);
}

/**
 * A chevron, drawn (no text glyph): 24-unit box, the arrow's colour.
 * @param {Object} props
 * @param {string} props.dir 'prev' | 'next'
 */
function Chevron( { dir } ) {
	return (
		<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
			<path
				d={ dir === 'prev' ? 'M15 5.5 8.5 12l6.5 6.5' : 'm9 5.5 6.5 6.5L9 18.5' }
				fill="none"
				stroke="currentColor"
				strokeWidth="2.25"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
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
	/* the strip's own box, when the design placed one (the kit's tabs): looked for after every render, since the
	   block round this list is re-drawn from its preview and the box with it */
	const ref = useRef( null );
	const [ strip, setStrip ] = useState( null );
	useLayoutEffect( () => {
		const found = kitStripOf( ref.current );
		if ( found !== strip ) {
			setStrip( found );
		}
	} );
	/* the tabs are put in order by `order`, which a plain block box does not heed: there it stacks as a column */
	useEffect( () => {
		if ( ! strip ) {
			return undefined;
		}
		const view = strip.ownerDocument.defaultView;
		const plain = ! /flex|grid/.test( view.getComputedStyle( strip ).display );
		if ( plain ) {
			strip.style.display = 'flex';
			strip.style.flexDirection = 'column';
		}
		return () => {
			if ( plain ) {
				strip.style.display = '';
				strip.style.flexDirection = '';
			}
		};
	}, [ strip ] );
	if ( strip ) {
		return (
			<div
				ref={ ref }
				className={ `gcb-replayout gcb-replayout--tabs is-in-place is-active-${ active }` }
			>
				<RepeaterStripContext.Provider value={ { strip, childOrder, active, setActive } }>
					<div className="gcb-replayout__stage">{ children }</div>
				</RepeaterStripContext.Provider>
			</div>
		);
	}
	return (
		<div
			ref={ ref }
			className={ `gcb-replayout gcb-replayout--tabs is-active-${ active }` }
		>
			<div className="gcb-replayout__tabstrip" role="tablist" data-gcb-chrome="">
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
					data-gcb-chrome=""
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
			<div className="gcb-replayout__strip" data-gcb-chrome="">
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
	clientId,
	layout,
	children,
	childOrder = [],
	onAdd,
	addLabel,
	canAdd,
} ) {
	const count = childOrder.length;
	/* shared with the strip under the block (utils/repeater-active.js): its numbered switcher and these arrows move
	   the same slide */
	const [ active, setActiveRaw ] = useRepeaterActive( clientId );

	// Follow the editor's selection: the slide that holds the selected block
	// comes on stage (a new item is selected as it is added; so is a click in
	// the list view). Read only — nothing here selects anything.
	const selectedSlide = useSelect(
		( select ) => {
			const be = select( 'core/block-editor' );
			const id = be.getSelectedBlockClientId();
			return slideForSelection( childOrder, id, id ? be.getBlockParents( id ) : [] );
		},
		[ childOrder ]
	);
	useEffect( () => {
		if ( selectedSlide >= 0 ) {
			setActiveRaw( selectedSlide );
		}
	}, [ selectedSlide ] );

	// Keep the active index in range as items come and go. (-1 is a valid
	// "all collapsed" state for the accordion; otherwise clamp into range.)
	useEffect( () => {
		if ( ! ( active === -1 && layout === 'accordion' ) ) {
			setActiveRaw( clampIndex( active, count ) );
		}
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
			// Unknown / legacy (the block's own grid): children render directly so a front-end grid/flex still applies.
			return children;
	}
}
