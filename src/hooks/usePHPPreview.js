/**
 * usePHPPreview — fetches a block's rendered HTML via REST as attributes
 * change. The plugin decides whether render.php runs locally or whether the
 * component server is hit; from the editor's perspective both paths look
 * identical: HTML in, HTML out.
 *
 * Requests are funnelled through a singleton batch coordinator so a page with
 * N blocks fires one batched REST call, not N parallel ones.
 *
 * Editor / frontend 1:1 parity holds either way — whatever the renderer
 * produces is what the editor displays. Tags like <Repeater> and <InnerBlocks>
 * are then swapped for live React components by parsePreview.
 */

import { useState, useEffect, useRef } from '@wordpress/element';
import batchRenderCoordinator from '../utils/batch-render-coordinator';
import { inlineFieldKeys, inlineRowFields } from '../utils/parse-preview';
import { maskRowFields } from '../utils/inline-fields';

export function usePHPPreview( { blockName, attributes, clientId, context } ) {
	const [ html, setHtml ] = useState( '' );
	const [ wrapperAttributes, setWrapperAttributes ] = useState( {} );
	const [ loading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );

	// Stable serialisation — useEffect by reference would re-fire on every
	// render even when the values are equal. EDITOR-ONLY attributes (editLayout —
	// how a repeater's children are arranged for editing) do NOT change the SSR
	// HTML, so they must NOT be in the fetch key: changing the layout would
	// otherwise pointlessly re-fetch + remount the preview, flickering the
	// arrangement back to default. The arrangement is applied client-side in
	// RepeaterTag from the live block attribute.
	const { editLayout, ...allAttrs } = attributes || {};
	/* a repeater row's in-place words, masked the same way, row by row (inline-fields.js maskRowFields) */
	const renderAttrs = maskRowFields( allAttrs, inlineRowFields( html ) );

	/* THE KEY MUST NOT DEPEND ON THE HTML THE KEY FETCHES (2026-09-23, Mark on
	   mx11-pricetoggle: "when you add a featured badge ... the list disappears
	   and it starts flashing").

	   These keys come OUT of the fetch key and are read off the html the fetch
	   puts IN, so a key present in one render and absent from the next flips
	   the fetch key back and forth and the effect below refetches for ever. An
	   OPTIONAL field does exactly that: `featured_badge` is in the rendered
	   html only WHEN IT HAS A VALUE, so its own value decides whether it is
	   excluded from the key that fetches it. Nothing settles; the block flashes.

	   Dropping the text is right — RichText owns it, and refetching per
	   keystroke would re-parse the tree under the caret. But the SERVER still
	   has to know whether an optional field is EMPTY, because that is what
	   decides whether its wrapper renders at all. Excluding the key outright
	   answers "always empty" and the badge never comes back.

	   So the text is replaced by whether there IS text. The fetch key changes
	   when a field goes empty↔filled (which genuinely changes the html) and not
	   as it is typed in (which does not), and it no longer depends on the html
	   it fetched. */
	for ( const k of inlineFieldKeys( html ) ) {
		if ( k in renderAttrs ) {
			renderAttrs[ k ] = renderAttrs[ k ] ? ' ' : '';
		}
	}
	const attrsKey = JSON.stringify( renderAttrs );
	/* the block's context (its place among its siblings, a parent's providesContext) — only what it uses, so a block
	   that doesn't ask is not re-rendered when its siblings move */
	const contextKey = context && Object.keys( context ).length ? JSON.stringify( context ) : '';

	// Each hook instance needs a stable id even before WP assigns a clientId
	// (rare, but happens during the very first render of a freshly-inserted
	// block). The id only has to be unique within this page session.
	const fallbackId = useRef(
		`gcblite-${ Math.random().toString( 36 ).slice( 2 ) }`
	);
	const id = clientId || fallbackId.current;

	// Note: we intentionally do NOT pass innerBlocks to the render endpoint.
	// Editor preview should render the parent's shell + a <repeater> marker
	// only; gcb-lite's parse-preview.js swaps that marker for a real
	// InnerBlocks UI, and WP itself owns the inner-block tree from there.
	// Each child block then renders its own preview separately via this
	// same hook. (Mirrors the full plugin's behaviour — see
	// BlockBuilderAPI.php:1666 in the reference plugin.)
	useEffect( () => {
		let cancelled = false;
		setLoading( true );
		setError( null );

		batchRenderCoordinator
			.requestRender( id, blockName, renderAttrs, contextKey ? JSON.parse( contextKey ) : null )
			.then( ( result ) => {
				if ( cancelled ) {
					return;
				}
				setHtml( result.html || '' );
				setWrapperAttributes( result.wrapperAttributes || {} );
				setLoading( false );
			} )
			.catch( ( err ) => {
				if ( cancelled ) {
					return;
				}
				// "superseded" means a newer requestRender for the same
				// clientId replaced this one — not an error to surface.
				if ( err && err.message === 'superseded' ) {
					return;
				}
				setError( err?.message || 'Preview render failed' );
				setLoading( false );
			} );

		return () => {
			cancelled = true;
		};
	}, [ blockName, attrsKey, contextKey, id ] );

	/* Tell the editor bridge this block's preview HTML is new on the canvas, so an
	   overlay drawn on it (window.gcbLiteEditor.overlay) draws again. After paint:
	   the bridge reads the DOM the new HTML produced. */
	useEffect( () => {
		if ( ! html || ! clientId || typeof window === 'undefined' ) {
			return;
		}
		// Next frame, or shortly where frames don't come (a background tab) — once.
		let sent = false;
		const send = () => {
			if ( ! sent ) {
				sent = true;
				window.dispatchEvent( new window.CustomEvent( 'gcblite:preview-rendered', { detail: { clientId, blockName } } ) );
			}
		};
		if ( window.requestAnimationFrame ) {
			window.requestAnimationFrame( send );
		}
		const t = setTimeout( send, 120 );
		return () => clearTimeout( t );
	}, [ html, clientId, blockName ] );

	return { html, wrapperAttributes, loading, error };
}
