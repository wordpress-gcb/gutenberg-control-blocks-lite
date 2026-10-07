/**
 * The editor bridge (2026-10-07, TODO.md "Extension points" 4): a block's own
 * editor.js draws an overlay through window.gcbLiteEditor.overlay(), and the
 * bridge re-runs it when its block, its children or the selection change, or
 * when its (or a child's) preview is re-rendered.
 */

/* a tiny block store standing in for core/block-editor */
const store = { blocks: {}, children: {}, parents: {}, selected: null, listeners: [] };
jest.mock( '@wordpress/data', () => ( {
	select: () => ( {
		getBlocksByName: ( name ) => Object.values( store.blocks ).filter( ( b ) => b.name === name ).map( ( b ) => b.clientId ),
		getBlock: ( id ) => store.blocks[ id ] || null,
		getBlocks: ( id ) => ( store.children[ id ] || [] ).map( ( c ) => store.blocks[ c ] ),
		getSelectedBlockClientId: () => store.selected,
		getBlockParents: ( id ) => store.parents[ id ] || [],
	} ),
	dispatch: () => ( {
		selectBlock: ( id ) => {
			store.selected = id;
			store.listeners.forEach( ( fn ) => fn() );
		},
		updateBlockAttributes: ( id, attrs ) => {
			store.blocks[ id ] = { ...store.blocks[ id ], attributes: { ...store.blocks[ id ].attributes, ...attrs } };
			store.listeners.forEach( ( fn ) => fn() );
		},
	} ),
	subscribe: ( fn ) => {
		store.listeners.push( fn );
		return () => {};
	},
} ) );

let installEditorBridge;
beforeEach( () => {
	jest.useFakeTimers();
	delete window.gcbLiteEditor;
	store.listeners = [];
	store.selected = null;
	store.blocks = {
		map1: { clientId: 'map1', name: 'gcb/map', attributes: { zoom: 2 } },
		card1: { clientId: 'card1', name: 'gcb/card', attributes: { title: 'A' } },
		other: { clientId: 'other', name: 'gcb/text', attributes: {} },
	};
	store.children = { map1: [ 'card1' ] };
	store.parents = { card1: [ 'map1' ] };
	document.body.innerHTML = '<div id="block-map1"></div><div id="block-card1"></div><div id="block-other"></div>';
	jest.isolateModules( () => {
		( { installEditorBridge } = require( '../../src/editor-bridge' ) );
	} );
} );
afterEach( () => jest.useRealTimers() );

const flush = () => jest.advanceTimersByTime( 200 );

describe( 'the editor bridge', () => {
	it( 'runs an overlay for each instance of its block, with the block, its children and its element', () => {
		const bridge = installEditorBridge();
		const seen = [];
		bridge.overlay( 'gcb/map', ( ctx ) => seen.push( [ ctx.clientId, ctx.element.id, ctx.children.map( ( c ) => c.attributes.title ) ] ) );
		flush();
		expect( seen ).toEqual( [ [ 'map1', 'block-map1', [ 'A' ] ] ] );
	} );

	it( "re-runs when the block's children or the selection change — and not otherwise", () => {
		const bridge = installEditorBridge();
		const render = jest.fn();
		bridge.overlay( 'gcb/map', render );
		flush();
		expect( render ).toHaveBeenCalledTimes( 1 );

		store.listeners.forEach( ( fn ) => fn() ); // a store change that touches nothing it reads
		flush();
		expect( render ).toHaveBeenCalledTimes( 1 );

		render.mock.calls[ 0 ][ 0 ].update( 'card1', { title: 'B' } );
		flush();
		expect( render ).toHaveBeenCalledTimes( 2 );
		expect( render.mock.calls[ 1 ][ 0 ].children[ 0 ].attributes.title ).toBe( 'B' );

		render.mock.calls[ 1 ][ 0 ].select( 'card1' );
		flush();
		expect( render ).toHaveBeenCalledTimes( 3 );
		expect( render.mock.calls[ 2 ][ 0 ].selectedId ).toBe( 'card1' );
	} );

	it( "re-runs when its own or a child's preview is re-rendered, and on rerender()", () => {
		const bridge = installEditorBridge();
		const render = jest.fn();
		bridge.overlay( 'gcb/map', render );
		flush();
		window.dispatchEvent( new CustomEvent( 'gcblite:preview-rendered', { detail: { clientId: 'card1' } } ) );
		flush();
		expect( render ).toHaveBeenCalledTimes( 2 );
		render.mock.calls[ 1 ][ 0 ].rerender();
		flush();
		expect( render ).toHaveBeenCalledTimes( 3 );
	} );

	it( 'waits for the block to be on the canvas, and stops when asked', () => {
		document.getElementById( 'block-map1' ).remove();
		const bridge = installEditorBridge();
		const render = jest.fn();
		const stop = bridge.overlay( 'gcb/map', render );
		flush();
		expect( render ).not.toHaveBeenCalled();

		document.body.insertAdjacentHTML( 'beforeend', '<div id="block-map1"></div>' );
		window.dispatchEvent( new CustomEvent( 'gcblite:preview-rendered', { detail: { clientId: 'map1' } } ) );
		flush();
		expect( render ).toHaveBeenCalledTimes( 1 );

		stop();
		render.mock.calls[ 0 ][ 0 ].rerender();
		flush();
		expect( render ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'is installed once, and a throwing overlay does not stop the others', () => {
		const a = installEditorBridge();
		expect( installEditorBridge() ).toBe( a );
		const err = jest.spyOn( console, 'error' ).mockImplementation( () => {} );
		const ok = jest.fn();
		a.overlay( 'gcb/map', () => {
			throw new Error( 'boom' );
		} );
		a.overlay( 'gcb/map', ok );
		flush();
		expect( ok ).toHaveBeenCalledTimes( 1 );
		err.mockRestore();
	} );
} );
