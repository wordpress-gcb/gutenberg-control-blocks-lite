/**
 * HOTSPOTS — an image you click to place pins on.
 *
 * Mark, 2026-09-23: "a field that allows you to click ON the image — I guess
 * this can be a duplication of the image field itself except with some
 * modification or removed settings (so it's not display cover etc), when you
 * click on the image what needs to happen is you get a repeater field and in
 * that repeater you can enter your text etc." And, correcting the first spike:
 *
 *   "the place thing MUST contain the actual image
 *    The repeater must be the repeater FIELD TYPE
 *    The dots must show on the image when you place."
 *
 * All three live in ONE field, and none of it is InnerBlocks. The value:
 *
 *   { image: {id, url, alt}, pins: [ {_id, point:{x,y}, …row fields} ] }
 *
 * `pins` is the package's own `repeater` CONTROL (controls/repeater.js — the
 * form-of-forms field, whose header calls it "distinct from the gcb/repeater
 * block"), which already brings rows, drag-reorder, collapsed titles, and
 * sub-fields of any registered type. So what a pin HOLDS stays kimi's to
 * design, in `control.fields`; only WHERE it sits belongs to this control.
 *
 * WHY NOT INNERBLOCKS. The first spike proved a sidebar control can insert a
 * sibling repeater's child blocks from a click (docs/hotspot-field.md §7) — it
 * works, and it was the wrong shape: pins are one field's value, edited in one
 * place, not a canvas surface a person arranges. The repeater FIELD is their
 * home, and the picture belongs in the field with them.
 *
 * THE IMAGE IS A BACKDROP, NOT A STYLED ELEMENT. The `image` control was tried
 * for choosing it and shows its chosen state as a 32px round swatch beside a
 * filename, whose click opens size / focal point / repeat — the settings for a
 * picture you STYLE ("the image doesn't show when i do add image"). Here the
 * picture IS the working surface, so only the media button is borrowed and the
 * picture is drawn full width beneath it, at its own aspect ratio so a dot lands
 * where the eye put it. Stored: id, url, alt and the real width/height.
 */
import { BaseControl, Button } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { controlComponents } from '@wordpress-gcb/fields';
import { pointOf } from './point-image';

/** A pin's own sub-fields: everything but the point, which is placed, not typed. */
const pinFields = ( control ) =>
	( control?.fields || [] ).filter( ( f ) => f.type !== 'point' );

/** Where a row keeps its place: what the control declares, else any {x,y}. */
function pointKeyOf( control, row ) {
	const declared = ( control?.fields || [] ).find(
		( f ) => f.type === 'point'
	);
	if ( declared ) {
		return declared.attributeKey;
	}
	for ( const [ k, v ] of Object.entries( row || {} ) ) {
		if ( v && typeof v === 'object' && 'x' in v && 'y' in v ) {
			return k;
		}
	}
	return 'point';
}

const newRowId = () => 'r' + Math.random().toString( 36 ).slice( 2, 10 );

