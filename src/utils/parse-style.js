/**
 * An inline style string as React's style object (the block wrapper takes the server render's root style).
 *
 * A custom property keeps its name exactly (Mark, 2026-10-06: "if you change the slider the cards don't update" —
 * `--gcb-per-row` was camelCased to `-GcbPerRow`, which React drops); a vendor prefix takes React's form
 * (`-webkit-line-clamp` → `WebkitLineClamp`, `-ms-…` → `ms…`).
 *
 * @param {string} str
 * @return {Object}
 */
export function parseStyle( str ) {
	const out = {};
	String( str || '' )
		.split( ';' )
		.forEach( ( rule ) => {
			const [ prop, ...rest ] = rule.split( ':' );
			const name = ( prop || '' ).trim();
			if ( ! name || rest.length === 0 ) {
				return;
			}
			const value = rest.join( ':' ).trim();
			if ( name.startsWith( '--' ) ) {
				out[ name ] = value;
				return;
			}
			const key = name
				.replace( /^-ms-/, 'ms-' )
				.replace( /^-/, '' )
				.replace( /-([a-z])/g, ( _, c ) => c.toUpperCase() );
			out[ /^(webkit|moz|o)[A-Z]/.test( key ) ? key[ 0 ].toUpperCase() + key.slice( 1 ) : key ] = value;
		} );
	return out;
}
