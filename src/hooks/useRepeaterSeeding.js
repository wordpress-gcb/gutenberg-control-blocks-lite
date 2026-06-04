/**
 * useRepeaterSeeding — seed a repeater block's initial inner blocks.
 *
 * Lives in the STABLE edit component (PHPPreviewEdit, one per clientId), NOT in
 * the <Repeater> React node, which is re-parsed from preview HTML on every
 * refresh — a "seed once" ref there resets constantly and races the remount,
 * which is why defaultChildren silently did nothing before.
 *
 * Seeds `max(defaultChildren, min)` children the first time we see this block
 * with a repeater, zero children, and no author-supplied template. Uses
 * replaceInnerBlocks (one atomic dispatch) rather than a loop of insertBlock,
 * so there's no partial-insert race against the preview re-render.
 */

import { useEffect, useRef } from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';
import { createBlock } from '@wordpress/blocks';

export function useRepeaterSeeding( clientId, config ) {
	const { replaceInnerBlocks } = useDispatch( 'core/block-editor' );
	const childCount = useSelect(
		( select ) =>
			clientId
				? select( 'core/block-editor' ).getBlockOrder( clientId ).length
				: 0,
		[ clientId ]
	);

	// One-shot per block instance. Keyed implicitly by clientId because this
	// hook is called from the stable per-clientId edit component.
	const seededRef = useRef( false );

	useEffect( () => {
		if ( seededRef.current ) {
			return;
		}
		if ( ! clientId || ! config ) {
			return;
		}
		if ( config.hasTemplate ) {
			seededRef.current = true;
			return;
		} // WP seeds templates
		if ( ! config.firstAllowed ) {
			return;
		} // repeater with no concrete child type — nothing to seed
		const seedTarget = Math.max(
			config.defaultChildren || 0,
			config.min || 0
		);
		if ( seedTarget < 1 ) {
			seededRef.current = true;
			return;
		}

		// Only seed a genuinely empty block — never clobber existing children
		// (e.g. when reopening a saved post).
		if ( childCount === 0 ) {
			const blocks = Array.from( { length: seedTarget }, () =>
				createBlock( config.firstAllowed )
			);
			replaceInnerBlocks( clientId, blocks, false );
		}
		seededRef.current = true;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ clientId, config, childCount ] );
}
