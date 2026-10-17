import {
	nounFromLabel,
	pluralOf,
	countText,
	addName,
	footerSizeOf,
} from '../../src/utils/block-footer';

describe( "the editor strip's words", () => {
	it( 'takes the noun from the Add label', () => {
		expect( nounFromLabel( 'Add slide' ) ).toBe( 'slide' );
		expect( nounFromLabel( '+ Add Brand' ) ).toBe( 'brand' );
		expect( nounFromLabel( 'Add spec table' ) ).toBe( 'spec table' );
		expect( nounFromLabel( '' ) ).toBe( 'item' );
		expect( nounFromLabel( 'Question' ) ).toBe( 'question' );
	} );
	it( 'makes plurals', () => {
		expect( pluralOf( 'slide' ) ).toBe( 'slides' );
		expect( pluralOf( 'branch' ) ).toBe( 'branches' );
		expect( pluralOf( 'story' ) ).toBe( 'stories' );
		expect( pluralOf( 'day' ) ).toBe( 'days' );
		expect( pluralOf( 'box' ) ).toBe( 'boxes' );
	} );
	it( 'counts against a limit, or without one', () => {
		expect( countText( 2, 8, 'slide' ) ).toBe( '2 of 8 slides' );
		expect( countText( 8, 8, 'slide' ) ).toBe( '8 of 8 slides · limit reached' );
		expect( countText( 4, 0, 'branch' ) ).toBe( '4 branches' );
		expect( countText( 1, null, 'card' ) ).toBe( '1 card' );
	} );
	it( 'names the button with its count', () => {
		expect( addName( 2, 8, 'slide' ) ).toBe( 'Add slide (2 of 8)' );
		expect( addName( 4, 0, 'branch' ) ).toBe( 'Add branch (4 branches)' );
	} );
	it( 'sizes the strip by the block', () => {
		expect( footerSizeOf( undefined, 1200 ) ).toBe( 'normal' );
		expect( footerSizeOf( 'small', 1200 ) ).toBe( 'small' );
		expect( footerSizeOf( 'small', 200 ) ).toBe( 'narrow' );
		expect( footerSizeOf( undefined, 239 ) ).toBe( 'narrow' );
		expect( footerSizeOf( undefined, 0 ) ).toBe( 'normal' );
	} );
} );
