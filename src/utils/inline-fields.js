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

/**
 * Whether the cursor is in this field: the editor's selection names the block
 * and, for a RichText, its `identifier` — which the canvas swap sets to the
 * field's attribute key. A block with several heading fields shows ONE level
 * switch, the focused field's (Mark, 2026-09-28: "if the component has more
 * than one editable field it doesn't quite work").
 *
 * @param {Object} selection the editor's selection start {clientId, attributeKey}
 * @param {string} clientId  this block
 * @param {string} attrKey   this field
 * @return {boolean} the cursor is in this field
 */
export function isFocusedField( selection, clientId, attrKey ) {
	return (
		!! selection &&
		!! clientId &&
		selection.clientId === clientId &&
		selection.attributeKey === attrKey
	);
}

/**
 * BUTTONS AND LINKS IN PLACE (Mark, 2026-09-28: "next would be the buttons").
 * A link field (`url`, or the older `link`) on an <a> or <button> whose content
 * is words alone: its label is typed on the canvas, and its address and "open
 * in new tab" set from the toolbar. One that wraps an icon or a box keeps the
 * sidebar — typing over it would drop what it wraps.
 *
 * @param {string}  type          field type
 * @param {string}  tag           element tag
 * @param {boolean} wordsOnly     the element holds text and nothing else
 * @return {boolean} edited in place
 */
export function isInlineLink( type, tag, wordsOnly ) {
	return (
		( type === 'url' || type === 'link' ) &&
		[ 'a', 'button' ].includes( String( tag || '' ).toLowerCase() ) &&
		!! wordsOnly
	);
}

/**
 * A link field's stored value, in the link control's shape. It may arrive as
 * a string (an address), an object, or nothing.
 *
 * @param {*} raw
 * @return {{url: string, text: string, opensInNewTab: boolean}} the link
 */
export function linkValue( raw ) {
	if ( typeof raw === 'string' ) {
		return { url: raw, text: '', opensInNewTab: false };
	}
	const o = raw && typeof raw === 'object' ? raw : {};
	return {
		url: typeof o.url === 'string' ? o.url : '',
		text: typeof o.text === 'string' ? o.text : '',
		opensInNewTab: !! o.opensInNewTab,
	};
}

/**
 * The link with a change made, everything else kept.
 *
 * @param {*}      raw    the stored value
 * @param {Object} change {url?, text?, opensInNewTab?}
 * @return {{url: string, text: string, opensInNewTab: boolean}} the new link
 */
export function withLink( raw, change ) {
	const next = { ...linkValue( raw ) };
	for ( const k of [ 'url', 'text', 'opensInNewTab' ] ) {
		if ( change && change[ k ] !== undefined ) {
			next[ k ] =
				k === 'opensInNewTab' ? !! change[ k ] : String( change[ k ] );
		}
	}
	return next;
}

/**
 * IMAGES IN PLACE (Mark, 2026-09-28: "click an image and have the field we
 * have for editing it in that toolbar"). An image field drawn as an <img> is
 * picked by a click on the canvas; the block toolbar then carries the same
 * image field the sidebar shows.
 * @param {string} type the field's type
 * @param {string} tag  the element's tag
 */
export function isInlineImage( type, tag ) {
	return type === 'image' && String( tag || '' ).toLowerCase() === 'img';
}

/**
 * The picture an image field's value shows, or '' when it holds none. The
 * value is the image control's object ({id,url,…}); older values may be a
 * bare id, which only the server can turn into an address.
 * @param {*} raw the stored attribute
 */
export function imageUrl( raw ) {
	return raw && typeof raw === 'object' && typeof raw.url === 'string'
		? raw.url
		: '';
}

const pct = ( n ) => `${ Math.round( n * 10000 ) / 100 }%`;

/**
 * What an image value asks of its <img>, as React style — the canvas shows a
 * focal point or a zoom the moment it is set, the same as the built block
 * prints it (ChildBlockParser's IMGSTYLE): focal point → object-position;
 * zoom (>1, cover only, capped at 3) → scale about the focal point, clipped
 * back to the picture's own box.
 * @param {*} raw the stored attribute
 * @return {Object} style keys, none when nothing is set
 */
export function imageLook( raw ) {
	if ( ! raw || typeof raw !== 'object' ) {
		return {};
	}
	const style = {};
	const fp = raw.focalPoint;
	const has = fp && Number.isFinite( +fp.x ) && Number.isFinite( +fp.y );
	const clamp = ( n ) => Math.max( 0, Math.min( 1, n ) );
	const ox = has ? clamp( +fp.x ) : 0.5;
	const oy = has ? clamp( +fp.y ) : 0.5;
	if ( has ) {
		style.objectPosition = `${ pct( ox ) } ${ pct( oy ) }`;
	}
	const zoom = Math.min( 3, Number( raw.zoom ) || 1 );
	const size = raw.size || 'cover';
	if ( zoom > 1.001 && size === 'cover' ) {
		const k = 1 - 1 / zoom;
		style.transform = `scale(${ Math.round( zoom * 100 ) / 100 })`;
		style.transformOrigin = `${ pct( ox ) } ${ pct( oy ) }`;
		style.clipPath = `inset(${ pct( oy * k ) } ${ pct(
			( 1 - ox ) * k
		) } ${ pct( ( 1 - oy ) * k ) } ${ pct( ox * k ) })`;
	}
	return style;
}
