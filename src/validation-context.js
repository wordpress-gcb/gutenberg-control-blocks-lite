/**
 * Tells each rendered control whether its value is currently invalid, so it
 * can show inline error UI without each control type knowing how the host
 * tracks validation state.
 *
 * Provided by the meta-box App (and, in future, the block Inspector) at the
 * tree root. Controls read it via useContext(ValidationContext).
 *
 * Default value is { errors: {}, showErrors: false } — i.e. the sidebar
 * Inspector, which doesn't yet drive validation, gets a no-op context
 * so the same controls render fine in both surfaces.
 */

import { createContext } from '@wordpress/element';

export const ValidationContext = createContext({
	errors: {},        // { attributeKey: 'human message' }
	showErrors: false, // becomes true after the first failed save attempt
});
