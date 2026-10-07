/**
 * THE EDITOR BRIDGE — the small, stable surface a block's own editor overlay
 * is written against (TODO.md, "Extension points" 4). A GCB block's preview is
 * server-rendered and knows nothing of its children; an overlay that draws on
 * it (Touchpoint Zoom's pins) had to know wp.data subscriptions, the editor's
 * canvas iframe, when a preview refresh replaced its HTML, and how to batch all
 * that. This does those once:
 *
 *   window.gcbLiteEditor.overlay( 'gcb/touchpoint-zoom', ( ctx ) => {
 *       // ctx.element — the block on the canvas; ctx.block, ctx.children — from
 *       // the store; ctx.selectedId; ctx.select( id ); ctx.update( id, attrs );
 *       // ctx.doc — the canvas document; ctx.rerender() — ask for another pass
 *   } );
 *
 * The render runs for every instance of the block on the canvas — on load, and
 * again whenever its attributes, its children's attributes or the selection
 * change, or its preview is re-rendered. Runs are batched to one per frame.
 * Write it to be idempotent: clear what it drew last time, draw again.
 *
 * Ship it as the block's own editor script — `"editorScript": "file:./editor.js"`
 * in block.json — which GCB loads after this bundle (BlockLoader::tune_assets).
 * No build step: plain JS against this object.
 */
import { select, dispatch, subscribe } from '@wordpress/data';

/** The editor canvas's document (the iframe), or this one when it isn't iframed. */
function canvas() {
	const frame = document.querySelector( 'iframe[name="editor-canvas"]' );
	return ( frame && frame.contentDocument ) || document;
}

function createBridge() {
	const overlays = []; // { name, render, seen: Map<clientId, signature> }
	let queued = false;
	let forced = new Set(); // clientIds whose preview re-rendered

	function contextFor( clientId, render ) {
		const be = select( 'core/block-editor' );
		const doc = canvas();
		return {
			clientId,
			doc,
			element: doc.getElementById( 'block-' + clientId ),
			block: be.getBlock( clientId ),
			children: be.getBlocks( clientId ),
			selectedId: be.getSelectedBlockClientId(),
			select: ( id ) => dispatch( 'core/block-editor' ).selectBlock( id ),
			update: ( id, attrs ) => dispatch( 'core/block-editor' ).updateBlockAttributes( id, attrs ),
			rerender: () => {
				forced.add( clientId );
				schedule();
			},
			_render: render,
		};
	}

	/** What a block's overlay depends on — if this is unchanged and its preview wasn't redrawn, skip. */
	function signatureOf( clientId ) {
		const be = select( 'core/block-editor' );
		const block = be.getBlock( clientId );
		if ( ! block ) {
			return '';
		}
		return JSON.stringify( [
			block.attributes,
			be.getBlocks( clientId ).map( ( c ) => [ c.clientId, c.name, c.attributes ] ),
			be.getSelectedBlockClientId(),
		] );
	}

	function run() {
		queued = false;
		const be = select( 'core/block-editor' );
		const redrawn = forced;
		forced = new Set();
		overlays.forEach( ( { name, render, seen } ) => {
			const ids = be.getBlocksByName ? be.getBlocksByName( name ) : [];
			ids.forEach( ( id ) => {
				// Per overlay: two overlays on one block type each draw (the first
				// recording the block as seen must not skip the second).
				const sig = signatureOf( id );
				if ( seen.get( id ) === sig && ! redrawn.has( id ) ) {
					return;
				}
				const ctx = contextFor( id, render );
				if ( ! ctx.element ) {
					return; // not on the canvas yet; its preview-rendered signal will bring it back
				}
				seen.set( id, sig );
				try {
					render( ctx );
				} catch ( err ) {
					// eslint-disable-next-line no-console
					console.error( '[gcbLiteEditor] overlay for ' + name + ' threw', err );
				}
			} );
		} );
	}

	function schedule() {
		if ( queued ) {
			return;
		}
		queued = true;
		// Next frame — or shortly, where frames don't come (a background tab):
		// whichever is first runs; the other finds nothing queued.
		const once = () => queued && run();
		if ( window.requestAnimationFrame ) {
			window.requestAnimationFrame( once );
		}
		setTimeout( once, 120 );
	}

	let unsubscribe = null;
	function start() {
		if ( unsubscribe ) {
			return;
		}
		unsubscribe = subscribe( schedule );
		// A block's preview HTML was replaced (usePHPPreview): its overlay must redraw.
		window.addEventListener( 'gcblite:preview-rendered', ( e ) => {
			if ( e.detail && e.detail.clientId ) {
				// …and its ancestors': an overlay may read its children's previews
				// (Touchpoint Zoom copies each card's rendered icon onto its pin).
				forced.add( e.detail.clientId );
				select( 'core/block-editor' ).getBlockParents( e.detail.clientId ).forEach( ( id ) => forced.add( id ) );
				schedule();
			}
		} );
	}

	return {
		/**
		 * Draw on every instance of a block on the canvas, and keep it drawn.
		 * @param {string}   name   block name, e.g. 'gcb/touchpoint-zoom'
		 * @param {Function} render ( ctx ) => void — idempotent
		 * @return {Function} stop
		 */
		overlay( name, render ) {
			if ( typeof name !== 'string' || typeof render !== 'function' ) {
				return () => {};
			}
			const entry = { name, render, seen: new Map() };
			overlays.push( entry );
			start();
			schedule();
			return () => {
				const i = overlays.indexOf( entry );
				if ( i !== -1 ) {
					overlays.splice( i, 1 );
				}
			};
		},
		/** The canvas document — for an overlay that needs it outside a render. */
		canvas,
		/** The bridge's version: overlays can check for what they need. */
		version: 1,
	};
}

/** One bridge per page, on window.gcbLiteEditor. */
export function installEditorBridge() {
	if ( typeof window === 'undefined' || window.gcbLiteEditor ) {
		return window.gcbLiteEditor;
	}
	window.gcbLiteEditor = createBridge();
	return window.gcbLiteEditor;
}
