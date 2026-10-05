/**
 * A BACKGROUND IS A COLOUR, A GRADIENT OR A PICTURE — ONE FIELD, EITHER/OR.
 *
 * Mark, 2026-10-03: "the beige background isn't an image, it's just a colour
 * … a background field that takes image or colour or gradient". The value
 * keeps all three so a person can flip between them and come back; `kind`
 * says which paints. A picture may sit on a colour (a transparent pattern on
 * green): the colour paints under it.
 *
 * Pure: no React, no WordPress. The PHP twin is Contract\Fields::background_style().
 */

const KINDS = [
	{ value: 'color', label: 'Colour' },
	{ value: 'gradient', label: 'Gradient' },
	{ value: 'image', label: 'Image' },
	{ value: 'video', label: 'Video' },
];

export function kinds() {
	return KINDS.slice();
}

const isImage = ( v ) => !! v && typeof v === 'object' && typeof v.url === 'string' && v.url !== '';
/* a video's address: an http(s) link (YouTube, Vimeo, a file) */
const isLink = ( v ) => typeof v === 'string' && /^https?:\/\/\S+$/i.test( v.trim() );

/**
 * A VIDEO BEHIND THE CONTENTS (Mark, 2026-10-05: "paste in a youtube url, vimeo url, or upload a video, set options for
 * auto play etc (with mute of course)"). Always muted: a background never makes a sound. The link wins over a file.
 * @param {*} v
 * @return {Object|null}
 */
function videoOf( v ) {
	if ( ! v || typeof v !== 'object' ) {
		return null;
	}
	const link = isLink( v.link ) ? v.link.trim() : '';
	const file = isImage( v.file ) ? v.file : null;
	return {
		link,
		file,
		poster: isImage( v.poster ) ? v.poster : null,
		autoplay: v.autoplay !== false,
		loop: v.loop !== false,
		phones: v.phones === 'poster' ? 'poster' : 'play',
		pause: v.pause !== false,
	};
}

/**
 * @param {*} value what is stored — the object, a bare colour/gradient string, or nothing
 * @return {{kind: string, color: string, gradient: string, image: (Object|null), video: (Object|null)}}
 */
export function backgroundOf( value ) {
	let color = '';
	let gradient = '';
	let image = null;
	let video = null;
	let kind = '';
	if ( typeof value === 'string' ) {
		if ( value.includes( 'gradient(' ) ) {
			gradient = value;
		} else {
			color = value;
		}
	} else if ( value && typeof value === 'object' ) {
		color = typeof value.color === 'string' ? value.color : '';
		gradient = typeof value.gradient === 'string' ? value.gradient : '';
		image = isImage( value.image ) ? value.image : null;
		video = videoOf( value.video );
		kind = typeof value.kind === 'string' ? value.kind : '';
	}
	const has = { color: color !== '', gradient: gradient !== '', image: image !== null, video: !! video && ( video.link !== '' || video.file !== null ) };
	if ( ! has[ kind ] ) {
		kind = has.image ? 'image' : has.gradient ? 'gradient' : 'color';
	}
	return { kind, color, gradient, image, video };
}

const colorCss = ( c ) => ( /^#|^rgb|^hsl|^var\(|^transparent$|^currentColor$/i.test( c ) ? c : `var(--wp--preset--color--${ c })` );

const url = ( u ) => `url("${ String( u ).replace( /"/g, '%22' ) }")`;

/**
 * The inline style a background paints: '' when there is nothing to paint.
 * @param {*} value
 * @return {string}
 */
export function styleOf( value ) {
	const b = backgroundOf( value );
	const out = [];
	if ( b.kind === 'color' ) {
		if ( b.color ) {
			out.push( `background-color:${ colorCss( b.color ) }` );
		}
	} else if ( b.kind === 'gradient' ) {
		if ( b.gradient ) {
			out.push( `background-image:${ b.gradient }` );
		}
	} else if ( b.kind === 'image' && b.image ) {
		if ( b.color ) {
			out.push( `background-color:${ colorCss( b.color ) }` );
		}
		const im = b.image;
		const size = im.size === 'contain' ? 'contain' : im.size === 'tile' ? 'auto' : im.size === 'custom' && im.customWidth ? String( im.customWidth ) : 'cover';
		const fp = im.focalPoint && typeof im.focalPoint === 'object' ? im.focalPoint : { x: 0.5, y: 0.5 };
		const pc = ( n ) => Math.round( Math.min( 1, Math.max( 0, Number( n ) || 0 ) ) * 100 );
		out.push( `background-image:${ url( im.url ) }` );
		out.push( `background-size:${ size }` );
		out.push( `background-position:${ pc( fp.x ) }% ${ pc( fp.y ) }%` );
		out.push( `background-repeat:${ im.isRepeat ? 'repeat' : 'no-repeat' }` );
		if ( im.isFixed ) {
			out.push( 'background-attachment:fixed' );
		}
	} else if ( b.kind === 'video' && b.video && b.video.poster ) {
		/* its poster paints until the player is there, and in the editor; the render lays the player over it */
		if ( b.color ) {
			out.push( `background-color:${ colorCss( b.color ) }` );
		}
		out.push( `background-image:${ url( b.video.poster.url ) }` );
		out.push( 'background-size:cover' );
		out.push( 'background-position:50% 50%' );
		out.push( 'background-repeat:no-repeat' );
	}
	return out.join( ';' );
}
