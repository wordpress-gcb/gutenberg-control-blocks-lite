/**
 * THE CAROUSEL SHOWS THE SLIDE YOU ARE EDITING.
 *
 * Mark, 2026-09-22: "when you add a new one, focus into that". Adding a
 * testimonial selects the new block (insertBlock with updateSelection); the
 * arrangement then has to bring that slide on stage — and the same rule
 * serves a click in the list view, or on any block nested inside a slide.
 */
import { slideForSelection } from '../../src/repeater-layouts';

const order = [ 'a', 'b', 'c' ];

test( 'the selected child is the slide', () => {
	expect( slideForSelection( order, 'b', [] ) ).toBe( 1 );
} );

test( 'a block nested inside a slide selects that slide', () => {
	// parents are outermost-first, as getBlockParents gives them
	expect( slideForSelection( order, 'deep', [ 'root', 'c', 'mid' ] ) ).toBe( 2 );
} );

test( 'a selection outside the repeater changes nothing', () => {
	expect( slideForSelection( order, 'elsewhere', [ 'root' ] ) ).toBe( -1 );
	expect( slideForSelection( order, null, [] ) ).toBe( -1 );
} );
