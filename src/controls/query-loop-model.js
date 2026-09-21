/**
 * What the `query-loop` control edits — the pure half, so it can be tested
 * without an editor (tests/js/query-loop-model.test.js).
 *
 * The allow-lists mirror Blocks\Queries\QueryLoop (ORDERBY, MAX_PER_PAGE) and
 * the pager modes it emits: the UI must not offer what the server refuses,
 * and must SHOW what the server would assume for anything left unsaid.
 */

export const ORDERBY = [ 'date', 'title', 'menu_order', 'rand', 'modified' ];
export const PAGINATION = [ 'numbered', 'loadmore', 'none' ];
export const MAX_PER_PAGE = 100;

/**
 * The query as the editor should show it: the saved value over the control's
 * default, with the server's own assumptions filled in. Unknown keys are kept —
 * GCB Pro carries `filterFields` beside the rest.
 *
 * @param {?Object} value    the block's saved attribute
 * @param {?Object} defaults the control's `default`
 * @return {Object} a complete query config
 */
export function normaliseQuery( value, defaults ) {
	const q = {
		...( defaults && typeof defaults === 'object' ? defaults : {} ),
		...( value && typeof value === 'object' ? value : {} ),
	};
	const per = parseInt( q.perPage, 10 );
	q.perPage = per > 0 ? Math.min( per, MAX_PER_PAGE ) : 12;
	q.postType = typeof q.postType === 'string' ? q.postType : '';
	q.orderby = ORDERBY.includes( q.orderby ) ? q.orderby : 'date';
	q.order = String( q.order || '' ).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
	q.pagination = PAGINATION.includes( q.pagination )
		? q.pagination
		: 'numbered';
	q.filterTaxonomies = Array.isArray( q.filterTaxonomies )
		? q.filterTaxonomies.filter( ( t ) => t && t.slug )
		: [];
	return q;
}

/**
 * Switch one taxonomy facet on or off. Never mutates, never duplicates.
 *
 * @param {Object}  query    a normalised query
 * @param {Object}  taxonomy { slug, label }
 * @param {boolean} on       whether visitors may filter by it
 * @return {Object} the next query
 */
export function toggleTaxonomy( query, taxonomy, on ) {
	const rest = ( query.filterTaxonomies || [] ).filter(
		( t ) => t.slug !== taxonomy.slug
	);
	return {
		...query,
		filterTaxonomies: on
			? [
					...rest,
					{
						slug: taxonomy.slug,
						label: taxonomy.label || taxonomy.slug,
					},
			  ]
			: rest,
	};
}
