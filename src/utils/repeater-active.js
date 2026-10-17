/**
 * WHICH ITEM A REPEATER IS EDITING, shared by the two places that show it (2026-10-18, the editor strip). The
 * carousel draws the slide on stage inside the block's preview, which is re-parsed on every refresh; the block's
 * footer strip (BlockFooter) draws the numbered switcher under the block, outside that preview. Neither owns the
 * other, so the index lives here, keyed by the repeater block's clientId, and both read and write it.
 *
 * Editor-local and never saved: a reload starts every list at its first item.
 */
import { useEffect, useState } from '@wordpress/element';

const active = new Map();
const listeners = new Map();

/**
 * @param {string} clientId the repeater block
 * @return {number} the item being edited, 0-based (0 when none was chosen)
 */
export function getActive( clientId ) {
	return active.get( clientId ) ?? 0;
}

/**
 * @param {string} clientId the repeater block
 * @param {number} index    the item to edit, 0-based (-1 for "none", an accordion's all-closed)
 */
export function setActive( clientId, index ) {
	if ( active.get( clientId ) === index ) {
		return;
	}
	active.set( clientId, index );
	( listeners.get( clientId ) || [] ).forEach( ( fn ) => fn( index ) );
}

/**
 * The item a repeater is editing, kept current as either place changes it.
 *
 * @param {string} clientId the repeater block
 * @return {[number, Function]} the index and a setter
 */
export function useRepeaterActive( clientId ) {
	const [ value, setValue ] = useState( () => getActive( clientId ) );
	useEffect( () => {
		setValue( getActive( clientId ) );
		const fns = listeners.get( clientId ) || new Set();
		fns.add( setValue );
		listeners.set( clientId, fns );
		return () => {
			fns.delete( setValue );
		};
	}, [ clientId ] );
	return [ value, ( i ) => setActive( clientId, i ) ];
}
