/**
 * The pure half of the `point` control: which picture to drag on, and what a
 * stored point is.
 */

/**
 * The first image-shaped attribute value — {url} — in a block's attributes.
 *
 * @param {Object} attributes a block's attributes
 * @return {string} the url, or '' when none is an image
 */
export function imageUrlIn( attributes ) {
	for ( const v of Object.values( attributes || {} ) ) {
		if ( v && typeof v === 'object' && typeof v.url === 'string' && /^(https?:)?\/\/|^data:image/.test( v.url ) ) {
			return v.url;
		}
	}
	return '';
}

/**
 * A point as stored: {x, y} in 0..1; the middle when nothing usable is there.
 *
 * @param {*} value the attribute's value
 * @return {{x: number, y: number}}
 */
export function pointOf( value ) {
	const clamp = ( n ) => Math.max( 0, Math.min( 1, Number.isFinite( n ) ? n : 0.5 ) );
	if ( ! value || typeof value !== 'object' ) {
		return { x: 0.5, y: 0.5 };
	}
	return { x: clamp( Number( value.x ) ), y: clamp( Number( value.y ) ) };
}
