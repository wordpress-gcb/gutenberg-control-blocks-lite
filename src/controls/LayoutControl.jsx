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
import { BaseControl, Button, Popover, SelectControl, __experimentalNumberControl as NumberControl } from '@wordpress/components';
import { useRef, useState } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import { createBlock } from '@wordpress/blocks';
import { __, sprintf } from '@wordpress/i18n';
import { boxesFor, evenLayout, faultsOf, inReadingOrder, layoutOf, limitsOf, MAX_BOXES, MAX_ROWS, minSpanOf, placeSizes, rescale, rowsOf } from './layout-value';

const ROW_PX = 40;
const clamp = ( n, lo, hi ) => Math.max( lo, Math.min( hi, n ) );
const hits = ( a, b ) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/* each preset in items' own width — the fewest columns an item spans (s) — so none makes an item too narrow */
const PRESETS = [
	[ __( 'Even rows', 'gcblite' ), ( c, s ) => ( { boxes: placeSizes( Array.from( { length: Math.floor( c.cols / s ) }, () => ( { w: s, h: 1 } ) ), c.cols ) } ) ],
	[ __( 'Feature first', 'gcblite' ), ( c, s ) => ( c.cols >= 3 * s ? { boxes: placeSizes( [ { w: 2 * s, h: 2 }, ...Array.from( { length: Math.floor( ( c.cols - 2 * s ) / s ) * 2 }, () => ( { w: s, h: 1 } ) ) ], c.cols ) } : null ) ],
	[ __( 'Wide first', 'gcblite' ), ( c, s ) => ( c.cols >= 2 * s ? { boxes: placeSizes( [ { w: c.cols, h: 1 }, ...Array.from( { length: Math.floor( c.cols / s ) }, () => ( { w: s, h: 1 } ) ) ], c.cols ) } : null ) ],
	[ __( 'Bento', 'gcblite' ), ( c, s ) => ( c.cols >= 4 * s ? { boxes: placeSizes( [ { w: 2 * s, h: 2 }, { w: s, h: 1 }, { w: s, h: 1 }, { w: 2 * s, h: 1 } ], c.cols ) } : null ) ],
];

/** a small drawing of the layout, for the sidebar's button */
function Thumb( { v } ) {
	return (
		<span className="gcblite-layout-thumb" style={ { gridTemplateColumns: `repeat(${ v.cols }, 1fr)` } } aria-hidden="true">
			{ v.boxes.map( ( b, k ) => (
				<i key={ k } style={ { gridColumn: `${ b.x + 1 } / span ${ b.w }`, gridRow: `${ b.y + 1 } / span ${ b.h }` } } />
			) ) }
		</span>
	);
}

