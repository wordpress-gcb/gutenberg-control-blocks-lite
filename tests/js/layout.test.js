/**
 * THE LAYOUT CONTROL'S VALUE (Mark, 2026-10-06: "a smaller gcblite field, where a user can design a 'layout' … an
 * advanced version of cards per row" — of the mockup: "that's perfect" — "it'd work … on the premise of what ever
 * innerblock you add there … it's another 'repeater' style layout").
 *
 * A list's layout: its columns on a wide screen, boxes placed on them (each where it stands, never over another), and
 * how many per row on a phone. The list's items take the boxes in reading order; after the last box the drawn rows
 * repeat. The columns stay within the list's limits — its items need a minimum width. The AI writes a short form.
 */
import {
	layoutOf,
	faultsOf,
	placeSizes,
	placementOf,
	layoutCss,
	toShort,
	fromShort,
	evenLayout,
	limitsOf,
	boxesFor,
	minSpanOf,
	rescale,
} from '../../src/controls/layout-value';

const LIMITS = { minCols: 1, maxCols: 4 };
/* bevchain's cards: 272px each, of a 1200px list, 16px apart */
const ITEMS = { minItemPx: 272, containerPx: 1200, gapPx: 16 };
const BENTO = { cols: 4, boxes: [ { x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 1, h: 1 }, { x: 3, y: 0, w: 1, h: 1 }, { x: 2, y: 1, w: 2, h: 1 } ], phone: 1 };

describe( 'layoutOf: the stored value, made sound', () => {
	it( 'nothing stored is the drawn columns, one box each, in one row', () => {
		expect( layoutOf( null, { ...LIMITS, cols: 3 } ) ).toEqual( evenLayout( 3 ) );
		/* a control's `start` is where the board starts with nothing stored (a block drawn 5 + 6 of 12) */
		const start = { cols: 12, boxes: [ { x: 0, y: 0, w: 5, h: 1 }, { x: 6, y: 0, w: 6, h: 1 } ], phone: 1 };
		expect( layoutOf( null, { ...LIMITS, maxCols: 12, cols: 12, start } ) ).toEqual( start );
		expect( layoutOf( null, { ...LIMITS, cols: 3, start: { cols: 3, boxes: [ { x: 0, y: 0, w: 4, h: 1 } ] } } ) ).toEqual( evenLayout( 3 ) );
		expect( evenLayout( 3 ) ).toEqual( { cols: 3, boxes: [ { x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 1 }, { x: 2, y: 0, w: 1, h: 1 } ], phone: 1 } );
	} );

	it( 'a stored value is kept when it is sound', () => {
		expect( layoutOf( BENTO, LIMITS ) ).toEqual( BENTO );
	} );

	it( 'a value that breaks the limits or overlaps is the drawn columns again', () => {
		expect( layoutOf( { ...BENTO, cols: 6 }, { ...LIMITS, cols: 3 } ) ).toEqual( evenLayout( 3 ) );
		expect( layoutOf( { cols: 2, boxes: [ { x: 0, y: 0, w: 2, h: 1 }, { x: 1, y: 0, w: 1, h: 1 } ] }, { ...LIMITS, cols: 2 } ) ).toEqual( evenLayout( 2 ) );
	} );
} );

describe( 'faultsOf: each problem, said plainly', () => {
	it( 'too many columns for the items, an overlap, a box off the grid, a box too tall', () => {
		expect( faultsOf( { ...BENTO, cols: 13 }, {} ) ).toContain( 'This list allows 1–12 columns.' );
		expect( faultsOf( { cols: 2, boxes: [ { x: 0, y: 0, w: 2, h: 1 }, { x: 1, y: 0, w: 1, h: 1 } ] }, LIMITS ) ).toContain( 'Box 1 overlaps box 2.' );
		expect( faultsOf( { cols: 2, boxes: [ { x: 1, y: 0, w: 2, h: 1 } ] }, LIMITS ) ).toContain( 'Box 1 runs off the grid.' );
		expect( faultsOf( { cols: 2, boxes: [ { x: 0, y: 0, w: 1, h: 4 } ] }, LIMITS ) ).toContain( 'Box 1 is 4 rows tall; a box is 1–3.' );
		expect( faultsOf( BENTO, LIMITS ) ).toEqual( [] );
	} );
} );

