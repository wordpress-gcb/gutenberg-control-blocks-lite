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
	for ( let page = 1; page < 50; page++ ) {
		// eslint-disable-next-line no-await-in-loop
		const chunk = await apiFetch( {
			path: `/wp/v2/icons?per_page=100&page=${ page }`,
		} );
		if ( ! Array.isArray( chunk ) || chunk.length === 0 ) {
			break;
		}
		all.push( ...chunk );
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
