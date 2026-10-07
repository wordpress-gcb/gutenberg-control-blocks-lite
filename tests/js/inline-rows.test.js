/**
 * Repeater rows edited in place (2026-10-07): a row's sub-field found by its
 * _id, written without touching the other rows, and masked in the preview
 * fetch so typing does not refetch.
 */
import { maskRowFields, rowIndexOf, withRowValue } from '../../src/utils/inline-fields';

const rows = [
	{ _id: 'r1', area: 'Crowd', point: { x: 0.1, y: 0.2 } },
	{ _id: 'r2', area: 'Main gates', point: { x: 0.5, y: 0.5 } },
	{ area: 'No id' },
];

describe( 'finding a row', () => {
	it( 'by its _id, which survives reordering', () => {
		expect( rowIndexOf( rows, 'r2' ) ).toBe( 1 );
		expect( rowIndexOf( [ rows[ 1 ], rows[ 0 ] ], 'r2' ) ).toBe( 0 );
	} );
	it( 'by index when the row has no _id', () => {
		expect( rowIndexOf( rows, '2' ) ).toBe( 2 );
	} );
	it( 'not at all when it is gone, or the value is not a list', () => {
		expect( rowIndexOf( rows, 'r9' ) ).toBe( -1 );
		expect( rowIndexOf( rows, '7' ) ).toBe( -1 );
		expect( rowIndexOf( undefined, 'r1' ) ).toBe( -1 );
	} );
} );

describe( 'writing one sub-field', () => {
	it( 'changes that row only, in a new array', () => {
		const next = withRowValue( rows, 'r2', 'area', 'East gate' );
		expect( next ).not.toBe( rows );
		expect( next[ 1 ] ).toEqual( { _id: 'r2', area: 'East gate', point: { x: 0.5, y: 0.5 } } );
		expect( next[ 0 ] ).toBe( rows[ 0 ] );
		expect( rows[ 1 ].area ).toBe( 'Main gates' );
	} );
	it( 'leaves the rows alone when the row is not there', () => {
		expect( withRowValue( rows, 'r9', 'area', 'x' ) ).toBe( rows );
	} );
} );

describe( 'masking for the preview fetch', () => {
	it( 'replaces only the in-place words with whether there are any', () => {
		const attrs = { title: 'CCTV', locations: [ { _id: 'r1', area: 'Crowd', body: '', point: { x: 0.1, y: 0.2 } } ] };
		const out = maskRowFields( attrs, [
			{ key: 'locations', row: 'r1', sub: 'area' },
			{ key: 'locations', row: 'r1', sub: 'body' },
		] );
		expect( out.locations[ 0 ] ).toEqual( { _id: 'r1', area: ' ', body: '', point: { x: 0.1, y: 0.2 } } );
		expect( attrs.locations[ 0 ].area ).toBe( 'Crowd' ); // the block's own value untouched
		expect( out.title ).toBe( 'CCTV' );
	} );
	it( 'gives back the same object when there is nothing to mask', () => {
		const attrs = { locations: rows };
		expect( maskRowFields( attrs, [] ) ).toBe( attrs );
		expect( maskRowFields( attrs, [ { key: 'locations', row: 'r9', sub: 'area' } ] ) ).toBe( attrs );
	} );
} );