describe( 'placeSizes: sizes alone, each at the first free spot', () => {
	it( 'left to right, top to bottom', () => {
		expect( placeSizes( [ { w: 2, h: 2 }, { w: 1, h: 1 }, { w: 1, h: 1 }, { w: 2, h: 1 } ], 4 ) ).toEqual( BENTO.boxes );
	} );
} );

describe( 'placementOf: where the list\'s Nth item goes', () => {
	it( 'items take the boxes in reading order; after the last box the drawn rows repeat', () => {
		expect( placementOf( BENTO, 0 ) ).toEqual( { x: 0, y: 0, w: 2, h: 2 } );
		expect( placementOf( BENTO, 3 ) ).toEqual( { x: 2, y: 1, w: 2, h: 1 } );
		/* the fifth item is the first box again, two rows down */
		expect( placementOf( BENTO, 4 ) ).toEqual( { x: 0, y: 2, w: 2, h: 2 } );
		expect( placementOf( BENTO, 7 ) ).toEqual( { x: 2, y: 3, w: 2, h: 1 } );
	} );

	it( 'boxes stored out of order are taken in reading order', () => {
		const shuffled = { ...BENTO, boxes: [ BENTO.boxes[ 3 ], BENTO.boxes[ 0 ], BENTO.boxes[ 2 ], BENTO.boxes[ 1 ] ] };
		expect( placementOf( shuffled, 1 ) ).toEqual( { x: 2, y: 0, w: 1, h: 1 } );
	} );
} );

describe( 'layoutCss: the list\'s columns and each item\'s place, on a wide screen; the phone count below', () => {
	it( 'one rule per item, by the selector given', () => {
		const css = layoutCss( BENTO, 5, { list: '#l', item: ( i ) => `#l>:nth-child(${ i + 1 })` } );
		/* rows of one height: a box two rows tall is two items and the gap (Mark, 2026-10-06: "the cards heights don't get set properly") */
		expect( css ).toContain( '@media (min-width:1024px){#l{--cols:4;grid-template-columns:repeat(4,minmax(0,1fr))!important;grid-auto-rows:1fr!important}' );
		expect( css ).toContain( '#l>:nth-child(1){grid-column:1 / span 2!important;grid-row:1 / span 2!important;' );
		/* a box bigger than one cell fills its cell with its picture, bare or in a drawn box; a one-cell item keeps its drawn picture */
		expect( css ).toContain( '#l>:nth-child(1)>:first-child:is(img,picture,video,figure,:has(>:is(img,picture,video):only-child)){flex:1 1 0!important;min-height:12rem;height:auto!important;aspect-ratio:auto!important;object-fit:cover}' );
		expect( css ).toContain( '#l>:nth-child(4)>:first-child:is(' );
		expect( css ).not.toContain( '#l>:nth-child(2)>' );
		expect( css ).toContain( '#l>:nth-child(5){grid-column:1 / span 2!important;grid-row:3 / span 2!important;' );
		expect( css ).toContain( '@media (max-width:781px){#l{grid-template-columns:repeat(1,minmax(0,1fr))!important}' );
	} );

	it( 'exactly what the PHP twin writes (tests/php/Unit/LayoutFieldTest.php)', () => {
		expect( layoutCss( BENTO, 5, { list: '#l', item: ( i ) => `#l>:nth-child(${ i + 1 })` }, { cols: 3 } ) ).toBe(
			'@media (min-width:1024px){#l{--cols:4;grid-template-columns:repeat(4,minmax(0,1fr))!important;grid-auto-rows:1fr!important}' +
				'#l>:nth-child(1){grid-column:1 / span 2!important;grid-row:1 / span 2!important;display:flex!important;flex-direction:column}#l>:nth-child(1)>:first-child:is(img,picture,video,figure,:has(>:is(img,picture,video):only-child)){flex:1 1 0!important;min-height:12rem;height:auto!important;aspect-ratio:auto!important;object-fit:cover}#l>:nth-child(1)>:first-child>:is(img,picture,video):only-child{width:100%;height:100%;object-fit:cover}' +
				'#l>:nth-child(2){grid-column:3 / span 1!important;grid-row:1 / span 1!important}' +
				'#l>:nth-child(3){grid-column:4 / span 1!important;grid-row:1 / span 1!important}' +
				'#l>:nth-child(4){grid-column:3 / span 2!important;grid-row:2 / span 1!important;display:flex!important;flex-direction:column}#l>:nth-child(4)>:first-child:is(img,picture,video,figure,:has(>:is(img,picture,video):only-child)){flex:1 1 0!important;min-height:12rem;height:auto!important;aspect-ratio:auto!important;object-fit:cover}#l>:nth-child(4)>:first-child>:is(img,picture,video):only-child{width:100%;height:100%;object-fit:cover}' +
				'#l>:nth-child(5){grid-column:1 / span 2!important;grid-row:3 / span 2!important;display:flex!important;flex-direction:column}#l>:nth-child(5)>:first-child:is(img,picture,video,figure,:has(>:is(img,picture,video):only-child)){flex:1 1 0!important;min-height:12rem;height:auto!important;aspect-ratio:auto!important;object-fit:cover}#l>:nth-child(5)>:first-child>:is(img,picture,video):only-child{width:100%;height:100%;object-fit:cover}}' +
				'@media (max-width:781px){#l{grid-template-columns:repeat(1,minmax(0,1fr))!important}}'
		);
	} );

	it( 'on phones the same as wide screens (Mark\'s popover design, 2026-10-06): the placement at every width, no phone rule', () => {
		const css = layoutCss( { ...BENTO, phone: 0 }, 5, { list: '#l', item: ( i ) => `#l>:nth-child(${ i + 1 })` }, { cols: 3 } );
		expect( css.startsWith( '#l{--cols:4;grid-template-columns:repeat(4,minmax(0,1fr))!important;grid-auto-rows:1fr!important}' ) ).toBe( true );
		expect( css ).not.toContain( '@media' );
		expect( layoutOf( { ...BENTO, phone: 'same' }, {} ).phone ).toBe( 0 );
		expect( toShort( { ...BENTO, phone: 0 } ) ).toContain( 'phone same' );
		expect( fromShort( 'phone same', BENTO ).phone ).toBe( 0 );
	} );

	it( 'an even layout of the drawn columns places nothing: the design stands', () => {
		expect( layoutCss( evenLayout( 3 ), 6, { list: '#l', item: () => '' }, { cols: 3 } ) ).toBe( '' );
	} );
} );

