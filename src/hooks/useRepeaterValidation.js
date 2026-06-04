/**
 * useRepeaterValidation — enforce a repeater's min/max children on save.
 *
 * Responsibilities (kept narrow):
 *   1. On a save attempt, check innerBlocks against min/max.
 *   2. Mirror this block's errors into window.gcbValidationErrors[clientId] AND
 *      the server transient (POST /gcblite/v1/validation-state) — the PHP
 *      rest_pre_insert guard reads that transient and rejects the save.
 *   3. Return the current errors so the edit component can render an inline
 *      banner inside the block (the "which block?" signal).
 *
 * The user-facing notice + scroll-to-block is NOT here — it's an apiFetch
 * middleware (utils/validation-notice.js) that fires off the actual rejected
 * request, so it works in the post editor and the Site Editor alike. Doing it
 * via save-detection here was unreliable in the Site Editor.
 */

import { useEffect, useCallback } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { __, sprintf, _n } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

if ( typeof window !== 'undefined' ) {
	window.gcbValidationErrors = window.gcbValidationErrors || {};
}

export function useRepeaterValidation( clientId, config, blockLabel = '' ) {
	const childCount = useSelect(
		( select ) =>
			clientId
				? select( 'core/block-editor' ).getBlockOrder( clientId ).length
				: 0,
		[ clientId ]
	);
	const postId = useSelect(
		( select ) => select( 'core/editor' )?.getCurrentPostId(),
		[]
	);

	const min = config?.min || 0;
	const max = config?.max || 0;
	// Prefix messages with the block's name so the editor's own save-failure
	// notice reads "<Block> needs at least N items" — useful when several
	// blocks could be at fault. Falls back to a generic "This block".
	const label = blockLabel || __( 'This block', 'gcblite' );

	// Pure compute — errors for the CURRENT child count, derived every render.
	// No save-attempt gating: a block that requires >= min is invalid the
	// moment it drops below it, and we want to know immediately (the earlier
	// "only after a save attempt" approach is what let the very first save
	// slip through before the server transient had been written).
	const computeErrors = useCallback( () => {
		const errors = {};
		if ( min > 0 && childCount < min ) {
			errors._minChildren = sprintf(
				/* translators: 1: block name, 2: required minimum, 3: current count */
				_n(
					'%1$s needs at least %2$d item (has %3$d).',
					'%1$s needs at least %2$d items (has %3$d).',
					min,
					'gcblite'
				),
				label,
				min,
				childCount
			);
		}
		if ( max > 0 && childCount > max ) {
			errors._maxChildren = sprintf(
				/* translators: 1: block name, 2: allowed maximum, 3: current count */
				__( '%1$s allows at most %2$d items (has %3$d).', 'gcblite' ),
				label,
				max,
				childCount
			);
		}
		return errors;
	}, [ min, max, childCount, label ] );

	const errors = computeErrors();
	const hasErrors = Object.keys( errors ).length > 0;
	const errorKey = Object.values( errors ).join( ' ' ); // stable dep

	// Mirror errors into the global registry + server transient CONTINUOUSLY —
	// the instant the child count changes, not only after a save is attempted.
	// This is what closes the first-save race: by the time the user clicks
	// Save, the validation state is already on the server, so the rest_pre_insert
	// guard rejects it on the very first try (earlier we POSTed only after the
	// save had already started, so the first save slipped through).
	//
	// We deliberately do NOT lock the Save button: a silently-disabled Save is
	// confusing (a client opening an old page that a dev later added min/max to
	// wouldn't know why it won't save). Instead the save is allowed to fail and
	// the apiFetch middleware shows a clear notice with a "Find the block"
	// action. Familiar submit-then-see-errors.
	useEffect( () => {
		if ( hasErrors ) {
			window.gcbValidationErrors[ clientId ] = errors;
		} else {
			delete window.gcbValidationErrors[ clientId ];
		}
		if ( ! postId ) {
			return;
		}
		apiFetch( {
			path: '/gcblite/v1/validation-state',
			method: 'POST',
			data: {
				post_id: String( postId ),
				has_errors:
					Object.keys( window.gcbValidationErrors ).length > 0,
				errors: window.gcbValidationErrors,
			},
		} ).catch( () => {} );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ errorKey, clientId, postId ] );

	// Clean up this block's global entry on unmount (block deleted).
	useEffect( () => {
		return () => {
			delete window.gcbValidationErrors[ clientId ];
		};
	}, [ clientId ] );

	// Surfaced so the edit component can render the inline indicator.
	return { errors, hasErrors };
}
