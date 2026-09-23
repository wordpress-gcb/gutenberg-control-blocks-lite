/**
 * HOTSPOTS — SPIKE, not a shipped control (2026-09-23, docs/hotspot-field.md).
 *
 * Mark: "a field that allows you to click ON the image ... when you click on the
 * image what needs to happen is you get a repeater field and in that repeater
 * you can enter your text etc."
 *
 * THE QUESTION THIS ANSWERS, and nothing more: can a field control in the
 * sidebar add and remove a SIBLING REPEATER's children — real InnerBlocks that
 * WordPress owns — from a click on a picture, and set the new child's `point`?
 * If it can, pins stay one source of truth (the child blocks) and this control
 * is only a nicer way to reach them. If it cannot, pins would have to live in
 * this field's own value, which breaks the rule that repeated content is
 * InnerBlocks.
 *
 * What is deliberately NOT here: styling, dragging an existing pin, per-pin
 * fields, removing the image field's layout settings, the media chooser. Those
 * are the interaction work that follows a yes.
 */
import { BaseControl, Button } from '@wordpress/components';
import { useSelect, useDispatch } from '@wordpress/data';
import { createBlock } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { controlComponents } from '@wordpress-gcb/fields';
import { imageUrlIn, pointOf } from './point-image';

/**
 * The nearest repeater among this block's own descendants, and its pin items.
 *
 * The control is rendered for the block that HOLDS the image; the pins are a
 * repeater inside it. `getBlockOrder` on a clientId gives that block's children,
 * so the repeater is the first descendant that has any.
 *
*/
function usePinRepeater() {
	return useSelect( ( select ) => {
			const be = select( 'core/block-editor' );
			/* THE FIELDS PACKAGE PASSES NO clientId (measured 2026-09-23:
			   inspector.js renderControl gives a control exactly
			   { control, value, onChange, attributes }). The control is only
			   ever rendered for the SELECTED block, so the selection IS the
			   block — which is the same workaround PointControl already makes
			   to find an ancestor's image. Worth fixing in the package: a
			   control that must reach the block tree should be told where it
			   is, not have to ask what is selected. */
			const clientId = be.getSelectedBlockClientId();
			if ( ! clientId ) {
				return { repeaterId: null, pins: [], allowed: null };
			}
			/* breadth-first through this block's descendants for the first one
			   whose own name looks like a generated repeater region */
			const queue = [ ...be.getBlockOrder( clientId ) ];
			while ( queue.length ) {
				const id = queue.shift();
				const block = be.getBlock( id );
				if ( ! block ) {
					continue;
				}
				const kids = be.getBlockOrder( id );
				if ( kids.length ) {
					return {
						repeaterId: id,
						pins: kids.map( ( k ) => ( {
							clientId: k,
							attributes: be.getBlockAttributes( k ) || {},
						} ) ),
						allowed: be.getBlockName( kids[ 0 ] ),
					};
				}
				queue.push( ...kids );
			}
			return { repeaterId: null, pins: [], allowed: null };
	}, [] );
}

/** The key on a pin item whose control is a `point`, or a sensible default. */
function pointKeyOf( attributes ) {
	for ( const [ k, v ] of Object.entries( attributes || {} ) ) {
		if ( v && typeof v === 'object' && 'x' in v && 'y' in v ) {
			return k;
		}
	}
	return 'point';
}

export default function HotspotsControl( {
	control,
	value,
	onChange,
	attributes,
} ) {
	const url = imageUrlIn( attributes ) || ( value && value.url ) || '';
	const { repeaterId, pins, allowed } = usePinRepeater();
	const { insertBlock, removeBlock } = useDispatch( 'core/block-editor' );

	/* THE SPIKE ITSELF: a click on the picture becomes a child block whose
	   point is where the click landed. Same call the repeater's own Add button
	   makes (parse-preview.js RepeaterTag.addItem), from a different place. */
	const addPin = ( e ) => {
		if ( ! repeaterId || ! allowed ) {
			return;
		}
		const box = e.currentTarget.getBoundingClientRect();
		const point = {
			x: Math.max( 0, Math.min( 1, ( e.clientX - box.left ) / box.width ) ),
			y: Math.max( 0, Math.min( 1, ( e.clientY - box.top ) / box.height ) ),
		};
		const key = pointKeyOf( pins[ 0 ] && pins[ 0 ].attributes );
		insertBlock(
			createBlock( allowed, { [ key ]: point } ),
			pins.length,
			repeaterId,
			true
		);
	};

	return (
		<BaseControl
			label={ control?.label || __( 'Hotspots', 'gcblite' ) }
			help={
				repeaterId
					? __( 'Click the image to place a pin.', 'gcblite' )
					: __(
							'No pin repeater found inside this block.',
							'gcblite'
					  )
			}
		>
			<div
				role="presentation"
				onClick={ addPin }
				style={ {
					position: 'relative',
					cursor: repeaterId ? 'crosshair' : 'not-allowed',
					background: url ? `center/contain no-repeat url(${ url })` : '#e3e5e9',
					aspectRatio: '4 / 3',
					border: '1px solid #cfd3da',
				} }
			>
				{ pins.map( ( pin, i ) => {
					const p = pointOf( pin.attributes[ pointKeyOf( pin.attributes ) ] );
					return (
						<span
							key={ pin.clientId }
							style={ {
								position: 'absolute',
								left: `${ p.x * 100 }%`,
								top: `${ p.y * 100 }%`,
								transform: 'translate(-50%, -50%)',
								width: 22,
								height: 22,
								borderRadius: '50%',
								background: '#046bd2',
								color: '#fff',
								font: '600 12px/22px system-ui',
								textAlign: 'center',
							} }
						>
							{ i + 1 }
						</span>
					);
				} ) }
			</div>
			{ pins.length > 0 && (
				<Button
					variant="tertiary"
					isDestructive
					onClick={ () => removeBlock( pins[ pins.length - 1 ].clientId ) }
				>
					{ __( 'Remove last pin', 'gcblite' ) }
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