export default function LayoutControl( { control, value, onChange } ) {
	const limits = limitsOf( control );
	const stored = layoutOf( value, control );
	/* THE LIST IT LAYS OUT: the selected block's items (Mark, 2026-10-06: "2 extra cards there at the bottom … you
	   can't control them from teh grid module") — the board has a box for every item, and adds items where it is clicked */
	const { listId, itemCount, itemName } = useSelect( ( select ) => {
		const be = select( 'core/block-editor' );
		const id = be?.getSelectedBlockClientId?.();
		const order = id ? be.getBlockOrder( id ) : [];
		return { listId: id, itemCount: order.length, itemName: order.length ? be.getBlockName( order[ 0 ] ) : null };
	}, [] );
	const { insertBlock } = useDispatch( 'core/block-editor' );
	const count = listId ? itemCount : stored.boxes.length;
	const v = { ...stored, boxes: boxesFor( stored, count ) };
	const [ open, setOpen ] = useState( false );
	const [ anchor, setAnchor ] = useState( null );
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
	const even = v.boxes.every( ( b ) => b.w === 1 && b.h === 1 ) && rowsOf( v ) === 1 && n === v.cols;

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
		const gap = parseFloat( cs.columnGap ) || 6;
		const pad = parseFloat( cs.paddingLeft ) || 6;
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

	const cells = [];
	for ( let y = 0; y < rows; y++ ) {
		for ( let x = 0; x < v.cols; x++ ) {
			cells.push(
				<div key={ `c${ x }-${ y }` } className="gcblite-layout-cell" data-cell="1" data-x={ x } data-y={ y } style={ { gridColumn: x + 1, gridRow: y + 1 } }
					title={ sprintf( __( 'Add a box at column %1$d, row %2$d', 'gcblite' ), x + 1, y + 1 ) } />
			);
		}
	}

	return (
		<BaseControl __nextHasNoMarginBottom id={ `gcblite-layout-${ control.attributeKey }` } label={ control.label || __( 'Layout', 'gcblite' ) } help={ control.help || __( 'Where each item sits on a wide screen. Phones keep their own layout.', 'gcblite' ) }>
			<button type="button" id={ `gcblite-layout-${ control.attributeKey }` } ref={ setAnchor } className="gcblite-layout-button" aria-expanded={ open } onClick={ () => setOpen( ( o ) => ! o ) }>
				<Thumb v={ v } />
				<span>
					{ even ? sprintf( __( '%d per row', 'gcblite' ), v.cols ) : sprintf( __( 'Custom, %d columns', 'gcblite' ), v.cols ) }
					<small>{ n === 1 ? __( 'Every item the same', 'gcblite' ) : sprintf( __( 'Repeats every %d items', 'gcblite' ), n ) }</small>
				</span>
			</button>
			{ open && (
				<Popover anchor={ anchor } placement="left-start" offset={ 12 } onClose={ () => setOpen( false ) } className="gcblite-layout-popover" focusOnMount="firstElement">
					<div className="gcblite-layout-pop">
						<div className="gcblite-layout-row">
							<strong>{ __( 'Columns', 'gcblite' ) }</strong>
							<span className="gcblite-layout-note">
								{ sprintf( __( '%1$d–%2$d', 'gcblite' ), limits.minCols, limits.maxCols ) }
							</span>
							<span className="gcblite-layout-step">
								{ /* stays focusable when it stops: a button that loses focus as it disables closes the popover (12 columns, 2026-10-06) */ }
								<Button size="small" accessibleWhenDisabled onClick={ () => setCols( v.cols - 1 ) } disabled={ v.cols <= limits.minCols } label={ __( 'Fewer columns', 'gcblite' ) }>−</Button>
								<output>{ v.cols }</output>
								<Button size="small" accessibleWhenDisabled onClick={ () => setCols( v.cols + 1 ) } disabled={ v.cols >= limits.maxCols } label={ __( 'More columns', 'gcblite' ) }>+</Button>
							</span>
						</div>
						<div className="gcblite-layout-row">
							<NumberControl
								__next40pxDefaultSize
								label={ __( 'Narrowest item (px)', 'gcblite' ) }
								value={ narrowest || '' }
								min={ 0 }
								step={ 10 }
								onChange={ setNarrowest }
								help={ sprintf( __( 'At %1$d columns an item spans at least %2$d.', 'gcblite' ), v.cols, span ) }
							/>
						</div>
						<div className="gcblite-layout-presets">
							{ PRESETS.map( ( [ name, make ] ) => {
								const p = make( v, span );
								return (
									<Button key={ name } variant="secondary" size="small" disabled={ ! p } onClick={ () => p && set( { ...v, ...p } ) && say( name ) }>
										{ name }
									</Button>
								);
							} ) }
						</div>
						{ /* eslint-disable-next-line jsx-a11y/no-static-element-interactions */ }
						<div ref={ boardRef } className="gcblite-layout-board" style={ { gridTemplateColumns: `repeat(${ v.cols }, minmax(0, 1fr))`, gridAutoRows: `${ ROW_PX }px` } }
							onPointerDown={ onPointerDown } onPointerMove={ onPointerMove } onPointerUp={ onPointerUp } onPointerCancel={ onPointerUp } onKeyDown={ onKeyDown }>
							{ cells }
							{ v.boxes.map( ( b, k ) => (
								<div key={ k } data-k={ k } tabIndex={ 0 } role="button"
									className={ 'gcblite-layout-box' + ( k === selected ? ' is-selected' : '' ) + ( num.get( b ) > count ? ' is-spare' : '' ) + ( drag && drag.k === k && drag.mode === 'move' && drag.moved ? ' is-dragging' : '' ) }
									style={ { gridColumn: `${ b.x + 1 } / span ${ b.w }`, gridRow: `${ b.y + 1 } / span ${ b.h }` } }
									aria-label={ sprintf( __( 'Box %1$d at column %2$d, row %3$d, %4$d wide, %5$d tall', 'gcblite' ), num.get( b ), b.x + 1, b.y + 1, b.w, b.h ) }>
									{ num.get( b ) <= count ? num.get( b ) : '·' }
									<span className="gcblite-layout-size">{ b.w }×{ b.h }</span>
									{ num.get( b ) > count && (
										<button type="button" className="gcblite-layout-remove" data-rm={ k } aria-label={ __( 'Remove this spare box', 'gcblite' ) }>×</button>
									) }
									<span className="gcblite-layout-corner" data-corner="1" />
								</div>
							) ) }
							{ drag && drag.ghost && (
								<div className={ 'gcblite-layout-ghost' + ( drag.ghost.bad ? ' is-bad' : '' ) }
									style={ { gridColumn: `${ drag.ghost.x + 1 } / span ${ drag.ghost.w }`, gridRow: `${ drag.ghost.y + 1 } / span ${ drag.ghost.h }` } } />
							) }
						</div>
						<p className={ 'gcblite-layout-note' + ( msg.bad ? ' is-bad' : '' ) } role="status">
							{ msg.text || __( 'Each box is an item. Drag a box to move it, drag its corner to resize it, click an empty cell to add an item there.', 'gcblite' ) }
						</p>
						<p className="gcblite-layout-note">
							{ sprintf( __( 'Items take the boxes in reading order. An item added later repeats this pattern until you place it.', 'gcblite' ) ) }
						</p>
						<SelectControl
							__nextHasNoMarginBottom
							label={ __( 'On phones', 'gcblite' ) }
							value={ String( v.phone ) }
							options={ [ { value: '1', label: __( '1 per row', 'gcblite' ) }, { value: '2', label: __( '2 per row', 'gcblite' ) } ] }
							onChange={ ( p ) => onChange( { ...v, phone: +p } ) }
						/>
					</div>
				</Popover>
			) }
		</BaseControl>
	);
}

export function registerLayoutControl() {
	if ( controlComponents && ! controlComponents.layout ) {
		controlComponents.layout = LayoutControl;
	}
}
