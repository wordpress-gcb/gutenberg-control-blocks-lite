/**
 * THE LAYOUT CONTROL: a list's layout, drawn in a small popover from the sidebar (Mark, 2026-10-06: "a smaller gcblite
 * field, where a user can design a 'layout' … an advanced version of cards per row" — "what I do is display them as
 * small popovers - like the image field" — of the mockup: "that's perfect").
 *
 * The board moves the way Mark's Tailwind Grid configurator does: each box stands where it was put; while a box is
 * dragged a ghost shows where it lands — snapped by its top-left corner plus half a cell — and turns red over another
 * box, where the drop is refused (nothing is pushed); the bottom-right corner resizes it both ways, refused over
 * another box; a click on an empty cell adds a box there. The columns stay within the list's limits. The value and
 * every rule are layout-value.js; this file is only the drawing and the gestures.
 */
import { controlComponents } from '@wordpress-gcb/fields';
import {
	BaseControl,
	Button,
	Dropdown,
	RangeControl,
	SelectControl,
	__experimentalDropdownContentWrapper as DropdownContentWrapper,
	__experimentalUnitControl as UnitControl,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import { Icon, close, plus } from '@wordpress/icons';
import { useRef, useState } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import { createBlock } from '@wordpress/blocks';
import { __, sprintf } from '@wordpress/i18n';
import { boxesFor, evenLayout, faultsOf, inReadingOrder, layoutOf, limitsOf, MAX_BOXES, MAX_ROWS, minSpanOf, phoneOf, placeSizes, rescale, rowsOf } from './layout-value';

/* THE LOOK (Mark's "Editor components — Styling Handover", 2026-10-06, and the canvas's "Layout popover — Gutenberg
   style"): a 304px Dropdown with a header and five sections — Start from, Columns, Arrangement, Minimum item width, On
   phones — in core controls; the board's rows 52px in a grey well. Only the selected item and the chosen preset carry
   colour. Behaviour is as it was. */
const ROW_PX = 52;
const clamp = ( n, lo, hi ) => Math.max( lo, Math.min( hi, n ) );
const hits = ( a, b ) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/* each preset in items' own width — the fewest columns an item spans (s) — so none makes an item too narrow */
const PRESETS = [
	[ __( 'Even', 'gcblite' ), ( c, s ) => ( { boxes: placeSizes( Array.from( { length: Math.floor( c.cols / s ) }, () => ( { w: s, h: 1 } ) ), c.cols ) } ) ],
	[ __( 'Feature', 'gcblite' ), ( c, s ) => ( c.cols >= 3 * s ? { boxes: placeSizes( [ { w: 2 * s, h: 2 }, ...Array.from( { length: Math.floor( ( c.cols - 2 * s ) / s ) * 2 }, () => ( { w: s, h: 1 } ) ) ], c.cols ) } : null ) ],
	[ __( 'Wide', 'gcblite' ), ( c, s ) => ( c.cols >= 2 * s ? { boxes: placeSizes( [ { w: c.cols, h: 1 }, ...Array.from( { length: Math.floor( c.cols / s ) }, () => ( { w: s, h: 1 } ) ) ], c.cols ) } : null ) ],
	[ __( 'Bento', 'gcblite' ), ( c, s ) => ( c.cols >= 4 * s ? { boxes: placeSizes( [ { w: 2 * s, h: 2 }, { w: s, h: 1 }, { w: s, h: 1 }, { w: 2 * s, h: 1 } ], c.cols ) } : null ) ],
];

/** a small drawing of a layout: the sidebar's button and each preset */
function Thumb( { v, className } ) {
	return (
		<span className={ className } style={ { gridTemplateColumns: `repeat(${ v.cols }, minmax(0, 1fr))` } } aria-hidden="true">
			{ v.boxes.map( ( b, k ) => (
				<i key={ k } style={ { gridColumn: `${ b.x + 1 } / span ${ b.w }`, gridRow: `${ b.y + 1 } / span ${ b.h }` } } />
			) ) }
		</span>
	);
}

/* the boxes alone, for comparing a layout with a preset */
const boxesKey = ( boxes ) => JSON.stringify( inReadingOrder( boxes ).map( ( b ) => [ b.x, b.y, b.w, b.h ] ) );

export default function LayoutControl( { control, value, onChange, clientId } ) {
	const limits = limitsOf( control );
	const stored = layoutOf( value, control );
	/* THE LIST IT LAYS OUT: the selected block's items (Mark, 2026-10-06: "2 extra cards there at the bottom … you
	   can't control them from teh grid module") — the board has a box for every item, and adds items where it is clicked */
	const { listId, itemCount, itemName } = useSelect( ( select ) => {
		const be = select( 'core/block-editor' );
		const id = clientId || be?.getSelectedBlockClientId?.();
		const order = id ? be.getBlockOrder( id ) : [];
		return { listId: id, itemCount: order.length, itemName: order.length ? be.getBlockName( order[ 0 ] ) : null };
	}, [ clientId ] );
	const { insertBlock } = useDispatch( 'core/block-editor' );
	/* A GRID OF FIXED BOXES (Mark, 2026-10-09: "more things … like text / image"): the control says how many, the
	   board shows exactly those, and an empty cell adds nothing — the boxes are the block's own children */
	const fixed = limits.count > 0;
	const count = fixed ? limits.count : listId ? itemCount : stored.boxes.length;
	const v = { ...stored, boxes: boxesFor( stored, count ) };
	const [ selected, setSelected ] = useState( 0 );
	const [ drag, setDrag ] = useState( null );
	const [ msg, setMsg ] = useState( { text: '', bad: false } );
	const boardRef = useRef( null );
	const baseRef = useRef( null );
	const say = ( text, bad = false ) => setMsg( { text, bad } );
	const set = ( next ) => {
		const f = faultsOf( next, control );
		if ( f.length ) {
			say( f[ 0 ], true );
			return false;
		}
		onChange( next );
		return true;
	};

	const n = v.boxes.length;
	/* the rows the boxes take, and one spare to drop or grow into */
	const rows = rowsOf( v ) + 1;
	const num = new Map( inReadingOrder( v.boxes ).map( ( b, k ) => [ b, k + 1 ] ) );

	/* the fewest columns an item spans at this count (Mark, 2026-10-06: "for lots of columns, it'll span x number of cols") */
	const span = minSpanOf( v, control );
	const narrowest = v.minPx || limits.minItemPx;

	/* more or fewer columns keep the look: each box scaled where it stood (layout-value.js rescale) */
	/* a run of column changes scales from the layout as it was before the run, not from the last step — stepped 4 to 12 a
	   column at a time, a 2-wide box compounded its rounding to 10 (2026-10-06); any other change starts a new run */
	const setCols = ( c ) => {
		const cols = clamp( c, limits.minCols, limits.maxCols );
		if ( cols === v.cols ) {
			return;
		}
		const base = baseRef.current && baseRef.current.after === JSON.stringify( v ) ? baseRef.current.v : v;
		const next = rescale( base, cols, control );
		if ( set( next ) ) {
			baseRef.current = { v: base, after: JSON.stringify( { ...v, ...next, boxes: boxesFor( next, count ) } ) };
			say( sprintf( __( '%1$d columns: an item spans at least %2$d.', 'gcblite' ), cols, minSpanOf( { ...v, cols }, control ) ) );
		}
	};

	/* the narrowest an item may be: boxes now too narrow are widened where they stand */
	const setNarrowest = ( px ) => {
		const minPx = Math.max( 0, Math.round( +px || 0 ) );
		const next = { ...v, minPx: minPx || undefined };
		if ( ! minPx ) {
			delete next.minPx;
		}
		if ( set( faultsOf( next, control ).length ? rescale( next, v.cols, control ) : next ) ) {
			say( sprintf( __( 'An item is at least %1$dpx: at %2$d columns it spans %3$d.', 'gcblite' ), minPx || limits.minItemPx, v.cols, minSpanOf( next, control ) ) );
		}
	};

	const metrics = () => {
		const el = boardRef.current;
		const r = el.getBoundingClientRect();
		const cs = el.ownerDocument.defaultView.getComputedStyle( el );
		const gap = parseFloat( cs.columnGap ) || 4;
		const pad = parseFloat( cs.paddingLeft ) || 4;
		return { r, gap, pad, colW: ( r.width - pad * 2 - gap * ( v.cols - 1 ) ) / v.cols };
	};

	const onPointerDown = ( e ) => {
		/* a spare box — one no item takes yet — may go; an item's box goes with the item, on the canvas */
		const rm = e.target.closest( '[data-rm]' );
		if ( rm ) {
			set( { ...v, boxes: v.boxes.filter( ( _, k ) => k !== +rm.dataset.rm ) } );
			say( __( 'Spare box removed.', 'gcblite' ) );
			return;
		}
		/* an empty cell: a new item, placed there (the movement of Mark's Tailwind Grid configurator) */
		const cell = e.target.closest( '[data-cell]' );
		if ( cell ) {
			if ( fixed ) {
				say( sprintf( __( 'This grid has %d boxes — move or resize them; the block decides what is in them.', 'gcblite' ), count ), true );
				return;
			}
			if ( n >= MAX_BOXES ) {
				say( sprintf( __( 'A layout has at most %d boxes.', 'gcblite' ), MAX_BOXES ), true );
				return;
			}
			/* an item's own width: the fewest columns it spans, as far left as it must go to fit */
			const c = { x: Math.min( +cell.dataset.x, v.cols - span ), y: +cell.dataset.y, w: span, h: 1 };
			if ( listId && ! itemName ) {
				say( __( 'Add the first item on the page; the layout places the rest.', 'gcblite' ), true );
				return;
			}
			/* the new item lands after the others; its box is placed where the cell was, and reading order decides who sits where */
			const boxes = [ ...v.boxes.slice( 0, count ), c, ...v.boxes.slice( count ) ];
			if ( set( { ...v, boxes } ) ) {
				if ( listId && itemName ) {
					insertBlock( createBlock( itemName ), count, listId, false );
				}
				setSelected( count );
				say( sprintf( __( 'Item added at column %1$d, row %2$d.', 'gcblite' ), c.x + 1, c.y + 1 ) );
			}
			return;
		}
		const slot = e.target.closest( '[data-k]' );
		if ( ! slot ) {
			return;
		}
		const k = +slot.dataset.k;
		const b = v.boxes[ k ];
		const sr = slot.getBoundingClientRect();
		setSelected( k );
		boardRef.current.setPointerCapture( e.pointerId );
		setDrag( { k, mode: e.target.dataset.corner ? 'corner' : 'move', x0: e.clientX, y0: e.clientY, offX: e.clientX - sr.left, offY: e.clientY - sr.top, w0: b.w, h0: b.h, m: metrics(), ghost: null, moved: false } );
		e.preventDefault();
	};

	const onPointerMove = ( e ) => {
		if ( ! drag ) {
			return;
		}
		const { m } = drag;
		const b = v.boxes[ drag.k ];
		const moved = drag.moved || Math.abs( e.clientX - drag.x0 ) + Math.abs( e.clientY - drag.y0 ) > 3;
		if ( drag.mode === 'corner' ) {
			const w = clamp( drag.w0 + Math.round( ( e.clientX - drag.x0 ) / ( m.colW + m.gap ) ), span, v.cols - b.x );
			const h = clamp( drag.h0 + Math.round( ( e.clientY - drag.y0 ) / ( ROW_PX + m.gap ) ), 1, Math.min( MAX_ROWS, rows - b.y ) );
			if ( w === b.w && h === b.h ) {
				return;
			}
			const c = { ...b, w, h };
			if ( v.boxes.some( ( o, j ) => j !== drag.k && hits( o, c ) ) ) {
				say( __( 'That would cover another box.', 'gcblite' ), true );
				return;
			}
			onChange( { ...v, boxes: v.boxes.map( ( o, j ) => ( j === drag.k ? c : o ) ) } );
			say( sprintf( __( 'Box is %1$d wide and %2$d tall.', 'gcblite' ), w, h ) );
			return;
		}
		const left = e.clientX - drag.offX - m.r.left - m.pad;
		const top = e.clientY - drag.offY - m.r.top - m.pad;
		const x = clamp( Math.floor( ( left + m.colW / 2 ) / ( m.colW + m.gap ) ), 0, v.cols - b.w );
		const y = clamp( Math.floor( ( top + ROW_PX / 2 ) / ( ROW_PX + m.gap ) ), 0, rows - b.h );
		const c = { ...b, x, y };
		const bad = v.boxes.some( ( o, j ) => j !== drag.k && hits( o, c ) );
		setDrag( { ...drag, moved, ghost: { ...c, bad }, px: { left: e.clientX - drag.offX, top: e.clientY - drag.offY } } );
	};

	const onPointerUp = () => {
		if ( drag && drag.mode === 'move' && drag.moved && drag.ghost ) {
			const g = drag.ghost;
			const b = v.boxes[ drag.k ];
			if ( g.bad ) {
				say( __( 'Not there: it would cover another box.', 'gcblite' ), true );
			} else if ( g.x !== b.x || g.y !== b.y ) {
				onChange( { ...v, boxes: v.boxes.map( ( o, j ) => ( j === drag.k ? { ...o, x: g.x, y: g.y } : o ) ) } );
				say( sprintf( __( 'Moved to column %1$d, row %2$d.', 'gcblite' ), g.x + 1, g.y + 1 ) );
			}
		}
		setDrag( null );
	};

	const onKeyDown = ( e ) => {
		const slot = e.target.closest( '[data-k]' );
		const d = { ArrowRight: [ 1, 0 ], ArrowLeft: [ -1, 0 ], ArrowDown: [ 0, 1 ], ArrowUp: [ 0, -1 ] }[ e.key ];
		if ( ! slot || ! d ) {
			return;
		}
		e.preventDefault();
		const k = +slot.dataset.k;
		const b = v.boxes[ k ];
		const c = e.shiftKey ? { ...b, w: b.w + d[ 0 ], h: b.h + d[ 1 ] } : { ...b, x: b.x + d[ 0 ], y: b.y + d[ 1 ] };
		if ( c.w < 1 || c.h > MAX_ROWS || c.y + c.h > rows ) {
			say( __( 'That is as far as it goes.', 'gcblite' ), true );
			return;
		}
		if ( set( { ...v, boxes: v.boxes.map( ( o, j ) => ( j === k ? c : o ) ) } ) ) {
			say( e.shiftKey ? sprintf( __( 'Box is %1$d wide and %2$d tall.', 'gcblite' ), c.w, c.h ) : sprintf( __( 'Moved to column %1$d, row %2$d.', 'gcblite' ), c.x + 1, c.y + 1 ) );
		}
	};

	/* which preset the layout is — named in the sidebar, checked among the thumbnails — or none: Custom */
	const presets = PRESETS.map( ( [ name, make ] ) => ( { name, make, value: make( v, span ), drawing: make( { cols: 4 }, 1 ) } ) );
	const mine = boxesKey( stored.boxes );
	const current = presets.find( ( p ) => p.value && v.cols === stored.cols && boxesKey( p.value.boxes ) === mine );
	const summary = sprintf(
		/* translators: 1: a preset's name or "Custom", 2: the number of columns */
		v.cols === 1 ? __( '%1$s, %2$d column', 'gcblite' ) : __( '%1$s, %2$d columns', 'gcblite' ),
		current ? current.name : __( 'Custom', 'gcblite' ),
		v.cols
	);
	/* a grid of fixed boxes repeats nothing: it has exactly these boxes (2026-10-09) */
	const repeats = fixed
		? sprintf( __( '%d boxes', 'gcblite' ), count )
		: n === 1 ? __( 'Every item the same', 'gcblite' ) : sprintf( __( 'Repeats every %d items', 'gcblite' ), n );

	const cells = [];
	for ( let y = 0; y < rows; y++ ) {
		for ( let x = 0; x < v.cols; x++ ) {
			cells.push(
				<div key={ `c${ x }-${ y }` } className="gcblite-layout-cell" data-cell="1" data-x={ x } data-y={ y } style={ { gridColumn: x + 1, gridRow: y + 1 } }
					title={ sprintf( __( 'Add an item at column %1$d, row %2$d', 'gcblite' ), x + 1, y + 1 ) }>
					<Icon icon={ plus } size={ 20 } className="gcblite-layout-plus" />
				</div>
			);
		}
	}

	const board = (
		/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */
		<div ref={ boardRef } className="gcblite-layout-board" style={ { gridTemplateColumns: `repeat(${ v.cols }, minmax(0, 1fr))`, gridAutoRows: `${ ROW_PX }px` } }
			onPointerDown={ onPointerDown } onPointerMove={ onPointerMove } onPointerUp={ onPointerUp } onPointerCancel={ onPointerUp } onKeyDown={ onKeyDown }>
			{ cells }
			{ v.boxes.map( ( b, k ) => {
				const spare = num.get( b ) > count;
				return (
					<div key={ k } data-k={ k } tabIndex={ 0 } role="button" aria-pressed={ k === selected }
						className={ 'gcblite-layout-box' + ( k === selected ? ' is-selected' : '' ) + ( spare ? ' is-spare' : '' ) + ( drag && drag.k === k && drag.mode === 'move' && drag.moved ? ' is-dragging' : '' ) }
						style={ { gridColumn: `${ b.x + 1 } / span ${ b.w }`, gridRow: `${ b.y + 1 } / span ${ b.h }` } }
						aria-label={ spare
							? sprintf( __( 'Spare box, %1$d by %2$d', 'gcblite' ), b.w, b.h )
							: sprintf( __( 'Item %1$d, %2$d by %3$d', 'gcblite' ), num.get( b ), b.w, b.h ) }>
						{ spare ? '·' : num.get( b ) }
						<span className="gcblite-layout-size">{ b.w }×{ b.h }</span>
						{ spare && (
							<button type="button" className="gcblite-layout-remove" data-rm={ k } aria-label={ __( 'Remove this spare box', 'gcblite' ) }>×</button>
						) }
						<span className="gcblite-layout-corner" data-corner="1" />
					</div>
				);
			} ) }
			{ drag && drag.ghost && (
				<div className={ 'gcblite-layout-ghost' + ( drag.ghost.bad ? ' is-bad' : '' ) }
					style={ { gridColumn: `${ drag.ghost.x + 1 } / span ${ drag.ghost.w }`, gridRow: `${ drag.ghost.y + 1 } / span ${ drag.ghost.h }` } } />
			) }
		</div>
	);

	return (
		<BaseControl
			__nextHasNoMarginBottom
			id={ `gcblite-layout-${ control.attributeKey }` }
			label={ control.label || __( 'Layout', 'gcblite' ) }
			/* the panel round it is titled Layout already */
			hideLabelFromVision
			help={ v.phone === 0
				? __( 'Sets where each item sits, on every screen.', 'gcblite' )
				: __( 'Sets where each item sits on wide screens. Phones use their own setting.', 'gcblite' ) }
		>
			<Dropdown
				className="gcblite-layout-dropdown"
				contentClassName="gcblite-layout-popover"
				popoverProps={ { placement: 'left-start', offset: 36, shift: true } }
				focusOnMount="firstElement"
				renderToggle={ ( { isOpen, onToggle } ) => (
					<Button id={ `gcblite-layout-${ control.attributeKey }` } className="gcblite-layout-trigger" aria-expanded={ isOpen } onClick={ onToggle }>
						<Thumb v={ v } className="gcblite-layout-thumb" />
						<span className="gcblite-layout-trigger__text">
							<strong>{ summary }</strong>
							<span>{ repeats }</span>
						</span>
					</Button>
				) }
				renderContent={ ( { onClose } ) => (
					<DropdownContentWrapper paddingSize="none" className="gcblite-layout-pop">
						<div className="gcblite-layout-header">
							<span>{ control.label || __( 'Layout', 'gcblite' ) }</span>
							<span className="gcblite-layout-header__actions">
								{ /* back to the layout as drawn: nothing stored */ }
								<Button variant="tertiary" size="compact" onClick={ () => {
									onChange( undefined );
									setSelected( 0 );
									say( __( 'Back to the layout as drawn.', 'gcblite' ) );
								} }>{ __( 'Reset', 'gcblite' ) }</Button>
								<Button icon={ close } size="compact" label={ __( 'Close', 'gcblite' ) } onClick={ onClose } />
							</span>
						</div>
						<VStack spacing={ 5 } className="gcblite-layout-body">
							<BaseControl __nextHasNoMarginBottom id={ `gcblite-layout-start-${ control.attributeKey }` } label={ __( 'Start from', 'gcblite' ) }>
								<div className="gcblite-layout-presets" role="radiogroup" aria-label={ __( 'Start from', 'gcblite' ) }>
									{ presets.map( ( p ) => (
										<button key={ p.name } type="button" role="radio" aria-checked={ current === p } disabled={ ! p.value }
											className="gcblite-layout-preset"
											title={ p.value ? p.name : __( 'Too many columns for this at the minimum item width', 'gcblite' ) }
											onClick={ () => p.value && set( { ...v, ...p.value } ) && say( p.name ) }>
											<Thumb v={ { cols: 4, boxes: p.drawing ? p.drawing.boxes : [] } } className="gcblite-layout-preset__thumb" />
											<span>{ p.name }</span>
										</button>
									) ) }
								</div>
							</BaseControl>
							<RangeControl
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								label={ __( 'Columns', 'gcblite' ) }
								min={ limits.minCols }
								max={ limits.maxCols }
								value={ v.cols }
								withInputField
								onChange={ ( c ) => Number.isFinite( c ) && setCols( c ) }
							/>
							<div className="gcblite-layout-arrangement">
								<div className="gcblite-layout-label-row">
									<span className="gcblite-layout-label">{ __( 'Arrangement', 'gcblite' ) }</span>
									<span className="gcblite-layout-help">{ repeats }</span>
								</div>
								{ board }
								<p className={ 'gcblite-layout-help' + ( msg.bad ? ' is-bad' : '' ) } role="status">
									{ msg.bad ? msg.text : __( 'Drag to move, drag a corner to resize, or click an empty cell to add an item.', 'gcblite' ) }
								</p>
							</div>
							<UnitControl
								__next40pxDefaultSize
								label={ __( 'Minimum item width', 'gcblite' ) }
								units={ [ { value: 'px', label: 'px' } ] }
								value={ narrowest ? `${ narrowest }px` : '' }
								min={ 0 }
								step={ 10 }
								className="gcblite-layout-minw"
								onChange={ ( val ) => setNarrowest( parseFloat( val ) || 0 ) }
								/* what it does (the handover asked it be checked): no item is placed narrower — at this many columns
								   that is a span of at least so many */
								help={ span > 1
									? sprintf( __( 'No item is narrower than this: at %1$d columns, each spans at least %2$d.', 'gcblite' ), v.cols, span )
									: __( 'No item is placed narrower than this.', 'gcblite' ) }
							/>
							<SelectControl
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								label={ __( 'On phones', 'gcblite' ) }
								value={ v.phone === 0 ? 'same' : String( v.phone ) }
								options={ [
									{ value: '1', label: __( '1 per row', 'gcblite' ) },
									{ value: '2', label: __( '2 per row', 'gcblite' ) },
									{ value: 'same', label: __( 'Same as wide screens', 'gcblite' ) },
								] }
								onChange={ ( p ) => onChange( { ...v, phone: phoneOf( p ) } ) }
							/>
						</VStack>
					</DropdownContentWrapper>
				) }
			/>
		</BaseControl>
	);
}

export function registerLayoutControl() {
	if ( controlComponents && ! controlComponents.layout ) {
		controlComponents.layout = LayoutControl;
	}
}
