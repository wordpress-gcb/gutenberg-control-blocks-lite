jest.mock( '@wordpress/api-fetch', () =>
	jest.fn( ( { data } ) =>
		Promise.resolve( {
			success: true,
			results: Object.fromEntries( data.blocks.map( ( b ) => [ b.clientId, { success: true, html: '<p>' + b.blockName + '</p>' } ] ) ),
		} )
	)
);
import apiFetch from '@wordpress/api-fetch';
import coordinator from '../../src/utils/batch-render-coordinator';

const settle = () => new Promise( ( r ) => setTimeout( r, 5 ) );

describe( 'the same preview ask is answered once', () => {
	beforeEach( () => {
		apiFetch.mockClear();
		coordinator.answered.clear();
	} );

	it( 'reuses the answer when a block asks again with nothing changed', async () => {
		const first = await coordinator.requestRender( 'a', 'gcb/x', { t: 1 } );
		const again = await coordinator.requestRender( 'a', 'gcb/x', { t: 1 } );
		expect( again ).toEqual( first );
		expect( apiFetch ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'shares a render still in flight', async () => {
		const p1 = coordinator.requestRender( 'b', 'gcb/x', { t: 1 } );
		const p2 = coordinator.requestRender( 'b', 'gcb/x', { t: 1 } );
		expect( p2 ).toBe( p1 );
		await p1;
		expect( apiFetch ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'renders again when the attributes or the context change', async () => {
		await coordinator.requestRender( 'c', 'gcb/x', { t: 1 } );
		await coordinator.requestRender( 'c', 'gcb/x', { t: 2 } );
		await coordinator.requestRender( 'c', 'gcb/x', { t: 2 }, { 'gcb/index': 1 } );
		expect( apiFetch ).toHaveBeenCalledTimes( 3 );
	} );

	it( 'tries again after a superseded ask', async () => {
		const old = coordinator.requestRender( 'd', 'gcb/x', { t: 1 } );
		const newer = coordinator.requestRender( 'd', 'gcb/x', { t: 2 } );
		await expect( old ).rejects.toThrow( 'superseded' );
		await newer;
		await settle();
		await coordinator.requestRender( 'd', 'gcb/x', { t: 1 } );
		expect( apiFetch ).toHaveBeenCalledTimes( 2 );
	} );
} );
