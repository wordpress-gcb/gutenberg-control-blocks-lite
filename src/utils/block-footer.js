/**
 * THE EDITOR STRIP'S WORDS AND SIZE (BlockFooter, 2026-10-18). Pure rules, no WordPress imports, tested on their own
 * (tests/js/block-footer.test.js).
 *
 * The noun comes from the marker's addButtonLabel ("Add slide" → "slide"), so a block says its noun once.
 */

/** the strip's sizes: normal (56px), small (40px, a list or FAQ), narrow (40px, icon only, under 240px wide) */
export const FOOTER_SIZES = [ 'normal', 'small', 'narrow' ];

/** below this width the button shows only its icon; the label moves to its tooltip and accessible name */
export const NARROW_BELOW = 240;

/**
 * The item's noun from the Add button's label: "Add slide" → "slide", "+ Add Brand" → "brand". Anything that does
 * not start with "Add" is taken whole; nothing at all is "item".
 *
 * @param {string} label the marker's addButtonLabel
 * @return {string} the singular noun, lower case
 */
export function nounFromLabel( label ) {
	const words = String( label || '' )
		.replace( /^\s*\+\s*/, '' )
		.replace( /^\s*add\s+/i, '' )
		.trim();
	return words ? words.toLowerCase() : 'item';
}

/**
 * English plural, enough for item nouns: branch → branches, story → stories, slide → slides. A noun of several
 * words takes the plural on its last word ("spec table" → "spec tables").
 *
 * @param {string} noun singular
 * @return {string} plural
 */
export function pluralOf( noun ) {
	const n = String( noun || 'item' );
	if ( /(s|x|z|ch|sh)$/i.test( n ) ) {
		return n + 'es';
	}
	if ( /[^aeiou]y$/i.test( n ) ) {
		return n.slice( 0, -1 ) + 'ies';
	}
	return n + 's';
}

/**
 * The count after the button: "2 of 8 slides", "8 of 8 slides · limit reached", or with no limit "4 branches".
 *
 * @param {number}  count how many there are
 * @param {?number} max   the most there may be (0, null or undefined: no limit)
 * @param {string}  noun  singular
 * @return {string} the count line
 */
export function countText( count, max, noun ) {
	const plural = pluralOf( noun );
	if ( max ) {
		return `${ count } of ${ max } ${ plural }` + ( count >= max ? ' · limit reached' : '' );
	}
	return `${ count } ${ count === 1 ? noun : plural }`;
}

/**
 * The button's accessible name and tooltip: "Add slide (2 of 8)", or with no limit "Add branch (4 branches)".
 *
 * @param {number}  count
 * @param {?number} max
 * @param {string}  noun
 * @return {string} the name
 */
export function addName( count, max, noun ) {
	return `Add ${ noun } (${ max ? `${ count } of ${ max }` : countText( count, 0, noun ) })`;
}

/**
 * The strip's size: narrow when the block is under NARROW_BELOW wide (a block in a column), else what the marker
 * asks for ("small" for a list, FAQ or short table), else normal.
 *
 * @param {?string} asked the marker's footerSize
 * @param {number}  width the block's width in px (0: not measured yet)
 * @return {string} one of FOOTER_SIZES
 */
export function footerSizeOf( asked, width ) {
	if ( width > 0 && width < NARROW_BELOW ) {
		return 'narrow';
	}
	return asked === 'small' ? 'small' : 'normal';
}
