/**
 * A LIST'S LAYOUT — the layout control's value (Mark, 2026-10-06: "a smaller gcblite field, where a user can design a
 * 'layout' … an advanced version of cards per row" — of the mockup: "that's perfect" — "it'd work … on the premise of
 * what ever innerblock you add there … it's another 'repeater' style layout").
 *
 * The value: the list's columns on a wide screen, boxes placed on them, and how many per row on a phone.
 *
 *   { cols: 4, boxes: [ { x: 0, y: 0, w: 2, h: 2 }, … ], phone: 1 }     x, y from 0; w, h in columns and rows;
 *   phone 1 or 2 per row, or 0: the same as wide screens (Mark's popover design, 2026-10-06)
 *
 * Each box stands where it was put and never over another (the movement of Mark's Tailwind Grid configurator). The
 * list's items take the boxes in reading order; after the last box the drawn rows repeat. Columns stay within the
 * list's limits — its items need a minimum width — and a box is 1–3 rows tall: height is a floor, content grows it.
 * Only the items' places change; their markup is the design's.
 *
 * The AI writes a short form (toShort / fromShort):
 *   cols 4; at 1,1 2x2 | 3,1 1x1 | 4,1 1x1 | 3,2 2x1; phone 1     each box where it stands (from 1)
 *   cols 4; sizes 2x2 1 1 2                                     sizes only: the site places them
 *   cols 12; sizes 5 7; min 300                                 an item at least 300px wide: at 12 columns it spans 4
 *
 * Pure: no React, no WordPress. The PHP twin is Contract\Fields::layout_css().
 */

export const MAX_ROWS = 3;
export const MAX_BOXES = 48;
export const MAX_COLS = 12;
const DESK = 1024;
const PHONE = 781;

