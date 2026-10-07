/**
 * The pure half of the `pin-map` control: which pins a map shows and what they are called. Kept apart from the
 * drawing (PinMapControl.jsx) so it is tested on its own, as layout-value.js is.
 */
import { __, sprintf } from '@wordpress/i18n';
import { pointOf } from './point-image';

/** 1 → "01". */
export const pad = ( n ) => String( n ).padStart( 2, '0' );

/** A field value as plain text (inline-edited titles can carry markup). */
export const plain = ( v ) => String( v || '' ).replace( /<[^>]*>/g, '' ).trim();

/** A pin's tag: 03 for a card's only location, 03a / 03b … when it has several. */
export function pinTag( cardIndex, rowIndex, rowCount ) {
	return pad( cardIndex + 1 ) + ( rowCount > 1 ? String.fromCharCode( 97 + ( rowIndex % 26 ) ) : '' );
}

/**
 * Every pin on the map, in card order: one per card (single), or one per location row (grouped).
 *
 * @return {Array<{key, cardId, cardIndex, row, point, tag, label}>} row is the location's index, or -1 in single mode
 */
export function pinsOf( cards, cfg ) {
	const out = [];
	cards.forEach( ( card, ci ) => {
		const name = plain( card.attributes?.[ cfg.labelKey ] ) || sprintf( __( 'Touchpoint %s', 'gcblite' ), pad( ci + 1 ) );
		if ( ! cfg.pointsKey ) {
			out.push( { key: card.clientId, cardId: card.clientId, cardIndex: ci, row: -1, point: pointOf( card.attributes?.[ cfg.pointKey ] ), tag: pad( ci + 1 ), label: name } );
			return;
		}
		const rows = Array.isArray( card.attributes?.[ cfg.pointsKey ] ) ? card.attributes[ cfg.pointsKey ] : [];
		rows.forEach( ( r, ri ) => {
			out.push( {
				key: card.clientId + ':' + ( r?._id || ri ),
				cardId: card.clientId,
				cardIndex: ci,
				row: ri,
				point: pointOf( r?.[ cfg.rowPointKey ] ),
				tag: pinTag( ci, ri, rows.length ),
				label: plain( r?.[ cfg.rowLabelKey ] ) || name,
			} );
		} );
	} );
	return out;
}

