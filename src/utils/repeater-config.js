/**
 * Extract a block's <Repeater> configuration from its preview HTML.
 *
 * The editor preview is server-rendered HTML that contains a single
 * `<repeater …>` marker (see parse-preview.js). Both the seeding hook and the
 * min-children validation need that marker's attributes — min, max,
 * defaultChildren, allowedBlocks — at the STABLE edit-component level, where
 * the parsed React tree (which is rebuilt on every preview refresh) can't
 * reliably provide them.
 *
 * So we read them straight off the HTML string with a forgiving regex. A block
 * has at most one repeater, so the first match wins. Returns null when there's
 * no repeater marker in the HTML.
 *
 * HTML attributes are case-insensitive and the renderer lowercases them, so we
 * match case-insensitively and read the lowercased names.
 */

function attr( tag, name ) {
	const m = tag.match(
		new RegExp( `\\b${ name }\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i' )
	);
	return m ? m[ 2 ] : null;
}

function intAttr( tag, name ) {
	const raw = attr( tag, name );
	const n = raw === null ? 0 : parseInt( raw, 10 );
	return Number.isFinite( n ) ? n : 0;
}

export function extractRepeaterConfig( html ) {
	if ( ! html || typeof html !== 'string' ) {
		return null;
	}

	// First <repeater …> opening tag (self-closing or not).
	const tagMatch = html.match( /<repeater\b[^>]*>/i );
	if ( ! tagMatch ) {
		return null;
	}
	const tag = tagMatch[ 0 ];

	let allowedBlocks = null;
	const rawAllowed = attr( tag, 'allowedBlocks' );
	if ( rawAllowed && rawAllowed !== 'all' ) {
		try {
			// Attribute value is HTML-entity-encoded JSON, e.g. ["gcb/x"].
			const decoded = rawAllowed
				.replace( /&quot;/g, '"' )
				.replace( /&#34;/g, '"' )
				.replace( /&apos;/g, "'" )
				.replace( /&#39;/g, "'" )
				.replace( /&amp;/g, '&' );
			const parsed = JSON.parse( decoded );
			if ( Array.isArray( parsed ) ) {
				allowedBlocks = parsed.filter(
					( s ) => typeof s === 'string' && s
				);
			}
		} catch {
			allowedBlocks = null;
		}
	}

	return {
		min: intAttr( tag, 'min' ),
		max: intAttr( tag, 'max' ),
		defaultChildren: intAttr( tag, 'defaultChildren' ),
		allowedBlocks,
		// The block author can pass an explicit template; when present WP seeds
		// it and we leave defaultChildren alone.
		hasTemplate: /\btemplate\s*=/.test( tag ),
		firstAllowed:
			allowedBlocks && allowedBlocks.length ? allowedBlocks[ 0 ] : null,
	};
}