describe( 'the short form the AI writes', () => {
	it( 'is the value, and reads back to it', () => {
		expect( toShort( BENTO ) ).toBe( 'cols 4; at 1,1 2x2 | 3,1 1x1 | 4,1 1x1 | 3,2 2x1; phone 1' );
		expect( fromShort( toShort( BENTO ), evenLayout( 3 ), LIMITS ) ).toEqual( BENTO );
	} );

	it( 'sizes alone are placed by the site', () => {
		expect( fromShort( 'cols 4; sizes 2x2 1 1 2', evenLayout( 3 ), LIMITS ) ).toEqual( BENTO );
	} );

	it( 'what is not said stays as it was', () => {
		expect( fromShort( 'phone 2', BENTO, LIMITS ) ).toEqual( { ...BENTO, phone: 2 } );
	} );

	it( 'a request the list cannot take is refused with its reason', () => {
		expect( () => fromShort( 'cols 12; sizes 1', BENTO, ITEMS ) ).toThrow( 'Box 1 is 1 column wide; at 12 columns an item spans at least 3 (it needs 272px).' );
		expect( () => fromShort( 'cols 3; at 1,1 2x1 | 2,1 2x1', BENTO, LIMITS ) ).toThrow( 'Box 1 overlaps box 2.' );
		expect( () => fromShort( 'cols 4; at 1,1 big', BENTO, LIMITS ) ).toThrow( '“1,1 big” is not a box. Write column,row then width x height, like 1,1 2x2.' );
		expect( () => fromShort( 'rows 2', BENTO, LIMITS ) ).toThrow( '“rows 2” is not something the layout knows. Use cols, at, sizes, phone or min.' );
	} );
} );

describe( 'limitsOf: what the list allows, from its control', () => {
	it( 'its own min and max columns, else 1–12; the narrowest an item may be', () => {
		expect( limitsOf( { minCols: 2, maxCols: 3 } ) ).toMatchObject( { minCols: 2, maxCols: 3 } );
		expect( limitsOf( { minItemPx: 272, containerPx: 1200, gapPx: 16 } ) ).toMatchObject( { minCols: 1, maxCols: 12, minItemPx: 272 } );
		expect( limitsOf( {} ) ).toMatchObject( { minCols: 1, maxCols: 12 } );
	} );
} );

