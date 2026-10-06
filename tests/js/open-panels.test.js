/**
 * A BLOCK'S CONTENT PANEL OPENS FIRST (the base-components sweep, 2026-10-06: Content, Layout, Look, Motion on every
 * block, Content open — Mark: "organise fields into groups - we have the capibility with gcblite but we're not using it").
 * A panel control that says `initialOpen` opens when the block is selected, beside the panels a click on the canvas forces
 * open (panelOpenStore).
 */
import { openPanelIds } from '../../src/utils/open-panels';

describe( 'openPanelIds', () => {
	const controls = [
		{ id: 'panel_content', type: 'panel', label: 'Content', initialOpen: true },
		{ id: 'panel_layout', type: 'panel', label: 'Layout' },
		{ id: 'title', type: 'text', parentPanelId: 'panel_content' },
	];

	it( 'the panels that open first, and the ones a click forced open', () => {
		expect( [ ...openPanelIds( controls, new Set( [ 'panel_layout' ] ) ) ].sort() ).toEqual( [ 'panel_content', 'panel_layout' ] );
		expect( [ ...openPanelIds( controls, undefined ) ] ).toEqual( [ 'panel_content' ] );
	} );

	it( 'no panels: only what was forced', () => {
		expect( [ ...openPanelIds( [ { id: 'x', type: 'text' } ], new Set( [ 'a' ] ) ) ] ).toEqual( [ 'a' ] );
	} );
} );
