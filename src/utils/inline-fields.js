/**
 * WHICH FIELDS ARE EDITED IN PLACE, AND HOW (Mark, 2026-09-28: "i can click
 * to change text as long as that text is … a text field. there's no bold, no
 * heading hierarchy to choose from"). Pure rules, no WordPress imports, so
 * they are tested on their own (tests/js/inline-fields.test.js) and used by
 * parse-preview's canvas swap.
 *
 *   text / textarea — plain words, as before (render: esc_html / nl2br)
 *   richtext        — words with bold, italic and links (render: wp_kses_post)
 *
 * A heading field (h1–h6) built by gcb-pro carries a `<key>_level` setting;
 * when the block has it, the toolbar offers H1–H6 and the tag follows it.
 */

/** the field types swapped for an in-place editor */
export const INLINE_TYPES = new Set( [ 'text', 'textarea', 'richtext' ] );

/** the tags a field element may use and still be swapped (lists and the rest keep the sidebar) */
export const INLINE_TAGS = new Set( [
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'p',
	'div',
	'span',
] );

/** a rich-text field's toolbar: the formats wp_kses_post keeps, nothing that changes the design */
export const RICH_FORMATS = [ 'core/bold', 'core/italic', 'core/link' ];

export const HEADING_LEVELS = [ 'h1', 'h2', 'h3', 'h4', 'h5', 'h6' ];

/**
 * @param {string} type field type (data-gcb-field-type)
 * @param {string} tag  element tag
 * @return {boolean} edited in place on the canvas
 */
export function isInlineField( type, tag ) {
	return (
		INLINE_TYPES.has( type ) &&
		INLINE_TAGS.has( String( tag || '' ).toLowerCase() )
	);
}

/**
 * The formats the in-place editor allows for a field type.
 * @param {string} type
 * @return {string[]} the RichText formats allowed
 */
export function formatsFor( type ) {
	return type === 'richtext' ? RICH_FORMATS : [];
}

/**
 * The attribute that holds a heading field's level, when the block has one.
 * @param {string} attrKey  the field's attribute key
 * @param {Array}  controls the block's controls
 * @param {string} tag      the element's tag
 * @return {string} the level attribute key, or '' when there is none
 */
export function levelKeyFor( attrKey, controls, tag ) {
	if ( ! HEADING_LEVELS.includes( String( tag || '' ).toLowerCase() ) ) {
		return '';
	}
	const key = attrKey + '_level';
	return ( controls || [] ).some( ( c ) => c && c.attributeKey === key )
		? key
		: '';
}

/**
 * The tag to draw: the chosen level when it is a heading level, else the drawn tag.
 * @param {string} level
 * @param {string} drawn
 * @return {string} the tag to draw
 */
export function headingTag( level, drawn ) {
	return HEADING_LEVELS.includes( level ) ? level : drawn;
}

/**
 * A rich-text value that is exactly one paragraph, shown and kept as its inside
 * on a line element (h1–h6, p, span): the sidebar editor wraps what it holds
 * in <p>, and a paragraph inside a heading is not HTML. Mirrors gcb-pro's
 * render (ChildBlockParser richinline).
 *
 * @param {string} html
 * @param {string} tag
 * @return {string} the value to edit
 */
export function unwrapParagraph( html, tag ) {
	const value = String( html ?? '' );
	if ( ! /^(h[1-6]|p|span)$/.test( String( tag || '' ).toLowerCase() ) ) {
		return value;
	}
	const m = value.match(
		/^\s*<p(?:\s[^>]*)?>((?:(?!<\/?p[\s>])[\s\S])*)<\/p>\s*$/
	);
	return m ? m[ 1 ] : value;
}
