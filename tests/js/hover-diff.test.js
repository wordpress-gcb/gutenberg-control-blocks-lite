/**
 * HOVER FOLLOWS THE SCROLL.
 *
 * Mark, 2026-09-22: "when you scroll, unless you stop scrolling and move your
 * mouse, you're not engaged in the thing. we want it so that if your mouse is
 * on it you're engaged even if your mouse is just on it as you scroll by."
 * A browser updates :hover and fires mouseenter only when the POINTER moves;
 * content scrolling under a still pointer engages nothing (Safari not even
 * after the scroll stops). The runtime asks what is under the pointer on
 * every scroll and settles the difference: what is newly under it is
 * entered, what is no longer under it is left, in the order the browser
 * would use — leave deepest-first, enter outermost-first.
 */
import { hoverDiff } from '../../src/utils/hover-diff';

const A = { id: 'A' }, B = { id: 'B' }, C = { id: 'C' }, D = { id: 'D' };

test( 'from nothing, everything under the pointer is entered, outermost first', () => {
	expect( hoverDiff( [], [ A, B, C ] ) ).toEqual( { enter: [ A, B, C ], leave: [] } );
} );

test( 'a sibling card scrolling under the pointer leaves the old branch deepest-first and enters the new', () => {
	expect( hoverDiff( [ A, B, C ], [ A, B, D ] ) ).toEqual( { enter: [ D ], leave: [ C ] } );
	expect( hoverDiff( [ A, B, C ], [ A, D ] ) ).toEqual( { enter: [ D ], leave: [ C, B ] } );
} );

test( 'the same chain changes nothing', () => {
	expect( hoverDiff( [ A, B ], [ A, B ] ) ).toEqual( { enter: [], leave: [] } );
} );

test( 'the pointer off the page leaves everything', () => {
	expect( hoverDiff( [ A, B ], [] ) ).toEqual( { enter: [], leave: [ B, A ] } );
} );
