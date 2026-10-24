/**
 * A LOOK FIELD PAINTS A PROPERTY OF ITS ELEMENT (2026-10-24, Mark: "if you've got the same card with a different
 * colour it means it's got a colour field"). The JS twin of Contract\Fields::look_style (tests/php/Unit/LookStyleTest.php
 * holds the PHP to the same values); both read the one list, includes/Contract/look-props.json.
 */
import { bindingsOf, lookProps, lookStyle, lookStyleOf } from '../../src/controls/look-value';
import LOOK_PROPS from '../../includes/Contract/look-props.json';

test( 'the properties are the one list the PHP reads', () => {
	expect( Object.keys( lookProps() ) ).toEqual( LOOK_PROPS.map( ( r ) => r.prop ) );
	expect( Object.keys( lookProps() ) ).toEqual( [ 'color', 'background-color', 'border-color', 'fill', 'stroke', 'background' ] );
} );

test( 'a colour paints its property — a hex as it is, a palette slug as the preset', () => {
	expect( lookStyle( { color: '#00d4ff' } ) ).toBe( 'color:#00d4ff' );
	expect( lookStyle( { 'border-color': 'accent' } ) ).toBe( 'border-color:var(--wp--preset--color--accent)' );
	expect( lookStyle( { fill: 'rgba(0,0,0,.5)', stroke: '#fff' } ) ).toBe( 'fill:rgba(0,0,0,.5);stroke:#fff' );
	expect( lookStyle( { 'background-color': 'linear-gradient(90deg,#000,#fff)' } ) ).toBe( 'background-image:linear-gradient(90deg,#000,#fff)' );
} );

test( 'a background paints as the background field does', () => {
	expect( lookStyle( { background: { kind: 'gradient', gradient: 'linear-gradient(to bottom right, #00d4ff, #0070f3)' } } ) ).toBe(
		'background-image:linear-gradient(to bottom right, #00d4ff, #0070f3)'
	);
} );

test( 'nothing that is not a colour, and no property off the list', () => {
	expect( lookStyle( { color: 'x";background:url(evil)' } ) ).toBe( '' );
	expect( lookStyle( { width: '10px', color: '' } ) ).toBe( '' );
	expect( lookStyle( { color: { kind: 'color' } } ) ).toBe( '' );
} );

test( 'an element says which field paints which property', () => {
	expect( bindingsOf( 'kicker_color:color; dot:background;x:width' ) ).toEqual( [
		{ key: 'kicker_color', prop: 'color' },
		{ key: 'dot', prop: 'background' },
	] );
	expect( lookStyleOf( 'kicker_color:color;dot:background', { kicker_color: '#e040fb', dot: { kind: 'color', color: '#e040fb' } } ) ).toBe(
		'color:#e040fb;background-color:#e040fb;background-image:none'
	);
	expect( lookStyleOf( 'kicker_color:color', {} ) ).toBe( '' );
} );