/* Mark, 2026-10-06: "we shold allow more columns but we also need a way to control the min width of a card so for lots
   of columns, it'll span x number of cols. ie. you might need more columns if you want certain card sizes" */
describe( 'minSpanOf: the fewest columns an item spans, from the narrowest it may be', () => {
	it( 'BevChain\'s cards need 272px of 1200px: 1 column at 3 or 4, 2 at 5 or 6, 3 at 12', () => {
		for ( const [ cols, span ] of [ [ 3, 1 ], [ 4, 1 ], [ 5, 2 ], [ 6, 2 ], [ 12, 3 ] ] ) {
			expect( minSpanOf( { cols, boxes: [] }, ITEMS ) ).toBe( span );
		}
	} );

	it( 'the list\'s own narrowest item, set in the popover, wins over its control\'s', () => {
		expect( minSpanOf( { cols: 12, boxes: [], minPx: 400 }, ITEMS ) ).toBe( 5 );
		expect( minSpanOf( { cols: 12, boxes: [] }, {} ) ).toBe( 1 );
	} );

	it( 'a box narrower than an item can be is a fault, said with its numbers', () => {
		const v = { cols: 12, boxes: [ { x: 0, y: 0, w: 2, h: 1 } ], phone: 1 };
		expect( faultsOf( v, ITEMS ) ).toContain( 'Box 1 is 2 columns wide; at 12 columns an item spans at least 3 (it needs 272px).' );
		expect( faultsOf( { ...v, boxes: [ { x: 0, y: 0, w: 3, h: 1 } ] }, ITEMS ) ).toEqual( [] );
	} );
} );

describe( 'rescale: more or fewer columns keep the layout\'s look', () => {
	it( '3 to 12: each box four times as wide, where it stood', () => {
		expect( rescale( evenLayout( 3 ), 12, ITEMS ).boxes ).toEqual( [ { x: 0, y: 0, w: 4, h: 1 }, { x: 4, y: 0, w: 4, h: 1 }, { x: 8, y: 0, w: 4, h: 1 } ] );
	} );

	it( 'back to fewer, never narrower than an item may be; boxes that no longer fit are placed again in order', () => {
		expect( rescale( { cols: 12, boxes: [ { x: 0, y: 0, w: 5, h: 1 }, { x: 5, y: 0, w: 7, h: 1 } ], phone: 1 }, 4, ITEMS ).boxes ).toEqual( [ { x: 0, y: 0, w: 2, h: 1 }, { x: 2, y: 0, w: 2, h: 1 } ] );
		const r = rescale( { cols: 12, boxes: [ { x: 0, y: 0, w: 3, h: 1 }, { x: 3, y: 0, w: 3, h: 1 }, { x: 6, y: 0, w: 3, h: 1 }, { x: 9, y: 0, w: 3, h: 1 } ], phone: 1 }, 5, ITEMS );
		expect( faultsOf( r, ITEMS ) ).toEqual( [] );
		expect( r.boxes.every( ( b ) => b.w >= 2 ) ).toBe( true );
	} );
} );

/* Mark, 2026-10-06: "there's also 2 extra cards there at the bottom for some reason and you can't control them from teh
   grid module" — the board drew the pattern's boxes; the list's later items repeated it with no box of their own */
describe( 'boxesFor: a box for every item the list holds', () => {
	it( 'the stored boxes, then a box where each later item repeats the pattern', () => {
		expect( boxesFor( BENTO, 6 ) ).toEqual( [ ...BENTO.boxes, { x: 0, y: 2, w: 2, h: 2 }, { x: 2, y: 2, w: 1, h: 1 } ] );
	} );

	it( 'boxes stored past the items stay, for the items to come', () => {
		expect( boxesFor( BENTO, 2 ) ).toEqual( BENTO.boxes );
	} );

	it( 'a long list fits: up to 48 boxes', () => {
		const v = { cols: 3, boxes: placeSizes( Array.from( { length: 30 }, () => ( { w: 1, h: 1 } ) ), 3 ), phone: 1 };
		expect( faultsOf( v, { maxCols: 3 } ) ).toEqual( [] );
	} );
} );