const clamp = ( n, lo, hi ) => Math.max( lo, Math.min( hi, n ) );
const int = ( n, d = 0 ) => ( Number.isFinite( +n ) ? Math.round( +n ) : d );
const hits = ( a, b ) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * What the list allows: its own min and max columns (else 1–12), and the narrowest its items may be — which, with its
 * width and gap, says how many columns an item spans at the least (minSpanOf). More columns are a finer grid, not
 * narrower items (Mark, 2026-10-06: "we shold allow more columns but we also need a way to control the min width of a
 * card so for lots of columns, it'll span x number of cols").
 * @param {Object} c the control: minCols, maxCols, minItemPx, containerPx, gapPx, cols (the drawn columns)
 * @return {{minCols: number, maxCols: number, minItemPx: number, containerPx: number, gapPx: number, cols: number}}
 */
export function limitsOf( c = {} ) {
	const maxCols = clamp( int( c.maxCols ) || MAX_COLS, 1, MAX_COLS );
	const minCols = clamp( int( c.minCols ) || 1, 1, maxCols );
	return {
		minCols,
		maxCols,
		minItemPx: Math.max( 0, int( c.minItemPx ) ),
		containerPx: int( c.containerPx ) || 1200,
		gapPx: c.gapPx === undefined ? 16 : Math.max( 0, int( c.gapPx ) ),
		cols: clamp( int( c.cols ) || Math.min( 3, maxCols ), minCols, maxCols ),
		/* A GRID OF FIXED BOXES (2026-10-09): as many boxes as the grid has children, no adding — 0 for a list */
		count: clamp( int( c.count ), 0, MAX_BOXES ),
	};
}

/**
 * The fewest columns an item spans: the narrowest it may be — the list's own (`minPx`, set in the popover) else its
 * control's — against a column of the list's width at this many columns.
 * @param {Object} v      the value (cols, minPx)
 * @param {Object} limits the control
 * @return {number} 1 to v.cols
 */
export function minSpanOf( v, limits = {} ) {
	const l = limitsOf( limits );
	const px = int( v.minPx ) > 0 ? int( v.minPx ) : l.minItemPx;
	const cols = Math.max( 1, int( v.cols, 1 ) );
	if ( ! px ) {
		return 1;
	}
	const colW = ( l.containerPx - l.gapPx * ( cols - 1 ) ) / cols;
	return clamp( Math.ceil( ( px + l.gapPx ) / ( colW + l.gapPx ) - 1e-9 ), 1, cols );
}

/** the drawn columns, one box each, in one row: "N per row" */
export function evenLayout( cols ) {
	return { cols, boxes: Array.from( { length: cols }, ( _, x ) => ( { x, y: 0, w: 1, h: 1 } ) ), phone: 1 };
}

/** each problem with a value, as a sentence; [] when it is sound */
export function faultsOf( v, limits = {} ) {
	const l = limitsOf( limits );
	const f = [];
	if ( ! v || typeof v !== 'object' ) {
		return [ 'A layout is columns and boxes.' ];
	}
	if ( v.cols < l.minCols || v.cols > l.maxCols ) {
		f.push( `This list allows ${ l.minCols }–${ l.maxCols } columns.` );
	}
	const span = minSpanOf( v, limits );
	const px = int( v.minPx ) > 0 ? int( v.minPx ) : l.minItemPx;
	const boxes = Array.isArray( v.boxes ) ? v.boxes : [];
	if ( ! boxes.length ) {
		f.push( 'A layout needs at least one box.' );
	}
	if ( boxes.length > MAX_BOXES ) {
		f.push( `A layout has at most ${ MAX_BOXES } boxes.` );
	}
	boxes.forEach( ( b, k ) => {
		if ( b.w < 1 || b.x < 0 || b.y < 0 || b.x + b.w > v.cols ) {
			f.push( `Box ${ k + 1 } runs off the grid.` );
		}
		if ( b.w >= 1 && b.w < span ) {
			f.push( `Box ${ k + 1 } is ${ b.w } column${ b.w === 1 ? '' : 's' } wide; at ${ v.cols } columns an item spans at least ${ span } (it needs ${ px }px).` );
		}
		if ( b.h < 1 || b.h > MAX_ROWS ) {
			f.push( `Box ${ k + 1 } is ${ b.h } rows tall; a box is 1–${ MAX_ROWS }.` );
		}
		boxes.forEach( ( o, j ) => {
			if ( j > k && hits( b, o ) ) {
				f.push( `Box ${ k + 1 } overlaps box ${ j + 1 }.` );
			}
		} );
	} );
	return f;
}

const boxOf = ( b ) => ( { x: int( b?.x ), y: int( b?.y ), w: int( b?.w, 1 ), h: int( b?.h, 1 ) } );

/**
 * The stored value made sound: kept when it is, else the drawn columns.
 * @param {*}      value  what is stored
 * @param {Object} limits the control (limitsOf), with `cols` the drawn columns
 */
export function layoutOf( value, limits = {} ) {
	const l = limitsOf( limits );
	if ( value && typeof value === 'object' && Array.isArray( value.boxes ) ) {
		const v = { cols: int( value.cols ), boxes: value.boxes.map( boxOf ), phone: phoneOf( value.phone ) };
		if ( int( value.minPx ) > 0 ) {
			v.minPx = int( value.minPx );
		}
		if ( ! faultsOf( v, l ).length ) {
			return v;
		}
	}
	/* WHERE THE BOARD STARTS when nothing is stored (2026-10-09, a hand-built block drawn 5 + 6 of 12 columns): the
	   control's `start`, when it is sound — never stored itself; the block renders as drawn until a person moves a box */
	const s = limits && limits.start;
	if ( s && typeof s === 'object' && Array.isArray( s.boxes ) ) {
		const v = { cols: int( s.cols ), boxes: s.boxes.map( boxOf ), phone: phoneOf( s.phone ) };
		if ( ! faultsOf( v, l ).length ) {
			return v;
		}
	}
	return evenLayout( l.cols );
}

/** sizes alone, each placed at the first free spot, left to right, top to bottom */
export function placeSizes( sizes, cols ) {
	const out = [];
	for ( const s of sizes ) {
		const w = clamp( int( s.w, 1 ), 1, cols );
		const h = clamp( int( s.h, 1 ), 1, MAX_ROWS );
		for ( let y = 0, done = false; ! done; y++ ) {
			for ( let x = 0; x + w <= cols; x++ ) {
				const c = { x, y, w, h };
				if ( ! out.some( ( o ) => hits( o, c ) ) ) {
					out.push( c );
					done = true;
					break;
				}
			}
		}
	}
	return out;
}

/** the boxes in reading order: top to bottom, then left to right */
export function inReadingOrder( boxes ) {
	return boxes.slice().sort( ( a, b ) => a.y - b.y || a.x - b.x );
}

/** how many rows the drawn boxes take; they repeat after it */
export function rowsOf( v ) {
	return Math.max( 1, ...v.boxes.map( ( b ) => b.y + b.h ) );
}

/** where the list's item `i` (from 0) goes: its box, moved down by the rows already repeated */
export function placementOf( v, i ) {
	const ord = inReadingOrder( v.boxes );
	const b = ord[ i % ord.length ];
	return { x: b.x, y: Math.floor( i / ord.length ) * rowsOf( v ) + b.y, w: b.w, h: b.h };
}

/**
 * A BOX FOR EVERY ITEM THE LIST HOLDS (Mark, 2026-10-06: "there's also 2 extra cards there at the bottom … you can't
 * control them from teh grid module"): the stored boxes, then a box where each later item repeats the pattern — so the
 * board shows, and a person moves, every item. Boxes stored past the items stay, for the items to come.
 * @param {Object} v     a sound value
 * @param {number} count how many items the list holds
 * @return {Array} the boxes, in the stored order then the repeats
 */
export function boxesFor( v, count ) {
	const out = v.boxes.map( ( b ) => ( { ...b } ) );
	for ( let i = out.length; i < count; i++ ) {
		out.push( placementOf( v, i ) );
	}
	return out;
}

/** how many per row on a phone: 1 or 2, or 0 — the same as wide screens */
export function phoneOf( p ) {
	if ( p === 0 || p === '0' || p === 'same' ) {
		return 0;
	}
	return parseInt( p, 10 ) === 2 ? 2 : 1;
}

/** it is the drawn columns, one box each, in one row — the design as it was drawn */
export function isEven( v, drawnCols ) {
	return v.cols === drawnCols && v.phone === 1 && v.boxes.length === v.cols && rowsOf( v ) === 1 && v.boxes.every( ( b ) => b.w === 1 && b.h === 1 );
}

/**
 * The CSS that lays the list out: its columns and each item's place on a wide screen, its phone count on a phone.
 * '' when the value is the drawn layout — the design stands as it was.
 * @param {Object}   v     a sound value (layoutOf)
 * @param {number}   count how many items the list holds
 * @param {Object}   sel   { list: selector, item: (i) => selector }
 * @param {Object}   drawn { cols, fill } the drawn columns; fill false = the pictures keep their own shape (see below)
 */
export function layoutCss( v, count, sel, drawn = {} ) {
	if ( drawn.cols && isEven( v, drawn.cols ) ) {
		return '';
	}
	/* A BLOCK WITH A SHAPE SETTING OF ITS OWN (Mark, 2026-10-09: "make sure the aspect ratio stuff doesn't kick into
	   play"): with `fill: false` on the control, a box bigger than one cell places its content and nothing more — the
	   picture keeps the shape the block gives it, and the rows size to what is in them instead of to one height */
	const fill = drawn.fill !== false;
	const places = [];
	for ( let i = 0; i < count; i++ ) {
		const p = placementOf( v, i );
		const it = sel.item( i );
		/* A BOX BIGGER THAN ONE CELL FILLS ITS CELL WITH ITS PICTURE (Mark, 2026-10-06, a 2x1 beside a 2x2: "the first one
		   should be half the height of the second"). Its lead picture — bare, or the one picture in a drawn box like
		   `aspect-[4/5]` — drops its drawn shape and takes the room its words leave, so the rows stand at the height the
		   one-cell items give them and a box two rows tall is two rows. A wide box kept its drawn shape before, and at
		   twice the width its picture made every row twice as tall. One-cell items keep their drawn picture. */
		const big = fill && ( p.w > 1 || p.h > 1 );
		places.push(
			big
				? `${ it }{grid-column:${ p.x + 1 } / span ${ p.w }!important;grid-row:${ p.y + 1 } / span ${ p.h }!important;display:flex!important;flex-direction:column}` +
						`${ it }>:first-child:is(img,picture,video,figure,:has(>:is(img,picture,video):only-child)){flex:1 1 0!important;min-height:12rem;height:auto!important;aspect-ratio:auto!important;object-fit:cover}` +
						`${ it }>:first-child>:is(img,picture,video):only-child{width:100%;height:100%;object-fit:cover}`
				: `${ it }{grid-column:${ p.x + 1 } / span ${ p.w }!important;grid-row:${ p.y + 1 } / span ${ p.h }!important}`
		);
	}
	/* rows of one height: a box two rows tall is exactly two items and the gap between them */
	const wide = `${ sel.list }{--cols:${ v.cols };grid-template-columns:repeat(${ v.cols },minmax(0,1fr))!important;grid-auto-rows:${ fill ? '1fr' : 'auto' }!important}${ places.join( '' ) }`;
	/* the same as wide screens: the placement holds at every width, and there is no phone rule */
	if ( v.phone === 0 ) {
		return wide;
	}
	return (
		`@media (min-width:${ DESK }px){${ wide }}` +
		`@media (max-width:${ PHONE }px){${ sel.list }{grid-template-columns:repeat(${ v.phone },minmax(0,1fr))!important}}`
	);
}

/**
 * More or fewer columns, the layout's look kept: each box scaled to the new count where it stood, never narrower than
 * an item may be; when that no longer fits, the boxes are placed again in reading order at their new widths.
 * @param {Object} v      a sound value
 * @param {number} cols   the new count
 * @param {Object} limits the control
 * @return {Object} the value at the new count
 */
export function rescale( v, cols, limits = {} ) {
	const f = cols / v.cols;
	const next = { ...v, cols };
	const span = minSpanOf( next, limits );
	next.boxes = v.boxes.map( ( b ) => {
		const w = clamp( Math.max( span, Math.round( b.w * f ) ), 1, cols );
		return { x: clamp( Math.round( b.x * f ), 0, cols - w ), y: b.y, w, h: b.h };
	} );
	if ( faultsOf( next, limits ).length ) {
		next.boxes = placeSizes( inReadingOrder( next.boxes ), cols );
	}
	return next;
}

/* ---------- the short form the AI writes ---------- */

export function toShort( v ) {
	return `cols ${ v.cols }; at ${ inReadingOrder( v.boxes )
		.map( ( b ) => `${ b.x + 1 },${ b.y + 1 } ${ b.w }x${ b.h }` )
		.join( ' | ' ) }; phone ${ v.phone === 0 ? 'same' : v.phone }${ v.minPx ? `; min ${ v.minPx }` : '' }`;
}

/**
 * A short form read onto a value: what it says changes, what it does not say stays.
 * @throws {Error} with the reason, when it cannot be read or the list cannot take it
 */
export function fromShort( line, current, limits = {} ) {
	const next = { cols: current.cols, boxes: current.boxes.map( ( b ) => ( { ...b } ) ), phone: current.phone };
	if ( current.minPx ) {
		next.minPx = current.minPx;
	}
	let sizes = null;
	const parts = String( line || '' )
		.split( ';' )
		.map( ( p ) => p.trim() )
		.filter( Boolean );
	if ( ! parts.length ) {
		throw new Error( 'Nothing to read.' );
	}
	for ( const p of parts ) {
		let m;
		if ( ( m = /^cols\s+(\d+)$/i.exec( p ) ) ) {
			next.cols = +m[ 1 ];
		} else if ( ( m = /^min\s+(\d+)(?:px)?$/i.exec( p ) ) ) {
			next.minPx = +m[ 1 ];
		} else if ( ( m = /^phone\s+(\d+|same)$/i.exec( p ) ) ) {
			if ( ! [ '1', '2', 'same' ].includes( m[ 1 ].toLowerCase() ) ) {
				throw new Error( 'Phone is 1 or 2 per row, or same (as wide screens).' );
			}
			next.phone = phoneOf( m[ 1 ].toLowerCase() );
		} else if ( ( m = /^at\s+(.+)$/i.exec( p ) ) ) {
			next.boxes = m[ 1 ].split( '|' ).map( ( t ) => {
				const mm = /^\s*(\d+)\s*,\s*(\d+)\s+(\d+)(?:x(\d+))?\s*$/i.exec( t );
				if ( ! mm ) {
					throw new Error( `“${ t.trim() }” is not a box. Write column,row then width x height, like 1,1 2x2.` );
				}
				return { x: +mm[ 1 ] - 1, y: +mm[ 2 ] - 1, w: +mm[ 3 ], h: +( mm[ 4 ] || 1 ) };
			} );
		} else if ( ( m = /^sizes\s+(.+)$/i.exec( p ) ) ) {
			sizes = m[ 1 ]
				.trim()
				.split( /\s+/ )
				.map( ( t ) => {
					const mm = /^(\d+)(?:x(\d+))?$/i.exec( t );
					if ( ! mm ) {
						throw new Error( `“${ t }” is not a size. Write 1, 2 or 2x2.` );
					}
					return { w: +mm[ 1 ], h: +( mm[ 2 ] || 1 ) };
				} );
		} else {
			throw new Error( `“${ p }” is not something the layout knows. Use cols, at, sizes, phone or min.` );
		}
	}
	const f0 = faultsOf( { ...next, boxes: [ { x: 0, y: 0, w: 1, h: 1 } ] }, limits );
	if ( f0.length ) {
		throw new Error( f0[ 0 ] );
	}
	if ( sizes ) {
		const wide = sizes.find( ( s ) => s.w > next.cols );
		if ( wide ) {
			throw new Error( `A box ${ wide.w } wide does not fit ${ next.cols } columns.` );
		}
		next.boxes = placeSizes( sizes, next.cols );
	}
	const f = faultsOf( next, limits );
	if ( f.length ) {
		throw new Error( f[ 0 ] );
	}
	return next;
}
