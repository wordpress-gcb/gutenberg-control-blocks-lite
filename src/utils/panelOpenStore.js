/**
 * Tiny pub/sub store for "which panels should be force-opened per block".
 *
 * Why this exists: the click-to-focus affordance fires in
 * PHPPreviewEdit (the canvas-side preview) but the panels are owned by
 * the InspectorControls inside withGCBLiteInspector (a separate React
 * subtree). They share a clientId but not React state.
 *
 * We don't want to thread context through both subtrees just for this —
 * the click is a one-shot signal, not part of the block's data. A
 * module-level Map keyed by clientId plus a useSyncExternalStore on
 * the Inspector side gives us a clean signal without a re-architecture.
 *
 * Each entry is a Set of group ids that should currently be open. The
 * focusField helper adds an id when it wants a panel open; the
 * Inspector's PanelBody remounts (via its key) and obeys initialOpen.
 */

import { useSyncExternalStore } from '@wordpress/element';

const state = new Map();        // clientId → Set<groupId>
const listeners = new Map();    // clientId → Set<listener>

function getOrCreate(clientId) {
	if (!state.has(clientId)) state.set(clientId, new Set());
	return state.get(clientId);
}

function notify(clientId) {
	listeners.get(clientId)?.forEach((fn) => fn());
}

/**
 * Mark a panel as force-open for a given block. Returns immediately;
 * the Inspector subscribed to the same clientId will re-render with
 * the panel mounted open.
 */
export function markPanelOpen(clientId, groupId) {
	if (!clientId || !groupId) return;
	const set = getOrCreate(clientId);
	if (set.has(groupId)) return;
	// Replace the Set entirely (new identity) so React notices the change.
	const next = new Set(set);
	next.add(groupId);
	state.set(clientId, next);
	notify(clientId);
}

/**
 * Hook for the Inspector subtree. Returns the current Set of force-
 * open group ids for this block. Re-renders the component on change.
 */
export function useForceOpenPanelIds(clientId) {
	return useSyncExternalStore(
		(cb) => {
			if (!clientId) return () => {};
			if (!listeners.has(clientId)) listeners.set(clientId, new Set());
			listeners.get(clientId).add(cb);
			return () => listeners.get(clientId).delete(cb);
		},
		() => (clientId ? getOrCreate(clientId) : EMPTY),
		() => EMPTY,
	);
}

const EMPTY = new Set();
