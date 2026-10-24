/**
 * A LOOK FIELD PAINTS A PROPERTY OF ITS ELEMENT (2026-10-24, Mark: "if you've got the same card with a different
 * colour it means it's got a colour field"). A list item's text colour, its border, its dot's background: the
 * field styles that CSS property of the element it is bound to, never prints its value as words.
 *
 * The element says which fields paint which properties: `data-gcb-look="kicker_color:color;dot:background"`.
 * The properties a look may paint are ONE list, includes/Contract/look-props.json, which the PHP twin
 * (Contract\Fields::look_style) reads too.
 *
 * Pure: no React, no WordPress.
 */
import LOOK_PROPS from '../../includes/Contract/look-props.json';
import { styleOf } from './background-value';

const PROPS = Object.fromEntries(
	( Array.isArray( LOOK_PROPS ) ? LOOK_PROPS : [] )
		.filter( ( r ) => r && typeof r.prop === 'string' && ( r.field === 'color' || r.field === 'background' ) )
		.map( ( r ) => [ r.prop, { prop: r.prop, field: r.field, label: String( r.label || r.prop ) } ] )
);

/** @return {Object<string,{prop:string,field:string,label:string}>} what a look field may paint, by property */
export function lookProps() {
	return { ...PROPS };
}

/**
 * `data-gcb-look` → [{ key, prop }]: the property each field paints; a property not on the list is dropped.
 * @param {string} attr
 * @return {Array<{key:string,prop:string}>}
 */
export function bindingsOf( attr ) {
	return String( attr || '' )
		.split( ';' )
		.map( ( b ) => b.trim().split( ':' ) )
		.filter( ( [ key, prop ] ) => key && prop && PROPS[ prop ] )
		.map( ( [ key, prop ] ) => ( { key, prop } ) );
}

const SAFE_COLOR = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d.,%\s/]+\)|var\(--[\w-]+\)|transparent|currentColor|[a-z0-9-]+)$/i;
const SAFE_GRADIENT = /^[a-z-]+gradient\([^"<>;]*\)$/i;
const colorCss = ( c ) => ( /^#|^rgb|^hsl|^var\(|^transparent$|^currentColor$/i.test( c ) ? c : `var(--wp--preset--color--${ c })` );

/**
 * The inline style the looks paint: { cssProperty: storedValue } → a style string, '' when nothing paints.
 * @param {Object} bindings
 * @return {string}
 */
export function lookStyle( bindings ) {
	const out = [];
	Object.entries( bindings || {} ).forEach( ( [ prop, value ] ) => {
		const p = PROPS[ prop ];
		if ( ! p ) {
			return;
		}
		if ( p.field === 'background' ) {
			const s = styleOf( value );
			if ( s ) {
				out.push( s );
			}
			return;
		}
		if ( typeof value !== 'string' ) {
			return;
		}
		const v = value.trim();
		/* the colour control may hold a gradient (showGradients): only a background colour can paint one */
		if ( prop === 'background-color' && SAFE_GRADIENT.test( v ) ) {
			out.push( `background-image:${ v }` );
			return;
		}
		if ( v === '' || ! SAFE_COLOR.test( v ) ) {
			return;
		}
		out.push( `${ prop }:${ colorCss( v ) }` );
	} );
	return out.join( ';' );
}

/**
 * The style an element's looks paint from a block's attributes: its `data-gcb-look`, each key read from `attributes`
 * (the key as the attribute's name — `keyOf` maps a field id to it).
 * @param {string}   attr
 * @param {Object}   attributes
 * @param {Function} keyOf
 * @return {string}
 */
export function lookStyleOf( attr, attributes, keyOf = ( k ) => k ) {
	const values = {};
	bindingsOf( attr ).forEach( ( { key, prop } ) => {
		const v = ( attributes || {} )[ keyOf( key ) ];
		if ( v !== undefined && v !== null && v !== '' ) {
			values[ prop ] = v;
		}
	} );
	return lookStyle( values );
}
