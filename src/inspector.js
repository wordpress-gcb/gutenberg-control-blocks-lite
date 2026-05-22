/**
 * Render an Inspector panel tree from a block's `gcb.controls` array.
 *
 * Controls are flat in the JSON; structure comes from `parentPanelId` references
 * to `type: "group"` controls. We bucket controls under their group and emit one
 * <PanelBody> per group, plus a default panel for anything ungrouped.
 */

import { PanelBody } from '@wordpress/components';
import { Fragment } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { controlComponents } from './controls';

export function renderInspector(controls, attributes, setAttributes) {
	const { groups, ungrouped } = bucketControls(controls);

	return (
		<Fragment>
			{ungrouped.length > 0 && (
				<PanelBody title={__('Settings', 'gcblite')} initialOpen={true}>
					{ungrouped.map((control) =>
						renderControl(control, attributes, setAttributes)
					)}
				</PanelBody>
			)}
			{groups.map(({ group, children }) => (
				<PanelBody
					key={group.id}
					title={group.label}
					initialOpen={false}
				>
					{children.map((control) =>
						renderControl(control, attributes, setAttributes)
					)}
				</PanelBody>
			))}
		</Fragment>
	);
}

// Control types that render as Inspector panel headers (no attribute, just a container).
const STRUCTURAL_TYPES = new Set(['group', 'panel', 'tools-panel']);

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
		// Unknown type — render a debug breadcrumb in the editor so the author sees it.
		return (
			<div key={control.id} style={{ padding: 8, background: '#fff3cd', border: '1px solid #ffeeba', marginBottom: 8 }}>
				<strong>{control.label}</strong>: unknown control type <code>{control.type}</code>
			</div>
		);
	}

	const value = attributes[control.attributeKey];
	const onChange = (next) => setAttributes({ [control.attributeKey]: next });

	return (
		<Component
			key={control.id}
			control={control}
			value={value}
			onChange={onChange}
			attributes={attributes}
		/>
	);
}

/**
 * Conditional logic: hide a control when its rules don't pass.
 * Minimal MVP — supports `==`, `!=`, `in`, `contains` over sibling attribute values.
 */
function shouldRender(control, attributes) {
	const cl = control.conditionalLogic;
	if (!cl?.enabled || !Array.isArray(cl.rules) || cl.rules.length === 0) {
		return true;
	}
	const op = cl.operator === 'or' ? 'or' : 'and';
	const results = cl.rules.map((rule) => evalRule(rule, attributes));
	return op === 'or' ? results.some(Boolean) : results.every(Boolean);
}

function evalRule(rule, attributes) {
	const actual = attributes[rule.field];
	switch (rule.operator) {
		case '==': return actual == rule.value; // eslint-disable-line eqeqeq
		case '!=': return actual != rule.value; // eslint-disable-line eqeqeq
		case '>':  return Number(actual) >  Number(rule.value);
		case '<':  return Number(actual) <  Number(rule.value);
		case '>=': return Number(actual) >= Number(rule.value);
		case '<=': return Number(actual) <= Number(rule.value);
		case 'contains':
			return typeof actual === 'string' && actual.includes(rule.value);
		case 'in':
			return Array.isArray(rule.value) && rule.value.includes(actual);
		default:
			return true;
	}
}
