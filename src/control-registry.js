/**
 * Connect this bundle's control registry to the control hub
 * (src/control-hub.js): copy in every field type a theme or plugin registered,
 * and keep listening for more. Call it after the bundle has registered its own
 * controls — a hub entry only replaces one of those (or a built-in) when it
 * asks to, with { override: true }.
 *
 * @param {Object} components the fields package's controlComponents map
 * @return {boolean} whether a hub was there to connect to
 */
export function connectControlHub( components ) {
	const hub = typeof window !== 'undefined' ? window.gcbLiteControls : null;
	if ( ! hub || typeof hub.subscribe !== 'function' || ! components ) {
		return false;
	}
	hub.subscribe( ( type, entry ) => {
		if ( ! components[ type ] || entry.override ) {
			components[ type ] = entry.component;
		}
	} );
	return true;
}
