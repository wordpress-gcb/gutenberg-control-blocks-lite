/**
 * POINT — where a pin sits on the image round it.
 *
 * Mark, 2026-09-22, the hotspots block ("it just repeats itself twice"):
 * each pin's place was a per-item class, and the one item template lost it.
 * A place a person chooses is a field. The value is {x, y} in 0..1, the
 * same shape as an image's focal point, placed over the picture: the
 * block's own image field when it has one, else the nearest ancestor
 * block's (a pin item sits inside a region inside the block that holds the
 * product image). No image near: a plain canvas.
 *
 * ITS OWN PICKER, WITH ZOOM (Mark, 2026-10-07, placing touchpoints on a site
 * map: "the choose location 'pin' on the image should probably be blue and
 * smaller and we possibly need that image to zoom in more"). Core's
 * FocalPointPicker could not be zoomed: it reads the click's offset from the
 * drag area's on-screen box but divides by its unscaled size, so any CSS
 * scale put the pin in the wrong place. Here the point is read from the
 * scaled picture's own box, so it lands under the pointer at every zoom; the
 * zoom is centred on the pin each time it changes.
 *
 * Registered from lite, as `query-loop` is, until @wordpress-gcb/fields
 * ships it. gcb-pro's build prints the value as `left:X%;top:Y%`.
 */
import { BaseControl, Button } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { controlComponents } from '@wordpress-gcb/fields';
import { imageUrlIn, pointOf } from './point-image';

const CANVAS =
	'data:image/svg+xml;utf8,' +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#e3e5e9"/><path d="M0 150h400M200 0v300" stroke="#cfd3da"/></svg>'
	);
const ZOOMS = [ 1, 2, 3, 4, 6 ];
const round = ( n ) => Math.round( n * 1000 ) / 1000;
const clamp01 = ( n ) => Math.max( 0, Math.min( 1, n ) );

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

	const [ zoom, setZoom ] = useState( 1 );
	const [ origin, setOrigin ] = useState( point ); // what the zoom is centred on
	const stage = useRef();
	const dragging = useRef( false );

	const pointFrom = ( e ) => {
		const r = stage.current.getBoundingClientRect(); // the SCALED box — right at every zoom
		return { x: round( clamp01( ( e.clientX - r.left ) / r.width ) ), y: round( clamp01( ( e.clientY - r.top ) / r.height ) ) };
	};
	const zoomTo = ( z ) => {
		setOrigin( point );
		setZoom( z );
	};
	const step = ( dir ) => {
		const i = ZOOMS.indexOf( zoom );
		zoomTo( ZOOMS[ Math.max( 0, Math.min( ZOOMS.length - 1, i + dir ) ) ] );
	};

	const onDown = ( e ) => {
		if ( e.button !== 0 ) {
			return;
		}
		e.preventDefault();
		dragging.current = true;
		try {
			e.currentTarget.setPointerCapture( e.pointerId );
		} catch ( err ) {}
		onChange( pointFrom( e ) );
	};
	const onMove = ( e ) => {
		if ( dragging.current ) {
			onChange( pointFrom( e ) );
		}
	};
	// The view holds still when a drag ends (re-centring then made the picture jump under the pointer); it centres
	// on the pin again when the zoom changes.
	const onUp = () => {
		dragging.current = false;
	};
	const onKey = ( e ) => {
		const d = e.shiftKey ? 0.02 : 0.005;
		const by = { ArrowLeft: [ -d, 0 ], ArrowRight: [ d, 0 ], ArrowUp: [ 0, -d ], ArrowDown: [ 0, d ] }[ e.key ];
		if ( by ) {
			e.preventDefault();
			onChange( { x: round( clamp01( point.x + by[ 0 ] ) ), y: round( clamp01( point.y + by[ 1 ] ) ) } );
		}
	};

	return (
		<BaseControl
			label={ control.label || __( 'Position', 'gcblite' ) }
			help={ control.help || __( 'Click or drag on the picture to place the pin. Zoom in for precision.', 'gcblite' ) }
			__nextHasNoMarginBottom
		>
			<div className="gcb-point">
				<div className="gcb-point__view" onPointerDown={ onDown } onPointerMove={ onMove } onPointerUp={ onUp } onPointerCancel={ onUp }>
					<div
						className="gcb-point__stage"
						ref={ stage }
						style={ {
							transform: `scale(${ zoom })`,
							transformOrigin: `${ origin.x * 100 }% ${ origin.y * 100 }%`,
							'--gcb-point-inv': 1 / zoom,
						} }
					>
						<img src={ url } alt="" draggable={ false } />
						<span
							className="gcb-point__pin"
							role="slider"
							tabIndex={ 0 }
							aria-label={ __( 'Pin position — arrow keys move it', 'gcblite' ) }
							aria-valuetext={ sprintf( /* translators: 1: x %, 2: y % */ __( '%1$d%% across, %2$d%% down', 'gcblite' ), Math.round( point.x * 100 ), Math.round( point.y * 100 ) ) }
							onKeyDown={ onKey }
							style={ { left: `${ point.x * 100 }%`, top: `${ point.y * 100 }%` } }
						/>
					</div>
				</div>
				<div className="gcb-point__bar">
					<span className="gcb-point__xy">
						{ Math.round( point.x * 100 ) }% · { Math.round( point.y * 100 ) }%
					</span>
					<span className="gcb-point__zoom">
						<Button size="small" variant="tertiary" onClick={ () => step( -1 ) } disabled={ zoom === ZOOMS[ 0 ] } label={ __( 'Zoom out', 'gcblite' ) }>
							−
						</Button>
						<span aria-live="polite">{ zoom }×</span>
						<Button size="small" variant="tertiary" onClick={ () => step( 1 ) } disabled={ zoom === ZOOMS[ ZOOMS.length - 1 ] } label={ __( 'Zoom in', 'gcblite' ) }>
							+
						</Button>
					</span>
				</div>
			</div>
		</BaseControl>
	);
}

/** Put the control where the inspector looks. Idempotent; never overrides one the fields package may one day ship. */
export function registerPointControl() {
	if ( controlComponents && ! controlComponents.point ) {
		controlComponents.point = PointControl;
	}
}
