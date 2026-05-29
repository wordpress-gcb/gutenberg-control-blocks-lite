/**
 * Render an Inspector panel tree from a block's `gcb.controls` array.
 *
 * Controls are flat in the JSON; structure comes from `parentPanelId` references
 * to `type: "group"` controls. We bucket controls under their group and emit one
 * <PanelBody> per group, plus a default panel for anything ungrouped.
 */

import { PanelBody } from '@wordpress/components';
import { Fragment, useContext } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { controlComponents } from './controls';
import { ValidationContext } from './validation-context';
import {
	STRUCTURAL_TYPES,
	shouldRender,
	panelsContainingErrors,
} from './conditional-logic';

// Re-export so existing callers keep working (post-fields.js imports
// shouldRender + panelsContainingErrors from './inspector').
export { shouldRender, panelsContainingErrors };

/**
 * @param {Array}    controls
 * @param {Object}   attributes
 * @param {Function} setAttributes
 * @param {Object}   [options]
 * @param {boolean}  [options.flatten] When true and no groups exist, render
 *   ungrouped controls flat (no outer "Settings" PanelBody). Used by the
 *   post-fields meta-box where the meta-box itself IS the panel — nesting
 *   another PanelBody would look like a redundant dropdown.
 * @param {Set<string>} [options.forceOpenPanelIds] Panel ids to render
 *   with initialOpen=true. Used by the meta-box to auto-open any panel
 *   containing a field that just failed validation, so the user can see
 *   the offending field.
 */
export function renderInspector(controls, attributes, setAttributes, options = {}) {
	const { groups, ungrouped } = bucketControls(controls);
	const flatten = options.flatten === true && groups.length === 0;
	const forceOpen = options.forceOpenPanelIds || new Set();

	return (
		<Fragment>
			{ungrouped.length > 0 && (
				flatten ? (
					ungrouped.map((control) =>
						renderControl(control, attributes, setAttributes)
					)
				) : (
					<PanelBody title={__('Settings', 'gcblite')} initialOpen={true}>
						{ungrouped.map((control) =>
							renderControl(control, attributes, setAttributes)
						)}
					</PanelBody>
				)
			)}
			{groups.map(({ group, children }) => (
				<PanelBody
					// Remount the panel when its forced-open status changes so
					// the new initialOpen value is honoured. (PanelBody only
					// reads initialOpen on mount.)
					key={`${group.id}:${forceOpen.has(group.id) ? 'open' : 'closed'}`}
					title={group.label}
					initialOpen={forceOpen.has(group.id)}
				>
					{children.map((control) =>
						renderControl(control, attributes, setAttributes)
					)}
				</PanelBody>
			))}
		</Fragment>
	);
}

function bucketControls(controls) {
	const groupsById = new Map();
	const groupOrder = [];
	const ungrouped = [];

	// First pass: register structural controls (group / panel / tools-panel)
	// in declaration order.
	controls.forEach((control) => {
		if (STRUCTURAL_TYPES.has(control.type) && control.id) {
			groupsById.set(control.id, { group: control, children: [] });
			groupOrder.push(control.id);
		}
	});

	// Second pass: assign each non-structural control to a panel or to ungrouped.
	controls.forEach((control) => {
		if (STRUCTURAL_TYPES.has(control.type)) return;

		const parentId = control.parentPanelId;
		if (parentId && groupsById.has(parentId)) {
			groupsById.get(parentId).children.push(control);
		} else {
			ungrouped.push(control);
		}
	});

	return {
		groups: groupOrder.map((id) => groupsById.get(id)),
		ungrouped,
	};
}

function renderControl(control, attributes, setAttributes) {
	if (!shouldRender(control, attributes)) {
		return null;
	}

	const Component = controlComponents[control.type];
	if (!Component) {
		return (
			<div key={control.id} style={{ padding: 8, background: '#fff3cd', border: '1px solid #ffeeba', marginBottom: 8 }}>
				<strong>{control.label}</strong>: unknown control type <code>{control.type}</code>
			</div>
		);
	}

	const value = attributes[control.attributeKey];
	const onChange = (next) => setAttributes({ [control.attributeKey]: next });

	// Wrap each rendered control in a ValidationWrapper that overlays the
	// required `*`, the inline error message, and the data-attribute used
	// by the meta-box submit interceptor to scroll-into-view. The wrapper
	// is invisible in surfaces without validation (sidebar default
	// ValidationContext is { errors:{}, showErrors:false }) so blocks
	// don't see any change.
	return (
		<ValidationWrapper key={control.id} control={control}>
			<Component
				control={control}
				value={value}
				onChange={onChange}
				attributes={attributes}
			/>
		</ValidationWrapper>
	);
}

/**
 * Per-field decorator: stamps data-gcblite-field for scroll-to-error,
 * shows the required asterisk, and surfaces the inline error message
 * once the host has flipped showErrors on.
 */
function ValidationWrapper({ control, children }) {
	const { errors, showErrors } = useContext(ValidationContext);
	const key = control.attributeKey;
	const required = !!control.validation?.required;
	const errorMessage = showErrors && key ? errors[key] : null;

	if (!required && !errorMessage && !key) {
		return children;
	}

	return (
		<div
			data-gcblite-field={key || undefined}
			className={[
				'gcblite-field',
				required ? 'gcblite-field--required' : '',
				errorMessage ? 'gcblite-field--has-error' : '',
			].filter(Boolean).join(' ')}
		>
			{children}
			{errorMessage && (
				<p className="gcblite-field__error" role="alert">{errorMessage}</p>
			)}
		</div>
	);
}