export default function HotspotsControl( {
	control,
	value,
	onChange,
	attributes,
} ) {
	const val = value && typeof value === 'object' ? value : {};
	const image = val.image || {};
	const pins = Array.isArray( val.pins ) ? val.pins : [];
	const [ active, setActive ] = useState( null );
	const pointKey = pointKeyOf( control, pins[ 0 ] );
	const set = ( next ) => onChange( { ...val, ...next } );

	/* THE PLACING. A click on the picture appends a row whose point is where it
	   landed. The row IS the pin, so there is no second thing to keep in step. */
	const place = ( e ) => {
		if ( ! image.url ) {
			return;
		}
		const box = e.currentTarget.getBoundingClientRect();
		set( {
			pins: [
				...pins,
				{
					_id: newRowId(),
					[ pointKey ]: {
						x: Math.max( 0, Math.min( 1, ( e.clientX - box.left ) / box.width ) ),
						y: Math.max( 0, Math.min( 1, ( e.clientY - box.top ) / box.height ) ),
					},
				},
			],
		} );
		setActive( pins.length );
	};

	/* Dragging a dot moves that pin. The handler sits on the dot and stops the
	   event, so moving one never also places another. */
	const drag = ( index ) => ( e ) => {
		e.stopPropagation();
		e.preventDefault();
		const picture = e.currentTarget.parentElement;
		const move = ( ev ) => {
			const box = picture.getBoundingClientRect();
			const next = pins.slice();
			next[ index ] = {
				...next[ index ],
				[ pointKey ]: {
					x: Math.max( 0, Math.min( 1, ( ev.clientX - box.left ) / box.width ) ),
					y: Math.max( 0, Math.min( 1, ( ev.clientY - box.top ) / box.height ) ),
				},
			};
			set( { pins: next } );
		};
		const up = () => {
			window.removeEventListener( 'pointermove', move );
			window.removeEventListener( 'pointerup', up );
		};
		window.addEventListener( 'pointermove', move );
		window.addEventListener( 'pointerup', up );
		setActive( index );
	};

	const RepeaterControl = controlComponents?.repeater;
	const rowFields = pinFields( control );

	return (
		<BaseControl
			label={ control?.label || __( 'Hotspots', 'gcblite' ) }
			help={
				image.url
					? __(
							'Click the image to place a pin. Drag a pin to move it.',
							'gcblite'
					  )
					: __(
							'Choose an image, then click it to place pins.',
							'gcblite'
					  )
			}
		>
			{ /* CHOOSING, NOT DRESSING (Mark, 2026-09-23: "the image doesn't
			     show when i do add image"). The `image` control's chosen state
			     is a 32px round swatch beside a filename, and clicking it opens
			     size / focal-point / repeat — the settings for a picture you
			     STYLE. Here the picture is the working surface, so only its
			     BUTTON is borrowed: MediaPicker straight, and the picture drawn
			     full width below at its real aspect ratio. */ }
			<MediaUploadCheck>
				<MediaUpload
					onSelect={ ( media ) =>
						set( {
							image: {
								id: media.id,
								url: media.url,
								alt: media.alt || '',
								width: media.width,
								height: media.height,
							},
						} )
					}
					allowedTypes={ [ 'image' ] }
					value={ image.id }
					render={ ( { open } ) => (
						<Button variant="secondary" onClick={ open }>
							{ image.url
								? __( 'Replace image', 'gcblite' )
								: __( 'Add image', 'gcblite' ) }
						</Button>
					) }
				/>
			</MediaUploadCheck>

			{ !! image.url && (
				<div
					role="presentation"
					onClick={ place }
					style={ {
						position: 'relative',
						marginTop: 8,
						cursor: 'crosshair',
						lineHeight: 0,
						border: '1px solid #cfd3da',
						borderRadius: 2,
						overflow: 'hidden',
						/* THE PLACING SURFACE IS THE PICTURE'S OWN SHAPE (Mark:
						   "need to make sure aspect ratios match on the smaller
						   image so you know where the pin is going"). Without
						   this the box is whatever the sidebar gives it and a
						   dot lands somewhere else on the page. */
						aspectRatio:
							image.width && image.height
								? `${ image.width } / ${ image.height }`
								: undefined,
					} }
				>
					<img
						src={ image.url }
						alt={ image.alt || '' }
						style={ {
							width: '100%',
							height: '100%',
							display: 'block',
							objectFit: 'contain',
						} }
					/>
					{ pins.map( ( pin, i ) => {
						const p = pointOf( pin[ pointKey ] );
						const on = active === i;
						return (
							<button
								key={ pin._id || i }
								type="button"
								onPointerDown={ drag( i ) }
								onClick={ ( e ) => {
									e.stopPropagation();
									setActive( i );
								} }
								aria-label={
									__( 'Pin', 'gcblite' ) + ' ' + ( i + 1 )
								}
								style={ {
									position: 'absolute',
									left: `${ p.x * 100 }%`,
									top: `${ p.y * 100 }%`,
									transform: 'translate(-50%, -50%)',
									width: 24,
									height: 24,
									padding: 0,
									borderRadius: '50%',
									border: on
										? '2px solid #fff'
										: '2px solid rgba(255,255,255,.7)',
									background: on ? '#b8722a' : '#046bd2',
									color: '#fff',
									font: '600 12px/1 system-ui',
									cursor: 'grab',
									boxShadow: '0 1px 4px rgba(0,0,0,.4)',
								} }
							>
								{ i + 1 }
							</button>
						);
					} ) }
				</div>
			) }

			{ RepeaterControl && (
				<div style={ { marginTop: 12 } }>
					<RepeaterControl
						control={ {
							...control,
							type: 'repeater',
							label: __( 'Pins', 'gcblite' ),
							fields: rowFields,
							addButtonLabel: __( 'Add pin', 'gcblite' ),
							collapsedTitle: ( rowFields[ 0 ] || {} ).attributeKey,
						} }
						value={ pins }
						onChange={ ( rows ) =>
							/* a row added from the repeater's own button has no
							   place yet: start it in the middle, to be dragged */
							set( {
								pins: ( rows || [] ).map( ( r ) =>
									r[ pointKey ]
										? r
										: { ...r, [ pointKey ]: { x: 0.5, y: 0.5 } }
								),
							} )
						}
						attributes={ attributes }
					/>
				</div>
			) }

			{ pins.length > 0 && (
				<Button
					variant="tertiary"
					isDestructive
					onClick={ () => {
						set( { pins: [] } );
						setActive( null );
					} }
				>
					{ __( 'Remove all pins', 'gcblite' ) }
				</Button>
			) }
		</BaseControl>
	);
}

export function registerHotspotsControl() {
	if ( controlComponents && ! controlComponents.hotspots ) {
		controlComponents.hotspots = HotspotsControl;
	}
}
