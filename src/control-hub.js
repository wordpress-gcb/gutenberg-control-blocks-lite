/**
 * THE CONTROL HUB — where a field type's editor component is registered, for
 * every GCB field editor on the page (TODO.md, "Extension points" 1).
 *
 * GCB's three field-editor bundles (block editor, post-fields meta box,
 * sidebar panel) each carry their own copy of the fields package's control
 * registry, so a theme or plugin can't reach "the" registry by importing it.
 * It registers here instead, and each bundle copies what it finds and listens
 * for more (src/control-registry.js) — so load order between a control script
 * and a bundle doesn't matter.
 *
 *   window.gcbLiteControls.register( 'timeline', TimelineControl );
 *
 * The component gets the props every GCB control gets:
 * { control, value, onChange, attributes }. Pair it with
 * gcblite_register_control_type() in PHP, which types the attribute and adds
 * the type to the vocabulary; its `script` arg loads this file's dependents.
 *
 * A built-in or GCB's own control is not replaced unless `{ override: true }`.
 *
 * Plain script, no imports: it must exist before anything registers.
 */
( function () {
	if ( typeof window === 'undefined' || window.gcbLiteControls ) {
		return;
	}
	const entries = {};
	const listeners = [];

	window.gcbLiteControls = {
		/**
		 * @param {string}          type      the field type, as in block.fields.json
		 * @param {Function|Object} component a React component (function, memo or forwardRef)
		 * @param {Object}          [options]
		 * @param {boolean}         [options.override] replace a built-in / GCB control of the same name
		 * @return {boolean} whether it was registered
		 */
		register( type, component, options = {} ) {
			const ok =
				typeof type === 'string' &&
				/^[a-z][a-z0-9-]*$/.test( type ) &&
				( typeof component === 'function' || ( component && typeof component === 'object' ) );
			if ( ! ok ) {
				// eslint-disable-next-line no-console
				console.warn( '[gcbLiteControls] register( type, Component ): needs a lowercase type and a component.', type );
				return false;
			}
			const entry = { component, override: !! options.override };
			entries[ type ] = entry;
			listeners.forEach( ( fn ) => fn( type, entry ) );
			return true;
		},

		/** The component registered for a type, or undefined. */
		get( type ) {
			return entries[ type ] ? entries[ type ].component : undefined;
		},

		/** Every type registered here. */
		types() {
			return Object.keys( entries );
		},

		/**
		 * Hear about every registration — the ones already made, then each new one.
		 * @param {Function} fn ( type, { component, override } )
		 * @return {Function} unsubscribe
		 */
		subscribe( fn ) {
			listeners.push( fn );
			Object.keys( entries ).forEach( ( type ) => fn( type, entries[ type ] ) );
			return () => {
				const i = listeners.indexOf( fn );
				if ( i !== -1 ) {
					listeners.splice( i, 1 );
				}
			};
		},
	};
} )();
