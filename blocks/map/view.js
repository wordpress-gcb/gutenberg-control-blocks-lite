/**
 * Map view — front-end initializer for gcb/map (and any AI-built element
 * carrying data-gcb-field-type="google-map"). Reads the location + Cloud
 * Map ID off the container's data-* attrs and draws a REAL google.maps.Map
 * with a Marker. Styling is the Map ID (Google's Cloud-based styling —
 * the JSON-array styling it replaces is deprecated + mutually exclusive).
 *
 * No React, no framework — a plain scan-and-init, guarded against the
 * block editor (where a second map instance would fight the editor's own).
 * The Google Maps script is enqueued by KitBlocks (public side, gated on
 * the API key) with loading=async + callback=gcbMapInit; this file defines
 * that global callback and also self-runs if google.maps is already there.
 */
( function () {
	// Don't run inside the block editor — the editor renders its own map.
	function inEditor() {
		return (
			typeof window !== 'undefined' &&
			window.wp &&
			window.wp.blockEditor
		);
	}

	function initOne( el ) {
		if ( el._gcbMapDone ) {
			return;
		}
		const lat = parseFloat( el.getAttribute( 'data-map-lat' ) );
		const lng = parseFloat( el.getAttribute( 'data-map-lng' ) );
		if ( ! isFinite( lat ) || ! isFinite( lng ) ) {
			return;
		}
		const zoom = parseInt( el.getAttribute( 'data-map-zoom' ), 10 ) || 12;
		// Cloud Map ID = the style. A Map ID makes the map a VECTOR map that
		// Google styles server-side; empty → the account's default map.
		const mapId = el.getAttribute( 'data-map-id' ) || undefined;
		// The canvas is an inner element on the standalone block; the AI
		// element IS the container. Draw into the canvas if present.
		const canvas = el.querySelector( '.gcb-map__canvas' ) || el;
		el._gcbMapDone = true;
		// eslint-disable-next-line no-undef
		const map = new google.maps.Map( canvas, {
			center: { lat, lng },
			zoom,
			mapId,
			disableDefaultUI: false,
		} );
		// eslint-disable-next-line no-undef
		new google.maps.Marker( {
			position: { lat, lng },
			map,
			title: el.getAttribute( 'data-map-address' ) || '',
		} );
	}

	function initAll() {
		if ( inEditor() ) {
			return;
		}
		if (
			typeof google === 'undefined' ||
			! google.maps ||
			! google.maps.Map
		) {
			return; // the async loader hasn't fired yet — the callback will
		}
		const nodes = document.querySelectorAll(
			'.gcb-map[data-map-lat], [data-gcb-field-type="google-map"][data-map-lat]'
		);
		nodes.forEach( initOne );
	}

	// Google's async loader invokes this global when the API is ready.
	window.gcbMapInit = initAll;

	// If the API was already loaded (cached / another block), run now.
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initAll );
	} else {
		initAll();
	}
} )();
