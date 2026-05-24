/**
 * Post-fields meta-box entry.
 *
 * Renders the same gcb-lite control library used by the block Inspector,
 * but mounted into a classic add_meta_box container on the CPT edit screen.
 * Writes back to a hidden input on every change so save_post receives the
 * full values blob.
 *
 * Markup contract (rendered by PostFields\Registrar::render_meta_box):
 *
 *   <div class="gcblite-post-fields-root"
 *        data-config='{"controls":[...]}'
 *        data-values='{"key":"value", ...}'></div>
 *   <input type="hidden" name="gcblite_post_fields_values"
 *          class="gcblite-post-fields-submit" value="..." />
 */

import { createRoot } from '@wordpress/element';
import { useState, useCallback } from '@wordpress/element';
import { SlotFillProvider } from '@wordpress/components';
import { renderInspector } from './inspector';
import './editor.scss';

function MetaBoxApp({ controls, initialValues, submitInput }) {
	const [attributes, setAttributesState] = useState(initialValues);

	const setAttributes = useCallback((patch) => {
		setAttributesState((prev) => {
			const next = { ...prev, ...patch };
			// Mirror into the hidden form field so save_post picks it up.
			submitInput.value = JSON.stringify(next);
			return next;
		});
	}, [submitInput]);

	// renderInspector returns InspectorControls-style children. Outside a
	// block, those PanelBodys still render as plain panels — we wrap in a
	// SlotFillProvider so any control that uses Slots (color picker etc.)
	// has somewhere to render its popovers.
	return (
		<SlotFillProvider>
			<div className="gcblite-post-fields-panels">
				{renderInspector(controls, attributes, setAttributes)}
			</div>
		</SlotFillProvider>
	);
}

function mountAll() {
	const roots = document.querySelectorAll('.gcblite-post-fields-root');
	roots.forEach((root) => {
		if (root.dataset.gcbliteMounted === '1') return;
		root.dataset.gcbliteMounted = '1';

		let config, values;
		try {
			config = JSON.parse(root.dataset.config || '{}');
			values = JSON.parse(root.dataset.values || '{}');
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('gcb-lite post-fields: invalid data attributes', err);
			return;
		}

		// The submit input is the next sibling in the meta-box markup.
		const submitInput = root.parentElement?.querySelector('.gcblite-post-fields-submit');
		if (!submitInput) {
			// eslint-disable-next-line no-console
			console.error('gcb-lite post-fields: submit input not found');
			return;
		}

		const reactRoot = createRoot(root);
		reactRoot.render(
			<MetaBoxApp
				controls={config.controls || []}
				initialValues={values || {}}
				submitInput={submitInput}
			/>
		);
	});
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', mountAll);
} else {
	mountAll();
}
