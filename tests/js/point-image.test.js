/**
 * A PIN IS DRAGGED ON THE IMAGE IT SITS ON.
 *
 * Mark, 2026-09-22: the `point` field (where a hotspot pin sits). The picker
 * needs the picture to drag over: the block's own image field when it has
 * one, else the nearest ancestor block's — a pin item sits inside a region
 * inside the block that holds the product image. With no image anywhere, a
 * plain canvas, so the point can still be set.
 */
import { imageUrlIn, pointOf } from '../../src/controls/point-image';

test( 'the block\'s own image field is the picture', () => {
	expect( imageUrlIn( { title: 'x', photo: { url: 'https://x.test/a.jpg', id: 3 } } ) ).toBe( 'https://x.test/a.jpg' );
} );

test( 'a bare attachment id or a string is not a picture', () => {
	expect( imageUrlIn( { photo: 7, name: 'https://x.test/not-an-image-field' } ) ).toBe( '' );
} );

test( 'the first image-shaped value wins, in attribute order', () => {
	expect( imageUrlIn( { a: { url: 'https://x.test/1.jpg' }, b: { url: 'https://x.test/2.jpg' } } ) ).toBe( 'https://x.test/1.jpg' );
} );

test( 'a point is {x, y} clamped to 0..1, the middle when nothing is stored', () => {
	expect( pointOf( { x: 0.32, y: 0.41 } ) ).toEqual( { x: 0.32, y: 0.41 } );
	expect( pointOf( { x: 1.7, y: -2 } ) ).toEqual( { x: 1, y: 0 } );
	expect( pointOf( null ) ).toEqual( { x: 0.5, y: 0.5 } );
	expect( pointOf( 'junk' ) ).toEqual( { x: 0.5, y: 0.5 } );
} );
