/**
 * A BLOCK'S OWN INLINE STYLE ON ITS EDITOR WRAPPER (Mark, 2026-10-06: "Do you know why cards per row doesn't work in
 * the admin? ie, if you change the slider the cards don't update"). The server prints the row's
 * `style="--gcb-per-row:2;--gcb-per-row-gap:16px"`; the editor turned each property into React's camelCase, and
 * `--gcb-per-row` came out `-GcbPerRow`, which React drops. A custom property keeps its name exactly.
 */
import { parseStyle } from '../../src/utils/parse-style';

describe( 'parseStyle', () => {
	it( 'a custom property keeps its name exactly', () => {
		expect( parseStyle( '--gcb-per-row:2;--gcb-per-row-gap:16px' ) ).toEqual( { '--gcb-per-row': '2', '--gcb-per-row-gap': '16px' } );
	} );

	it( 'an ordinary property is camelCase; a vendor prefix is React\'s', () => {
		expect( parseStyle( 'background-color: #fff; min-height:40vh' ) ).toEqual( { backgroundColor: '#fff', minHeight: '40vh' } );
		expect( parseStyle( '-webkit-line-clamp:3;-ms-overflow-style:none' ) ).toEqual( { WebkitLineClamp: '3', msOverflowStyle: 'none' } );
	} );

	it( 'a value holding a colon stays whole; empty rules are skipped', () => {
		expect( parseStyle( 'background-image:url(https://x.test/a.jpg);;' ) ).toEqual( { backgroundImage: 'url(https://x.test/a.jpg)' } );
		expect( parseStyle( '' ) ).toEqual( {} );
	} );
} );
