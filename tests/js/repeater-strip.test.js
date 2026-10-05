/**
 * THE KIT'S TABS ARE EDITED WHERE THEY STAND (Mark, 2026-10-05: "the tabs almost work in teh editor, but they should
 * display more like the front end. ie. the tabs where they are on the front end wiwth the add button at the bottom").
 * The tabs editing layout looks for the box the design placed for the strip of tabs; with one, each item's own tab
 * is drawn there (a portal — it stays its item's, edited in place) and the Add button stands under them.
 */
import { kitStripOf } from '../../src/repeater-layouts';

const dom = ( html ) => {
	document.body.innerHTML = html;
	return document.body;
};

describe( 'kitStripOf: the box the design placed for the strip of tabs', () => {
	it( 'is the tablist box of the kit tabs the list stands in', () => {
		const b = dom(
			'<div data-gcb-kit="tabs"><nav data-gcb-kit-tablist id="strip"></nav><div><div id="layout"></div></div></div>'
		);
		expect( kitStripOf( b.querySelector( '#layout' ) ) ).toBe( b.querySelector( '#strip' ) );
	} );
	it( 'is nothing outside the kit tabs, or when the list stands inside the strip itself', () => {
		const out = dom( '<div><nav data-gcb-kit-tablist></nav><div id="layout"></div></div>' );
		expect( kitStripOf( out.querySelector( '#layout' ) ) ).toBeNull();
		const inside = dom( '<div data-gcb-kit="tabs"><nav data-gcb-kit-tablist><div id="layout"></div></nav></div>' );
		expect( kitStripOf( inside.querySelector( '#layout' ) ) ).toBeNull();
		expect( kitStripOf( null ) ).toBeNull();
	} );
	it( 'is its own tabs\' strip, not that of tabs nested inside a panel or standing round it', () => {
		const b = dom(
			'<div data-gcb-kit="tabs"><nav data-gcb-kit-tablist id="outer"></nav><div><div data-gcb-kit="tabs"><nav data-gcb-kit-tablist id="inner"></nav><div id="layout"></div></div></div></div>'
		);
		expect( kitStripOf( b.querySelector( '#layout' ) ) ).toBe( b.querySelector( '#inner' ) );
	} );
} );
