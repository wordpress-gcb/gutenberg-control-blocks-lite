/**
 * Global save-rejection notice for repeater (and future) block validation.
 *
 * Registers an apiFetch middleware once. When a save is rejected with our
 * server-side `gcblite_validation_error` (RestAPI/ValidationAPI.php), it shows
 * ONE error notice that names the reason and offers a "Find the block" action
 * which selects the offending block and scrolls to its inline
 * #gcblite-error-<clientId> banner (works in the post editor AND the Site
 * Editor, including the canvas iframe).
 *
 * No duplicate: we publish under WordPress's own save-failure notice id
 * ("editor-save"), so our richer notice REPLACES the generic one rather than
 * stacking on top of it. The server-side WP_Error message is intentionally
 * empty (see ValidationAPI), so WP's fallback notice — if it ever wins the
 * race — is just "Updating failed." with no duplicated reason.
 *
 * Editor-agnostic by design: it fires off the actual rejected request, so it
 * doesn't depend on core/editor save-detection (which doesn't surface template
 * saves in the Site Editor).
 */

import apiFetch from '@wordpress/api-fetch';
import { dispatch } from '@wordpress/data';
import { __, sprintf, _n } from '@wordpress/i18n';

// Match WordPress's own save-failure notice id so ours replaces it (one notice).
const NOTICE_ID = 'editor-save';

function findInDocsById( id ) {
	const docs = [ document ];
	document.querySelectorAll( 'iframe' ).forEach( ( f ) => {
		try {
			if ( f.contentDocument ) {
				docs.push( f.contentDocument );
			}
		} catch {
			/* cross-origin */
		}
	} );
	for ( const doc of docs ) {
		const el =
			doc.getElementById( id ) ||
			doc.querySelector( `[data-block="${ id }"]` );
		if ( el ) {
			return el;
		}
	}
	return null;
}

let installed = false;

export function installValidationNotice() {
	if ( installed || ! apiFetch || ! apiFetch.use ) {
		return;
	}
	installed = true;

	apiFetch.use( ( options, next ) =>
		next( options ).catch( ( error ) => {
			if ( ! error || error.code !== 'gcblite_validation_error' ) {
				throw error; // not ours — let WP handle it
			}

			const data = error.data || {};
			const count = data.gcblite_error_count || 1;
			const firstBlock = data.gcblite_first_block || null;
			const reason =
				data.gcblite_reason ||
				__( 'A block needs fixing before saving.', 'gcblite' );

			const { createNotice } = dispatch( 'core/notices' );
			const { selectBlock } = dispatch( 'core/block-editor' );

			// "Updating failed. <reason>" — same shape WP uses, but ours, with an
			// action. Published under editor-save so it's the only save notice.
			const message =
				count > 1
					? sprintf(
							/* translators: %d: number of blocks needing fixes */
							_n(
								'Saving failed. %d block needs fixing.',
								'Saving failed. %d blocks need fixing.',
								count,
								'gcblite'
							),
							count
					  )
					: // translators: %s: the validation reason, e.g. "Hero needs at least 1 item".
					  sprintf( __( 'Saving failed. %s', 'gcblite' ), reason );

			const publish = () =>
				createNotice( 'error', message, {
					id: NOTICE_ID,
					isDismissible: true,
					actions: firstBlock
						? [
								{
									label: __( 'Find the block', 'gcblite' ),
									onClick: () => {
										if ( selectBlock ) {
											selectBlock( firstBlock );
										}
										setTimeout( () => {
											const el =
												findInDocsById(
													`gcblite-error-${ firstBlock }`
												) ||
												findInDocsById( firstBlock );
											if ( el ) {
												el.scrollIntoView( {
													behavior: 'smooth',
													block: 'center',
												} );
											}
										}, 100 );
									},
								},
						  ]
						: [],
				} );

			// WP's own save flow also writes an `editor-save` notice from this
			// same rejection. Our middleware runs first (inside the apiFetch
			// chain), so publish on the next tick to land AFTER WP's — same id,
			// so ours wins and there's exactly one notice (with the action).
			setTimeout( publish, 0 );

			throw error; // re-throw so WP's own failure handling still runs
		} )
	);
}
