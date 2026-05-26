/**
 * Click-to-focus-Inspector helper.
 *
 * Authors of render.php templates can wrap any element with
 *   data-gcblite-focus="<attributeKey>"
 * and the editor will route clicks on that element to the matching
 * Inspector field — open the field's panel, scroll the field into
 * view, and briefly flash it so the eye lands in the right place.
 *
 * The Inspector is a separate React subtree (rendered into WP's
 * sidebar slot) — we can't share React state with the block edit
 * function that owns the preview. So this helper works at the DOM
 * layer: it locates the [data-gcblite-field="<key>"] wrapper that
 * inspector.js already stamps on every field, opens the enclosing
 * PanelBody if it's collapsed, scrolls into view, and adds the
 * .gcblite-field--flash CSS animation class.
 */

/**
 * Open the Inspector panel containing this field, scroll the field
 * into view, and run the flash animation.
 *
 * Modern block editor renders the canvas in an iframe but the
 * Inspector sidebar lives in the parent document. The handler that
 * called us may be running in either context — search both documents
 * for the field so the lookup works whichever frame the caller is in.
 *
 * Safe to call when the field isn't currently mounted — does nothing
 * if no matching element is found.
 */
export function focusInspectorField(attributeKey) {
	if (!attributeKey || typeof document === 'undefined') return;

	const selector = `[data-gcblite-field="${cssEscape(attributeKey)}"]`;
	const target = findIncludingParents(selector);
	if (!target) return;

	// Walk up to the enclosing PanelBody (block-Inspector) or
	// post-fields panel. If it exists and is collapsed, programmatically
	// click its toggle button to open it. PanelBody only respects
	// initialOpen at mount, so this is the only way to open it from the
	// outside that's stable across @wordpress/components releases.
	const panel = target.closest('.components-panel__body');
	if (panel && !panel.classList.contains('is-opened')) {
		const toggle = panel.querySelector(':scope > .components-panel__body-title > .components-panel__body-toggle');
		toggle?.click();
	}

	// Defer the scroll + flash one frame so the panel-open animation
	// has started — otherwise scrollIntoView aims at the collapsed
	// position and the user sees the field land off-screen.
	requestAnimationFrame(() => {
		target.scrollIntoView({ behavior: 'smooth', block: 'center' });
		target.classList.add('gcblite-field--flash');
		setTimeout(() => target.classList.remove('gcblite-field--flash'), 1500);
	});
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
