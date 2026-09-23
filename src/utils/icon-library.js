/**
 * Icon-registry access for native block edits (icon-list et al.).
 *
 * Mirrors the fields-sdk icon control's fetch: /wp/v2/icons returns the
 * whole registry (name/label/content, WP 7.1 adds collection), cached at
 * module level so any number of icon-list items share one request.
 */

import { useState, useEffect } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';

let iconCache = null;
let iconFetchPromise = null;

async function fetchAllIconPages() {
	const all = [];
	const seen = new Set();
	for ( let page = 1; page < 50; page++ ) {
		// eslint-disable-next-line no-await-in-loop
		const chunk = await apiFetch( {
			path: `/wp/v2/icons?per_page=100&page=${ page }`,
		} );
		if ( ! Array.isArray( chunk ) || chunk.length === 0 ) {
			break;
		}
		/* THE ENDPOINT DOES NOT PAGINATE (2026-09-23). `/wp/v2/icons` ignores
		   `page` and returns the WHOLE registry every time — measured on a real
		   editor: 232 icons, and pages 1, 2 and 3 all came back 232 long with
		   the same first entry. The loop's only exit was a SHORT chunk, so a
		   registry that is an exact multiple of 100, or simply bigger than it,
		   never produced one: fifteen identical round trips before the count
		   happened to break the run, every one of them re-sending the same
		   232 icons and their svg source. A page we have already seen is the
		   end of the list. */
		const fresh = chunk.filter( ( i ) => i && ! seen.has( i.name ) );
		fresh.forEach( ( i ) => seen.add( i.name ) );
		if ( ! fresh.length ) {
			break;
		}
		all.push( ...fresh );
		if ( chunk.length < 100 ) {
			break;
		}
	}
	return all;
}

export function fetchIcons() {
	if ( iconCache ) {
		return Promise.resolve( iconCache );
	}
	if ( ! iconFetchPromise ) {
		iconFetchPromise = fetchAllIconPages()
			.then( ( items ) => {
				iconCache = items;
				return items;
			} )
			.catch( ( err ) => {
				iconFetchPromise = null;
				throw err;
			} );
	}
	return iconFetchPromise;
}

/**
 * The registry entry ({ name, label, content }) for a namespaced icon
 * name, or null while loading / when unregistered.
 *
 * @param {string} name e.g. 'core/check'
 */
export function useIcon( name ) {
	const [ icon, setIcon ] = useState(
		() => iconCache?.find( ( i ) => i.name === name ) || null
	);
	useEffect( () => {
		let alive = true;
		if ( ! name ) {
			setIcon( null );
			return undefined;
		}
		fetchIcons()
			.then( ( items ) => {
				if ( alive ) {
					setIcon( items.find( ( i ) => i.name === name ) || null );
				}
			} )
			.catch( () => {
				if ( alive ) {
					setIcon( null );
				}
			} );
		return () => {
			alive = false;
		};
	}, [ name ] );
	return icon;
}

/**
 * Registry SVG content, inline. Trusted server-side source (the registry
 * sanitizes with wp_kses on registration) — same trust call as render.php.
 *
 * @param {Object} props
 * @param {string} props.content   svg markup
 * @param {string} props.className
 */
export function IconSvg( { content, className } ) {
	return (
		<span
			className={ className }
			dangerouslySetInnerHTML={ { __html: content } }
		/>
	);
}
