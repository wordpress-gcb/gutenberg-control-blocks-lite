/**
 * Click-to-focus-Inspector helper.
 *
 * Authors of render.php templates can wrap any element with the
 * focus-field attribute (default: `data-focus-field="<attributeKey>"`)
 * and the editor will route clicks on that element to the matching
 * Inspector field — open the field's panel, scroll the field into
 * view, and briefly flash it so the eye lands in the right place.
 *
 * The attribute name is filterable via PHP's `gcblite_focus_field_attribute`
 * filter for sites that collide with another plugin claiming the same
 * `data-focus-field` name. The runtime value is read from
 * `window.gcbLite.focusFieldAttribute`, defaulting to `data-focus-field`
 * when the global hasn't been localized yet.
 *
 * The Inspector is a separate React subtree (rendered into WP's
 * sidebar slot) — we can't share React state with the block edit
 * function that owns the preview. So this helper works at the DOM
 * layer: it locates the [data-gcblite-field="<key>"] wrapper that
 * inspector.js already stamps on every field, opens the enclosing
 * PanelBody if it's collapsed, scrolls into view, and adds the
 * .gcblite-field--flash CSS animation class.
 */

import { markPanelOpen } from './panelOpenStore';

/**
 * Look up the configured focus-field attribute name. Returns whatever
 * the site localised via window.gcbLite.focusFieldAttribute. Returns
 * an empty string when not set or when set to empty — the click
 * handler treats that as "feature disabled" and skips binding.
 */
export function focusFieldAttribute() {
	const val = typeof window !== 'undefined' && window.gcbLite?.focusFieldAttribute;
	return typeof val === 'string' ? val : '';
}

/**
 * Open the Inspector sidebar (if closed), make sure the Block tab is
 * active, open the panel containing the target field, then scroll the
 * field into view and flash it.
 *
 * Why we can't just walk the DOM and click toggles: a collapsed
 * PanelBody renders an empty body — its children DON'T mount until
 * the panel opens. So the field with [data-gcblite-field="..."] doesn't
 * exist in the DOM at all yet. We have to ask React to mount it.
 *
 * Flow:
 *   1. Compute which group/panel the field belongs to from the block's
 *      registered controls (window.gcbLite.blocks[name].controls).
 *   2. Push that group id into the panelOpenStore for this clientId.
 *      The Inspector subtree subscribes; pushing makes its PanelBody
 *      remount with initialOpen=true.
 *   3. Open the sidebar via wp.data so we know it's visible.
 *   4. Poll the DOM for the field — once the PanelBody opens and
 *      mounts its children, the wrapper element appears.
 *   5. Scroll the field into view and flash it.
 */
export function focusInspectorField(attributeKey, { clientId, blockName } = {}) {
	if (!attributeKey || typeof document === 'undefined') return;

	// 1. Resolve which panel the field lives in (if any) from the
	//    block's static control config. Fields registered without a
	//    parentPanelId are ungrouped — those mount inside the default
	//    "Settings" panel, which is already open by default.
	const groupId = panelIdForField(blockName, attributeKey);
	if (groupId && clientId) {
		markPanelOpen(clientId, groupId);
	}

	// 2. Open the sidebar + switch to the Block tab. Best-effort —
	//    works in post editor + site editor.
	openInspectorSidebar();

	const selector = `[data-gcblite-field="${cssEscape(attributeKey)}"]`;

	// 3. Poll for the field. The combined sidebar-open + tab-switch +
	//    panel-mount chain is async; we give it ~600ms before giving up.
	let attempts = 0;
	const tick = () => {
		const target = findIncludingParents(selector);
		if (target) {
			openContainingPanel(target);
			requestAnimationFrame(() => flashField(target));
			return;
		}
		if (attempts++ < 12) {
			setTimeout(tick, 50);
		}
	};
	tick();
}

/**
 * Look up which panel/group a given attributeKey belongs to, by reading
 * the block's registered controls off the window.gcbLite namespace.
 * Returns null when the block / field / parentPanelId isn't found —
 * caller treats null as "ungrouped, no panel to open".
 */
function panelIdForField(blockName, attributeKey) {
	if (!blockName || !attributeKey) return null;
	const cfg = (typeof window !== 'undefined' && window.gcbLite?.blocks?.[blockName]) || null;
	if (!cfg?.controls) return null;
	const control = cfg.controls.find((c) => c.attributeKey === attributeKey);
	return control?.parentPanelId || null;
}

/**
 * Open the Inspector sidebar if it isn't already, and make sure the
 * Block-level tab (not the Document tab) is active.
 *
 * `core/edit-post` covers the post editor; `core/edit-site` covers the
 * site editor. We try both. The store may be missing on screens that
 * don't have a sidebar concept (widgets screen historically) — that's
 * fine, the rest of the focus flow still works on whatever DOM exists.
 */
function openInspectorSidebar() {
	const wp = typeof window !== 'undefined' ? window.wp : null;
	if (!wp?.data) return;

	const editPost = wp.data.dispatch?.('core/edit-post');
	const editSite = wp.data.dispatch?.('core/edit-site');
	const editor   = wp.data.dispatch?.('core/editor');

	// openGeneralSidebar('edit-post/block') is what WP itself calls when
	// the author clicks the cog in the toolbar. Same name in both
	// edit-post and edit-site historically.
	editPost?.openGeneralSidebar?.('edit-post/block');
	editSite?.openGeneralSidebar?.('edit-site/block-inspector');

	// In recent WP versions the Block-tab vs Document-tab pivot moved
	// to `core/editor` as setActiveTab. Best-effort — newer API only.
	editor?.setActiveTab?.('block');
}

