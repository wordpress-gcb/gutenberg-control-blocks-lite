/**
 * THE `query-loop` CONTROL — "which posts does this listing show?"
 *
 * Mark, 2026-09-21: the sidebar of a freshly built store locator read
 * "Which posts: unknown control type query-loop".
 *
 * gcb-lite documents the type, validates it, runs it server-side
 * (Blocks\Queries\QueryLoop) and pages it over REST — and the editor had
 * nothing to draw it with: @wordpress-gcb/fields ships no such control. Its
 * `controlComponents` is a plain exported object, so the control lives here
 * and is registered onto it (registerQueryLoopControl, called from each entry
 * that renders an inspector).
 *
 * What it edits is decided in query-loop-model.js, where it is tested; this
 * file only draws it. The filter list is the chosen post type's REAL
 * taxonomies — a facet is a box ticked, never a slug typed.
 */
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import {
	BaseControl,
	CheckboxControl,
	SelectControl,
	TextControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { controlComponents } from '@wordpress-gcb/fields';
import {
	normaliseQuery,
	toggleTaxonomy,
	ORDERBY,
	PAGINATION,
	MAX_PER_PAGE,
} from './query-loop-model';

const ORDERBY_LABELS = {
	date: __( 'Newest first (date)', 'gcblite' ),
	title: __( 'Title', 'gcblite' ),
	menu_order: __( 'Manual order', 'gcblite' ),
	rand: __( 'Random', 'gcblite' ),
	modified: __( 'Last modified', 'gcblite' ),
};
const PAGINATION_LABELS = {
	numbered: __( 'Numbered pages', 'gcblite' ),
	loadmore: __( 'Load more button', 'gcblite' ),
	none: __( 'None — show one page', 'gcblite' ),
};

export default function QueryLoopControl( { control, value, onChange } ) {
	const query = normaliseQuery( value, control.default );

	const { postTypes, taxonomies } = useSelect(
		( select ) => {
			const core = select( coreStore );
			const types = core.getPostTypes( { per_page: -1 } ) || [];
			const taxes = core.getTaxonomies( { per_page: -1 } ) || [];
			return {
				postTypes: types.filter(
					( t ) => t.viewable && t.slug !== 'attachment'
				),
				taxonomies: taxes.filter(
					( t ) =>
						t.visibility?.public !== false &&
						( t.types || [] ).includes( query.postType )
				),
			};
		},
		[ query.postType ]
	);

	const set = ( patch ) => onChange( { ...query, ...patch } );

	/* a drafted type may not be in the REST list yet — never drop the value
	   the block was built with just because the picker cannot see it */
	const typeOptions = postTypes.map( ( t ) => ( {
		label: t.name,
		value: t.slug,
	} ) );
	if (
		query.postType &&
		! typeOptions.some( ( o ) => o.value === query.postType )
	) {
		typeOptions.unshift( {
			label: query.postType,
			value: query.postType,
		} );
	}

	return (
		<BaseControl
			id={ 'gcblite-query-loop-' + control.id }
			label={ control.label }
			help={ control.helpText }
			__nextHasNoMarginBottom
		>
			<SelectControl
				label={ __( 'Post type', 'gcblite' ) }
				value={ query.postType }
				options={ typeOptions }
				/* a new type has other taxonomies: its facets do not carry over */
				onChange={ ( postType ) =>
					set( { postType, filterTaxonomies: [] } )
				}
				__nextHasNoMarginBottom
			/>
			<TextControl
				type="number"
				label={ __( 'Per page', 'gcblite' ) }
				value={ query.perPage }
				min={ 1 }
				max={ MAX_PER_PAGE }
				onChange={ ( n ) =>
					set( {
						perPage: normaliseQuery( { perPage: n }, {} ).perPage,
					} )
				}
				__nextHasNoMarginBottom
			/>
			<SelectControl
				label={ __( 'Order by', 'gcblite' ) }
				value={ query.orderby }
				options={ ORDERBY.map( ( v ) => ( {
					label: ORDERBY_LABELS[ v ],
					value: v,
				} ) ) }
				onChange={ ( orderby ) => set( { orderby } ) }
				__nextHasNoMarginBottom
			/>
			<SelectControl
				label={ __( 'Direction', 'gcblite' ) }
				value={ query.order }
				options={ [
					{ label: __( 'Descending', 'gcblite' ), value: 'DESC' },
					{ label: __( 'Ascending', 'gcblite' ), value: 'ASC' },
				] }
				onChange={ ( order ) => set( { order } ) }
				__nextHasNoMarginBottom
			/>
			<SelectControl
				label={ __( 'Pagination', 'gcblite' ) }
				value={ query.pagination }
				options={ PAGINATION.map( ( v ) => ( {
					label: PAGINATION_LABELS[ v ],
					value: v,
				} ) ) }
				onChange={ ( pagination ) => set( { pagination } ) }
				__nextHasNoMarginBottom
			/>
			{ taxonomies.length > 0 && (
				<BaseControl
					id={ 'gcblite-query-loop-facets-' + control.id }
					label={ __( 'Visitors can filter by', 'gcblite' ) }
					__nextHasNoMarginBottom
				>
					{ taxonomies.map( ( t ) => (
						<CheckboxControl
							key={ t.slug }
							label={ t.name }
							checked={ query.filterTaxonomies.some(
								( f ) => f.slug === t.slug
							) }
							onChange={ ( on ) =>
								onChange(
									toggleTaxonomy(
										query,
										{ slug: t.slug, label: t.name },
										on
									)
								)
							}
							__nextHasNoMarginBottom
						/>
					) ) }
				</BaseControl>
			) }
		</BaseControl>
	);
}

/**
 * Put the control where the inspector looks. Idempotent; never overrides a
 * `query-loop` the fields package may one day ship itself.
 */
export function registerQueryLoopControl() {
	if ( controlComponents && ! controlComponents[ 'query-loop' ] ) {
		controlComponents[ 'query-loop' ] = QueryLoopControl;
	}
}
