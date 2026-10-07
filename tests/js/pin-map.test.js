/**
 * The pin map (2026-10-07): which pins a Touchpoint-style map shows, and what
 * they are called — one per card, or one per location when a card has several.
 */
import { pinTag, pinsOf } from '../../src/controls/pin-map-value';

const single = { pointKey: 'point', pointsKey: '', rowPointKey: 'point', rowLabelKey: 'area', labelKey: 'title' };
const grouped = { ...single, pointsKey: 'locations' };

describe( 'pin tags', () => {
	it( 'a lone location is just its card number', () => {
		expect( pinTag( 2, 0, 1 ) ).toBe( '03' );
	} );
	it( 'several locations are lettered', () => {
		expect( [ 0, 1, 2 ].map( ( i ) => pinTag( 5, i, 3 ) ) ).toEqual( [ '06a', '06b', '06c' ] );
	} );
} );

describe( 'pins on the map', () => {
	it( 'single mode: one pin per card, at its point', () => {
		const cards = [
			{ clientId: 'a', attributes: { title: 'Network core', point: { x: 0.1, y: 0.2 } } },
			{ clientId: 'b', attributes: { title: '<strong>Gates</strong>', point: { x: 2, y: -1 } } },
		];
		const pins = pinsOf( cards, single );
		expect( pins.map( ( p ) => [ p.tag, p.label, p.row ] ) ).toEqual( [ [ '01', 'Network core', -1 ], [ '02', 'Gates', -1 ] ] );
		expect( pins[ 1 ].point ).toEqual( { x: 1, y: 0 } ); // clamped into the picture
	} );

	it( 'grouped mode: one pin per location, named by the location, lettered when there are several', () => {
		const cards = [
			{ clientId: 'a', attributes: { title: 'Network core', locations: [ { _id: 'r1', point: { x: 0.1, y: 0.1 }, area: 'Compound' } ] } },
			{
				clientId: 'b',
				attributes: {
					title: 'CCTV',
					locations: [
						{ _id: 'r2', point: { x: 0.3, y: 0.3 }, area: 'Crowd' },
						{ _id: 'r3', point: { x: 0.6, y: 0.6 } },
					],
				},
			},
		];
		const pins = pinsOf( cards, grouped );
		expect( pins.map( ( p ) => [ p.tag, p.label, p.cardId, p.row, p.key ] ) ).toEqual( [
			[ '01', 'Compound', 'a', 0, 'a:r1' ],
			[ '02a', 'Crowd', 'b', 0, 'b:r2' ],
			[ '02b', 'CCTV', 'b', 1, 'b:r3' ], // an unnamed location falls back to its card's title
		] );
	} );

	it( 'grouped mode: a card with no locations has no pins', () => {
		expect( pinsOf( [ { clientId: 'a', attributes: { title: 'x' } } ], grouped ) ).toEqual( [] );
	} );
} );
