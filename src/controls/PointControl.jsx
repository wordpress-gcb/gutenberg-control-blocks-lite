/**
 * POINT — where a pin sits on the image round it.
 *
 * Mark, 2026-09-22, the hotspots block ("it just repeats itself twice"):
 * each pin's place was a per-item class, and the one item template lost it.
 * A place a person chooses is a field. The value is {x, y} in 0..1, the
 * same shape as an image's focal point, dragged with the same picker over
 * the picture: the block's own image field when it has one, else the
 * nearest ancestor block's (a pin item sits inside a region inside the
 * block that holds the product image). No image near: a plain canvas.
 *
 * Registered from lite, as `query-loop` is, until @wordpress-gcb/fields
 * ships it. gcb-pro's build prints the value as `left:X%;top:Y%`.
 */
import { FocalPointPicker, BaseControl } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { controlComponents } from '@wordpress-gcb/fields';
import { imageUrlIn, pointOf } from './point-image';

const CANVAS =
	'data:image/svg+xml;utf8,' +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#e3e5e9"/><path d="M0 150h400M200 0v300" stroke="#cfd3da"/></svg>'
	);

export default function PointControl( { control, value, onChange, attributes } ) {
	const own = imageUrlIn( attributes );
	/* the picture an ancestor block holds — read-only, innermost first */
	const above = useSelect(
		( select ) => {
			if ( own ) {
				return '';
			}
			const be = select( 'core/block-editor' );
			const id = be.getSelectedBlockClientId();
			if ( ! id ) {
				return '';
			}
			const parents = be.getBlockParents( id ).slice().reverse();
			for ( const p of parents ) {
				const url = imageUrlIn( be.getBlockAttributes( p ) );
				if ( url ) {
					return url;
				}
			}
			return '';
		},
		[ own ]
	);
	const url = own || above || CANVAS;
	const point = pointOf( value === undefined ? control.default : value );
	return (
		<BaseControl
			label={ control.label || __( 'Position', 'gcblite' ) }
			help={ control.help || __( 'Drag the pin to where it sits on the picture.', 'gcblite' ) }
			__nextHasNoMarginBottom
		>
			<FocalPointPicker
				url={ url }
				value={ point }
				onChange={ ( p ) => onChange( pointOf( p ) ) }
				onDragStart={ ( p ) => onChange( pointOf( p ) ) }
				onDrag={ ( p ) => onChange( pointOf( p ) ) }
				__nextHasNoMarginBottom
			/>
		</BaseControl>
	);
}

/** Put the control where the inspector looks. Idempotent; never overrides one the fields package may one day ship. */
export function registerPointControl() {
	if ( controlComponents && ! controlComponents.point ) {
		controlComponents.point = PointControl;
	}
}
