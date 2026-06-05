/**
 * Post-fields meta-box entry.
 *
 * Renders the same gcb-lite control library used by the block Inspector,
 * but mounted into a classic add_meta_box container on the CPT edit screen.
 * Writes back to a hidden input on every change so save_post receives the
 * full values blob.
 *
 * Validation: when the user clicks WP's Publish/Update button, we intercept
 * the form submit. If any field fails validation, we mark errors, scroll
 * to the first one, and cancel the submit. The server still re-validates
 * on save (and forces draft status if invalid) as the source of truth.
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
import { useState, useCallback, useEffect, useMemo, useRef } from '@wordpress/element';
import { SlotFillProvider } from '@wordpress/components';
import { __, sprintf, _n } from '@wordpress/i18n';
import {
	renderInspector,
	panelsContainingErrors,
	shouldRender,
	ControlContext,
	ValidationContext,
} from '@wordpress-gcb/fields';
import { validateAll } from './validation';
import './editor.scss';
import './post-fields.scss';

function MetaBoxApp({ controls, initialValues, submitInput, rootEl }) {
	const [attributes, setAttributesState] = useState(initialValues);
	const [errors, setErrors] = useState({});
	const [showErrors, setShowErrors] = useState(false);

	// Skip controls that are hidden by conditional logic — a required
	// field the user can't see shouldn't block save.
	const isVisible = useCallback(
		(control) => shouldRender(control, attributes),
		[attributes]
	);

	const liveErrors = useMemo(() => {
		const result = validateAll(controls, attributes, isVisible);
		return result.ok ? {} : result.errors;
	}, [controls, attributes, isVisible]);

	useEffect(() => {
		if (showErrors) setErrors(liveErrors);
	}, [liveErrors, showErrors]);

	// Auto-open any panel containing an errored field so the user can see
	// what's wrong. The Set identity changes on every error update so
	// renderInspector's PanelBody key prop swaps and the panel remounts
	// with the new initialOpen value.
	const forceOpenPanelIds = useMemo(
		() => panelsContainingErrors(controls, errors),
		[controls, errors]
	);

	const setAttributes = useCallback((patch) => {
		setAttributesState((prev) => {
			const next = { ...prev, ...patch };
			submitInput.value = JSON.stringify(next);
			return next;
		});
	}, [submitInput]);

	const scrollToField = (key) => {
		const target = rootEl.querySelector(`[data-gcblite-field="${key}"]`);
		if (!target) return;
		target.scrollIntoView({ behavior: 'smooth', block: 'center' });
		// Briefly flash the field so the user can spot it after the scroll.
		target.classList.add('gcblite-field--flash');
		setTimeout(() => target.classList.remove('gcblite-field--flash'), 1500);
	};

	// Intercept the post-edit form submit (capture phase, so we beat WP's
	// own handlers).
	useEffect(() => {
		const form = document.getElementById('post');
		if (!form) return;

		const handler = (event) => {
			const result = validateAll(controls, attributes, isVisible);
			if (result.ok) return;

			event.preventDefault();
			event.stopImmediatePropagation();
			setErrors(result.errors);
			setShowErrors(true);

			// Defer the scroll so PanelBody force-open + error CSS has
			// rendered before we measure the target's new position.
			requestAnimationFrame(() => {
				const firstInvalidKey = Object.keys(result.errors)[0];
				scrollToField(firstInvalidKey);
			});
		};

		form.addEventListener('submit', handler, true);
		return () => form.removeEventListener('submit', handler, true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [controls, attributes, isVisible, rootEl]);

	const errorEntries = Object.entries(errors);

	return (
		<SlotFillProvider>
			<ControlContext.Provider value={{ variant: 'metabox' }}>
				<ValidationContext.Provider value={{ errors, showErrors }}>
					{showErrors && errorEntries.length > 0 && (
						<ValidationSummary
							controls={controls}
							errors={errorEntries}
							onErrorClick={scrollToField}
						/>
					)}
					<div className="gcblite-post-fields-panels">
						{renderInspector(controls, attributes, setAttributes, {
							flatten: true,
							forceOpenPanelIds,
						})}
					</div>
				</ValidationContext.Provider>
			</ControlContext.Provider>
		</SlotFillProvider>
	);
}

/**
 * WP-standard validation summary: red notice rendered at the top of the
 * meta-box listing each invalid field. Clicking an entry scrolls to that
 * field. Matches the dismissible notice-error pattern WP admin uses for
 * server-rendered errors, so it reads as native admin UI.
 */
function ValidationSummary({ controls, errors, onErrorClick }) {
	// Build a lookup of attributeKey → human label for nicer messages.
	const labelByKey = useMemo(() => {
		const map = {};
		for (const c of controls) {
			if (c.attributeKey) map[c.attributeKey] = c.label || c.attributeKey;
		}
		return map;
	}, [controls]);

	return (
		<div className="notice notice-error gcblite-validation-summary" role="alert" aria-live="polite">
			<p>
				<strong>
					{sprintf(
						/* translators: %d is the number of errors */
						_n(
							'%d field needs attention before this can be published:',
							'%d fields need attention before this can be published:',
							errors.length,
							'gcblite'
						),
						errors.length
					)}
				</strong>
			</p>
			<ul>
				{errors.map(([key, message]) => (
					<li key={key}>
						<a
							href={`#${key}`}
							onClick={(e) => {
								e.preventDefault();
								onErrorClick(key);
							}}
						>
							<strong>{labelByKey[key] || key}:</strong> {message}
						</a>
					</li>
				))}
			</ul>
		</div>
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
				rootEl={root}
			/>
		);
	});
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', mountAll);
} else {
	mountAll();
}
