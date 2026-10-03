/**
 * A BACKGROUND IS A COLOUR, A GRADIENT OR A PICTURE — ONE FIELD, EITHER/OR.
 *
 * Mark, 2026-10-03 (the Angry Birds import): "some backgrounds aren't images,
 * like the beige background isn't an image, it's just a colour. it'd be good
 * if when we did backgrounds … it always has the option of either / or ie. we
 * have a background field that takes image or colour or gradient etc."
 *
 * The value keeps all three so a person can flip between them without losing
 * what they had; `kind` says which one paints. A picture may sit on a colour
 * (a transparent pattern on green) — the colour paints under it.
 */
import { backgroundOf, styleOf, kinds } from '../../src/controls/background-value';

test( 'the three kinds, in the order the switch shows them', () => {
	expect( kinds().map( ( k ) => k.value ) ).toEqual( [ 'color', 'gradient', 'image' ] );
} );

test( 'a value is normalised: kind, colour, gradient and image, with safe empties', () => {
	expect( backgroundOf( null ) ).toEqual( { kind: 'color', color: '', gradient: '', image: null } );
	expect( backgroundOf( { kind: 'image', image: { url: 'https://x.test/a.png', id: 3 } } ) ).toEqual( {
		kind: 'image',
		color: '',
		gradient: '',
		image: { url: 'https://x.test/a.png', id: 3 },
	} );
	/* an unknown kind, or a kind with nothing in it, falls to what is there */
	expect( backgroundOf( { kind: 'junk', color: '#111111' } ).kind ).toBe( 'color' );
	expect( backgroundOf( { kind: 'image', color: '#111111' } ).kind ).toBe( 'color' );
	expect( backgroundOf( { gradient: 'linear-gradient(90deg,#000,#fff)' } ).kind ).toBe( 'gradient' );
} );

test( 'a plain colour string, as the old colour field stored it, is a colour background', () => {
	expect( backgroundOf( '#6ba136' ) ).toEqual( { kind: 'color', color: '#6ba136', gradient: '', image: null } );
	expect( backgroundOf( 'linear-gradient(180deg,#000,#fff)' ).kind ).toBe( 'gradient' );
} );

test( 'the style each kind paints', () => {
	expect( styleOf( { kind: 'color', color: '#6ba136' } ) ).toBe( 'background-color:#6ba136' );
	/* a theme palette slug is its preset variable */
	expect( styleOf( { kind: 'color', color: 'accent' } ) ).toBe( 'background-color:var(--wp--preset--color--accent)' );
	expect( styleOf( { kind: 'gradient', gradient: 'linear-gradient(90deg,#000,#fff)' } ) ).toBe( 'background-image:linear-gradient(90deg,#000,#fff)' );
	expect( styleOf( { kind: 'image', image: { url: 'https://x.test/a.jpg' } } ) ).toBe(
		'background-image:url("https://x.test/a.jpg");background-size:cover;background-position:50% 50%;background-repeat:no-repeat'
	);
} );

test( 'a picture keeps the image field\'s own settings: contain, tile, focal point, fixed — and the colour under it', () => {
	expect(
		styleOf( {
			kind: 'image',
			color: '#6ba136',
			image: { url: 'https://x.test/doodles.png', size: 'tile', isRepeat: true, focalPoint: { x: 0.2, y: 0.8 }, isFixed: true },
		} )
	).toBe(
		'background-color:#6ba136;background-image:url("https://x.test/doodles.png");background-size:auto;background-position:20% 80%;background-repeat:repeat;background-attachment:fixed'
	);
	expect( styleOf( { kind: 'image', image: { url: 'https://x.test/a.jpg', size: 'contain' } } ) ).toContain( 'background-size:contain' );
	expect( styleOf( { kind: 'image', image: { url: 'https://x.test/a.jpg', size: 'custom', customWidth: '640px' } } ) ).toContain( 'background-size:640px' );
} );

test( 'nothing to paint is an empty style; a quote in an address cannot break out', () => {
	expect( styleOf( null ) ).toBe( '' );
	expect( styleOf( { kind: 'image', image: null } ) ).toBe( '' );
	expect( styleOf( { kind: 'color', color: '' } ) ).toBe( '' );
	expect( styleOf( { kind: 'image', image: { url: 'https://x.test/a").jpg' } } ) ).toBe(
		'background-image:url("https://x.test/a%22).jpg");background-size:cover;background-position:50% 50%;background-repeat:no-repeat'
	);
} );
