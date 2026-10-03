/**
 * THE BACKGROUND CONTROL: a three-way switch — Colour / Gradient / Image — over
 * the matching picker, every pick kept so a person can flip and come back.
 *
 * Mark, 2026-10-03 (the Angry Birds import): "the beige background isn't an
 * image, it's just a colour … it'd be good if … we have a background field
 * that takes image or colour or gradient". The pickers are the SDK's own
 * colour and image fields, so a background looks and behaves like the fields
 * a person already knows; only the switch and the value shape are new.
 *
 * Under a picture, the colour picker stays: a transparent pattern (white
 * doodles on green) is nothing without the colour it sits on.
 */
import { controlComponents } from '@wordpress-gcb/fields';
import {
	BaseControl,
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { backgroundOf, kinds } from './background-value';

export default function BackgroundControl( { control, value, onChange, attributes } ) {
	const b = backgroundOf( value );
	const set = ( patch ) => onChange( { ...b, ...patch } );
	const ColorField = controlComponents?.color;
	const ImageField = controlComponents?.image;
	const sub = ( overrides ) => ( { ...control, ...overrides, label: overrides.label } );

	return (
		<BaseControl label={ control.label } help={ control.help } className="gcb-background-control">
			<ToggleGroupControl
				value={ b.kind }
				onChange={ ( kind ) => set( { kind } ) }
				isBlock
				__nextHasNoMarginBottom
				label={ __( 'Background kind', 'gcblite' ) }
				hideLabelFromVision
			>
				{ kinds().map( ( k ) => (
					<ToggleGroupControlOption key={ k.value } value={ k.value } label={ __( k.label, 'gcblite' ) } />
				) ) }
			</ToggleGroupControl>
			{ b.kind === 'color' && ColorField && (
				<ColorField control={ sub( { label: __( 'Colour', 'gcblite' ), showGradients: false } ) } value={ b.color } onChange={ ( color ) => set( { color: color || '' } ) } attributes={ attributes } />
			) }
			{ b.kind === 'gradient' && ColorField && (
				<ColorField control={ sub( { label: __( 'Gradient', 'gcblite' ), showGradients: true } ) } value={ b.gradient } onChange={ ( gradient ) => set( { gradient: gradient || '' } ) } attributes={ attributes } />
			) }
			{ b.kind === 'image' && ImageField && (
				<>
					<ImageField control={ sub( { label: __( 'Image', 'gcblite' ), enableSizeOptions: true, enableRepeatOptions: true, enableFixedBackground: true, enableFocalPoint: true } ) } value={ b.image || {} } onChange={ ( image ) => set( { image: image && image.url ? image : null } ) } attributes={ attributes } />
					{ ColorField && (
						<ColorField control={ sub( { label: __( 'Colour under it', 'gcblite' ), showGradients: false } ) } value={ b.color } onChange={ ( color ) => set( { color: color || '' } ) } attributes={ attributes } />
					) }
				</>
			) }
		</BaseControl>
	);
}

export function registerBackgroundControl() {
	if ( controlComponents && ! controlComponents.background ) {
		controlComponents.background = BackgroundControl;
	}
}
