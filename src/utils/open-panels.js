/**
 * The panels a block's sidebar opens: those whose control says `initialOpen` (a built block's Content panel, the
 * base-components sweep 2026-10-06), and those a click on the canvas forced open (panelOpenStore).
 *
 * @param {Array}       controls the block's controls
 * @param {Set<string>} forced   the panel ids a click forced open
 * @return {Set<string>} the panel ids to open
 */
export function openPanelIds( controls, forced ) {
	const out = new Set( forced || [] );
	for ( const c of controls || [] ) {
		if ( c && c.id && c.initialOpen && [ 'panel', 'group', 'tools-panel' ].includes( c.type ) ) {
			out.add( c.id );
		}
	}
	return out;
}
