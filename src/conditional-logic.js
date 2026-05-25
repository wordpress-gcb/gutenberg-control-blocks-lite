/**
 * Conditional logic — pure functions, no React, no @wordpress/* deps.
 *
 * Kept separate from inspector.js so unit tests can import without
 * pulling in the whole control library. Keep in sync with PHP mirror:
 *   includes/PostFields/Conditional.php
 *
 * Config shape on a control:
 *
 *   {
 *     conditionalLogic: {
 *       enabled:  true,
 *       operator: 'and' | 'or',           // default: 'and'
 *       rules: [
 *         { field: 'show_cta', operator: '==', value: true },
 *         { field: 'count',    operator: '>',  value: 0 },
 *       ],
 *     }
 *   }
 */

// Structural control types (group, panel, tools-panel) render as panel
// containers, not as fields. Exported so callers that walk the control
// list can skip them consistently.
export const STRUCTURAL_TYPES = new Set(['group', 'panel', 'tools-panel']);

/**
 * Decide whether a control should render against the current attribute
 * values. A control with no `conditionalLogic` (or a disabled one) is
 * always rendered.
 */
export function shouldRender(control, attributes) {
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
		case '>':  return Number.isFinite(Number(actual)) && Number.isFinite(Number(rule.value)) && Number(actual) >  Number(rule.value);
		case '<':  return Number.isFinite(Number(actual)) && Number.isFinite(Number(rule.value)) && Number(actual) <  Number(rule.value);
		case '>=': return Number.isFinite(Number(actual)) && Number.isFinite(Number(rule.value)) && Number(actual) >= Number(rule.value);
		case '<=': return Number.isFinite(Number(actual)) && Number.isFinite(Number(rule.value)) && Number(actual) <= Number(rule.value);
		case 'contains':
			return typeof actual === 'string' && actual.includes(rule.value);
		case 'in':
			return Array.isArray(rule.value) && rule.value.includes(actual);
		default:
			return true;
	}
}

/**
 * Walk controls and return the set of panel ids that contain at least one
 * control whose attributeKey appears in `errors`. Used by the meta-box to
 * auto-open panels that have validation errors.
 */
export function panelsContainingErrors(controls, errors) {
	const errorKeys = new Set(Object.keys(errors || {}));
	if (errorKeys.size === 0) return new Set();

	const ids = new Set();
	for (const c of controls) {
		if (STRUCTURAL_TYPES.has(c.type)) continue;
		if (c.attributeKey && errorKeys.has(c.attributeKey) && c.parentPanelId) {
			ids.add(c.parentPanelId);
		}
	}
	return ids;
}
