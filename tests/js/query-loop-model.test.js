/**
 * THE `query-loop` CONTROL's model — the pure half.
 *
 * Mark, 2026-09-21, on a freshly built store locator: the sidebar read
 * "Which posts: unknown control type query-loop".
 *
 * gcb-lite documents the type (schemas/controls/query-loop.md), validates it,
 * runs it server-side (Blocks\Queries\QueryLoop) and serves its pages over
 * REST — and the editor had NOTHING to draw it with: @wordpress-gcb/fields
 * ships no `query-loop` control, so every block that lists posts showed a
 * yellow warning where its one setting should be. The engine was whole; the
 * steering wheel was missing.
 *
 * The component is thin on purpose; what it edits is decided here, where it
 * can be tested without an editor.
 */
import {
	normaliseQuery,
	toggleTaxonomy,
	ORDERBY,
	PAGINATION,
} from '../../src/controls/query-loop-model';

describe( 'normaliseQuery', () => {
	it( 'falls back to the control default when the attribute is empty', () => {
		expect(
			normaliseQuery( undefined, { postType: 'store', perPage: 12 } )
		).toMatchObject( { postType: 'store', perPage: 12 } );
	} );

	it( 'a saved value wins over the default, key by key', () => {
		const q = normaliseQuery(
			{ perPage: 6 },
			{ postType: 'store', perPage: 12, orderby: 'title' }
		);
		expect( q ).toMatchObject( { postType: 'store', perPage: 6, orderby: 'title' } );
	} );

	it( 'fills what QueryLoop::build_args would assume, so the UI shows the truth', () => {
		const q = normaliseQuery( {}, {} );
		expect( q.perPage ).toBe( 12 );
		expect( q.orderby ).toBe( 'date' );
		expect( q.order ).toBe( 'DESC' );
		expect( q.pagination ).toBe( 'numbered' );
		expect( q.filterTaxonomies ).toEqual( [] );
	} );

	it( 'clamps per-page to what the server allows (1–100)', () => {
		expect( normaliseQuery( { perPage: 9999 }, {} ).perPage ).toBe( 100 );
		expect( normaliseQuery( { perPage: 0 }, {} ).perPage ).toBe( 12 );
		expect( normaliseQuery( { perPage: -4 }, {} ).perPage ).toBe( 12 );
	} );

	it( 'refuses an orderby or pagination the server would refuse', () => {
		expect( normaliseQuery( { orderby: 'date); DROP' }, {} ).orderby ).toBe( 'date' );
		expect( normaliseQuery( { pagination: 'infinite' }, {} ).pagination ).toBe( 'numbered' );
		expect( ORDERBY ).toEqual( [ 'date', 'title', 'menu_order', 'rand', 'modified' ] );
		expect( PAGINATION ).toEqual( [ 'numbered', 'loadmore', 'none' ] );
	} );

	it( 'keeps keys it does not know — GCB Pro rides filterFields beside the rest', () => {
		expect(
			normaliseQuery( { filterFields: [ { key: 'city' } ] }, {} ).filterFields
		).toEqual( [ { key: 'city' } ] );
	} );
} );

describe( 'toggleTaxonomy', () => {
	const q = { filterTaxonomies: [ { slug: 'region', label: 'Region' } ] };

	it( 'adds a facet', () => {
		expect(
			toggleTaxonomy( q, { slug: 'brand', label: 'Brand' }, true ).filterTaxonomies
		).toEqual( [
			{ slug: 'region', label: 'Region' },
			{ slug: 'brand', label: 'Brand' },
		] );
	} );

	it( 'removes one', () => {
		expect(
			toggleTaxonomy( q, { slug: 'region' }, false ).filterTaxonomies
		).toEqual( [] );
	} );

	it( 'never adds the same facet twice', () => {
		expect(
			toggleTaxonomy( q, { slug: 'region', label: 'Region' }, true ).filterTaxonomies
		).toHaveLength( 1 );
	} );

	it( 'does not mutate what it was given', () => {
		toggleTaxonomy( q, { slug: 'brand', label: 'Brand' }, true );
		expect( q.filterTaxonomies ).toHaveLength( 1 );
	} );
} );