/**
 * Walk up from the field wrapper to every enclosing PanelBody and
 * open any that are currently collapsed.
 *
 * Detection: the PanelBody's toggle button has aria-expanded="true"
 * when open, "false" when closed. That's stable across @wordpress/
 * components versions; the `.is-opened` class on the parent isn't
 * always present (open-by-default panels don't get the class until
 * the user toggles them).
 *
 * Each iteration up the chain: find the FIRST toggle button under the
 * panel root (the deepest panel's toggle would also match a query
 * scoped to a parent panel, so we have to walk strictly upward by
 * stepping out of the current panel before searching again).
 */
function openContainingPanel(target) {
	const opened = new Set();
	let cursor = target;
	while (cursor) {
		const panel = cursor.closest('.components-panel__body');
		if (!panel || opened.has(panel)) break;
		opened.add(panel);

		// The PanelBody renders as:
		//   <div class="components-panel__body">
		//     <h2 class="components-panel__body-title">
		//       <button class="components-panel__body-toggle" aria-expanded="...">
		// Find the FIRST descendant toggle (the one belonging to this
		// panel — descendants from nested panels come later in DOM order).
		const toggle = panel.querySelector('.components-panel__body-toggle');
		if (toggle && toggle.getAttribute('aria-expanded') === 'false') {
			toggle.click();
		}

		// Step out of this panel before searching upward so closest()
		// finds the next ancestor, not the same one.
		cursor = panel.parentElement;
	}
}

/**
 * Track the currently-armed field so a second focus call can disarm
 * the previous one (only one field is "look-here" at a time).
 */
let armedField = null;
const dismissedDocs = new WeakSet();

/**
 * Scroll the field into view, play a short blue flash animation, then
 * leave a persistent armed ring on it until the user engages with the
 * field (clicks inside it) or clicks anywhere else.
 *
 * Two-stage highlight:
 *   1. `.gcblite-field--flash` runs the keyframe sweep for ~1.4s so
 *      the field draws the eye after the scroll lands.
 *   2. `.gcblite-field--armed` stays on indefinitely as a static ring,
 *      removed by the dismiss listener below.
 *
 * Re-arming behaviour: focusing field B while field A is armed
 * disarms A first, so the ring never lingers on a stale field.
 */
function flashField(target) {
	target.scrollIntoView({ behavior: 'smooth', block: 'center' });

	// Disarm any previously-armed field.
	if (armedField && armedField !== target) {
		armedField.classList.remove('gcblite-field--armed');
		armedField.classList.remove('gcblite-field--flash');
	}
	armedField = target;

	// Restart the flash animation cleanly.
	target.classList.remove('gcblite-field--flash');
	void target.offsetWidth; // Force reflow so the add-back animates.
	target.classList.add('gcblite-field--flash');
	target.classList.add('gcblite-field--armed');
	setTimeout(() => target.classList.remove('gcblite-field--flash'), 1500);

	// Install dismiss listeners on the doc that hosts the field
	// (Inspector parent doc) AND on any iframe docs that contain a gcb
	// canvas (so a click back in the editor canvas also dismisses).
	installDismissListener(target.ownerDocument);
	if (typeof document !== 'undefined' && document !== target.ownerDocument) {
		installDismissListener(document);
	}
}

/**
 * Register a click listener on the document that hosts the Inspector
 * so any subsequent click disarms the current ring. Bubble-phase (not
 * capture) so it runs AFTER the click that triggered the focus has
 * finished its own work — otherwise the triggering click would also
 * disarm the field it just armed.
 *
 * The listener stays installed for the document's lifetime; we use a
 * WeakSet to make sure we only add it once per document. Because the
 * armed field may live in a different document than the click event
 * (canvas iframe vs. Inspector parent doc), we install on both the
 * Inspector doc AND the canvas doc the user might click in.
 *
 * Dismiss rules:
 *   - Click inside the armed field → disarm (user is engaging)
 *   - Click anywhere else          → disarm (user moved on)
 * Either way the ring goes away. Focusing a different field re-arms
 * via flashField() above.
 */
function installDismissListener(doc) {
	if (!doc || dismissedDocs.has(doc)) return;
	dismissedDocs.add(doc);
	doc.addEventListener('click', () => {
		if (!armedField) return;
		armedField.classList.remove('gcblite-field--armed');
		armedField.classList.remove('gcblite-field--flash');
		armedField = null;
	}, false);
}

/**
 * Find an element matching `selector` in the current document or any
 * ancestor browsing context. Walks window.parent → top, stopping when
 * cross-origin throws (won't happen on wp-admin but defensive).
 */
function findIncludingParents(selector) {
	const seen = new Set();
	let win = typeof window !== 'undefined' ? window : null;
	while (win && !seen.has(win)) {
		seen.add(win);
		try {
			const hit = win.document.querySelector(selector);
			if (hit) return hit;
		} catch {
			// Cross-origin — give up walking further up.
			return null;
		}
		if (win.parent && win.parent !== win) {
			win = win.parent;
		} else {
			win = null;
		}
	}
	return null;
}

/**
 * Minimal CSS.escape polyfill — attribute selectors with quotes need
 * the value escaped. attributeKey is author-controlled (theme JSON),
 * so quoting on the cheap is enough for any reasonable key shape.
 */
function cssEscape(str) {
	if (typeof window !== 'undefined' && window.CSS?.escape) {
		return window.CSS.escape(str);
	}
	return String(str).replace(/(["\\])/g, '\\$1');
}
