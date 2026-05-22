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

export function usePHPPreview({ blockName, attributes, clientId }) {
	const [html, setHtml] = useState('');
	const [wrapperAttributes, setWrapperAttributes] = useState({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	// Stable serialisation — useEffect by reference would re-fire on every
	// render even when the values are equal.
	const attrsKey = JSON.stringify(attributes);

	// Each hook instance needs a stable id even before WP assigns a clientId
	// (rare, but happens during the very first render of a freshly-inserted
	// block). The id only has to be unique within this page session.
	const fallbackId = useRef(`gcblite-${Math.random().toString(36).slice(2)}`);
	const id = clientId || fallbackId.current;

	// Note: we intentionally do NOT pass innerBlocks to the render endpoint.
	// Editor preview should render the parent's shell + a <repeater> marker
	// only; gcb-lite's parse-preview.js swaps that marker for a real
	// InnerBlocks UI, and WP itself owns the inner-block tree from there.
	// Each child block then renders its own preview separately via this
	// same hook. (Mirrors the full plugin's behaviour — see
	// BlockBuilderAPI.php:1666 in the reference plugin.)
	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);

		batchRenderCoordinator
			.requestRender(id, blockName, attributes)
			.then((result) => {
				if (cancelled) return;
				setHtml(result.html || '');
				setWrapperAttributes(result.wrapperAttributes || {});
				setLoading(false);
			})
			.catch((err) => {
				if (cancelled) return;
				// "superseded" means a newer requestRender for the same
				// clientId replaced this one — not an error to surface.
				if (err && err.message === 'superseded') return;
				setError(err?.message || 'Preview render failed');
				setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [blockName, attrsKey, id]);

	return { html, wrapperAttributes, loading, error };
}
