/**
 * THE BACKGROUND CONTROL: a four-way switch — Colour / Gradient / Image / Video — over
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
	SelectControl,
	TextControl,
	ToggleControl,
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
			{ b.kind === 'video' && (
				<VideoFields b={ b } set={ set } sub={ sub } attributes={ attributes } ImageField={ ImageField } ColorField={ ColorField } />
			) }
		</BaseControl>
	);
}

/**
 * A VIDEO BEHIND THE CONTENTS (Mark, 2026-10-05: "paste in a youtube url, vimeo url, or upload a video, set options for
 * auto play etc (with mute of course)"). A link — YouTube, Vimeo or a file's address — or an uploaded file; a poster;
 * how it plays. It is always muted: a background never makes a sound.
 * @param {Object} root0
 */
function VideoFields( { b, set, sub, attributes, ImageField, ColorField } ) {
	const v = b.video || { link: '', file: null, poster: null, autoplay: true, loop: true, phones: 'play', pause: true };
	const setV = ( patch ) => set( { video: { ...v, ...patch } } );
	return (
		<>
			<TextControl
				__nextHasNoMarginBottom
				label={ __( 'YouTube, Vimeo or video address', 'gcblite' ) }
				help={ __( 'A link wins over an uploaded file.', 'gcblite' ) }
				value={ v.link }
				onChange={ ( link ) => setV( { link } ) }
				placeholder="https://www.youtube.com/watch?v=…"
			/>
			{ ImageField && (
				<ImageField control={ sub( { label: __( 'Or upload a video', 'gcblite' ), allowVideo: true, allowedTypes: [ 'video' ] } ) } value={ v.file || {} } onChange={ ( file ) => setV( { file: file && file.url ? file : null } ) } attributes={ attributes } />
			) }
			{ ImageField && (
				<ImageField control={ sub( { label: __( 'Poster (shown before it plays, and in the editor)', 'gcblite' ) } ) } value={ v.poster || {} } onChange={ ( poster ) => setV( { poster: poster && poster.url ? poster : null } ) } attributes={ attributes } />
			) }
			<ToggleControl __nextHasNoMarginBottom label={ __( 'Play by itself (always muted)', 'gcblite' ) } checked={ v.autoplay } onChange={ ( autoplay ) => setV( { autoplay } ) } />
			<ToggleControl __nextHasNoMarginBottom label={ __( 'Loop', 'gcblite' ) } checked={ v.loop } onChange={ ( loop ) => setV( { loop } ) } />
			<ToggleControl __nextHasNoMarginBottom label={ __( 'Show a pause button', 'gcblite' ) } help={ __( 'Lets a visitor stop the movement.', 'gcblite' ) } checked={ v.pause } onChange={ ( pause ) => setV( { pause } ) } />
			<SelectControl
				__nextHasNoMarginBottom
				label={ __( 'On phones', 'gcblite' ) }
				value={ v.phones }
				options={ [
					{ value: 'play', label: __( 'Play the video', 'gcblite' ) },
					{ value: 'poster', label: __( 'Show the poster only', 'gcblite' ) },
				] }
				onChange={ ( phones ) => setV( { phones } ) }
			/>
			{ ColorField && (
				<ColorField control={ sub( { label: __( 'Colour under it', 'gcblite' ), showGradients: false } ) } value={ b.color } onChange={ ( color ) => set( { color: color || '' } ) } attributes={ attributes } />
			) }
		</>
	);
}

export function registerBackgroundControl() {
	if ( controlComponents && ! controlComponents.background ) {
		controlComponents.background = BackgroundControl;
	}
}
