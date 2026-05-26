/**
 * Field validation — pure functions, used by both the post-fields meta-box
 * and the block Inspector. Server-side mirror lives in
 * GCBLite\PostFields\Validator (PHP) — keep these in sync when adding rules.
 *
 * Config shape on a control:
 *
 *   {
 *     type: 'text',
 *     attributeKey: 'subtitle',
 *     label: 'Subtitle',
 *     validation: {
 *       required:        true | { message: 'Custom required text' },
 *       minLength:       3,
 *       maxLength:       80,
 *       min:             0,         // number / range
 *       max:             100,       // number / range
 *       pattern:         '^[A-Z]',  // string regex, applied to string values
 *       patternMessage:  'Must start with a capital letter.',
 *     }
 *   }
 *
 * Returns { ok: true } when valid, { ok: false, message: '...' } when not.
 * Conditional logic is evaluated separately via shouldRender — hidden
 * controls skip validation entirely.
 */

import { __, sprintf } from '@wordpress/i18n';

export function validate(control, value) {
	// Repeater: row-count limits + per-row sub-field validation. Recurse
	// before falling through to the standard rules (which don't apply to
	// an array-of-rows shape).
	if (control.type === 'repeater') {
		return validateRepeater(control, value);
	}

	const v = control.validation;
	if (!v) return { ok: true };

	const isEmpty = isEmptyValue(value);

	// Required
	if (v.required) {
		if (isEmpty) {
			const msg = (typeof v.required === 'object' && v.required.message)
				|| v.requiredMessage
				|| sprintf(
					/* translators: %s is the field label */
					__('%s is required.', 'gcblite'),
					control.label || control.attributeKey
				);
			return { ok: false, message: msg };
		}
	}

	// Below rules only apply to non-empty values — an unfilled optional
	// field is valid by definition.
	if (isEmpty) return { ok: true };

	// Length (strings)
	if (typeof value === 'string') {
		if (typeof v.minLength === 'number' && value.length < v.minLength) {
			return {
				ok: false,
				message: sprintf(
					/* translators: %d is the minimum number of characters */
					__('Must be at least %d characters.', 'gcblite'),
					v.minLength
				),
			};
		}
		if (typeof v.maxLength === 'number' && value.length > v.maxLength) {
			return {
				ok: false,
				message: sprintf(
					/* translators: %d is the maximum number of characters */
					__('Must be %d characters or fewer.', 'gcblite'),
					v.maxLength
				),
			};
		}
		if (v.pattern) {
			try {
				const re = new RegExp(v.pattern);
				if (!re.test(value)) {
					return {
						ok: false,
						message: v.patternMessage || __('Value does not match the required format.', 'gcblite'),
					};
				}
			} catch (err) {
				// Invalid regex in config — treat as no constraint, log it.
				// eslint-disable-next-line no-console
				console.warn('gcb-lite: invalid validation.pattern regex', v.pattern, err);
			}
		}
	}

	// Numeric range (numbers; coerce strings that look numeric)
	if (typeof v.min === 'number' || typeof v.max === 'number') {
		const num = typeof value === 'number' ? value : parseFloat(value);
		if (Number.isFinite(num)) {
			if (typeof v.min === 'number' && num < v.min) {
				return {
					ok: false,
					message: sprintf(
						/* translators: %s is the minimum value */
						__('Must be at least %s.', 'gcblite'),
						String(v.min)
					),
				};
			}
			if (typeof v.max === 'number' && num > v.max) {
				return {
					ok: false,
					message: sprintf(
						/* translators: %s is the maximum value */
						__('Must be %s or less.', 'gcblite'),
						String(v.max)
					),
				};
			}
		}
	}

	return { ok: true };
}

/**
 * Validate a repeater value. Mirrors the PHP-side validate_repeater
 * branch — keep both in sync when changing rules.
 */
function validateRepeater(control, value) {
	const rows = Array.isArray(value) ? value : [];
	const count = rows.length;

	const min = typeof control.min === 'number' ? control.min : 0;
	if (min > 0 && count < min) {
		return {
			ok: false,
			message: sprintf(
				/* translators: 1: field label, 2: minimum number of rows */
				__('%1$s needs at least %2$d entries.', 'gcblite'),
				control.label || control.attributeKey,
				min
			),
		};
	}
	if (typeof control.max === 'number' && control.max > 0 && count > control.max) {
		return {
			ok: false,
			message: sprintf(
				/* translators: 1: field label, 2: maximum number of rows */
				__('%1$s allows at most %2$d entries.', 'gcblite'),
				control.label || control.attributeKey,
				control.max
			),
		};
	}

	const subFields = Array.isArray(control.fields) ? control.fields : [];
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		if (!row || typeof row !== 'object') continue;
		for (const sub of subFields) {
			if (!sub.attributeKey) continue;
			const result = validate(sub, row[sub.attributeKey]);
			if (!result.ok) {
				return {
					ok: false,
					message: sprintf(
						/* translators: 1: row number, 2: sub-field label, 3: error message */
						__('Row %1$d, %2$s: %3$s', 'gcblite'),
						i + 1,
						sub.label || sub.attributeKey,
						result.message
					),
				};
			}
		}
	}
	return { ok: true };
}

/**
 * "Empty" for validation purposes:
 *   - undefined, null, '' (empty string)
 *   - empty array
 *   - empty plain object (no keys) — image control stores {} when cleared
 *   - URL control's `{ url: '', ... }` shape with no URL set
 * Booleans, zero, and "0" are NOT empty (they're valid values).
 */
function isEmptyValue(value) {
	if (value === undefined || value === null || value === '') return true;
	if (Array.isArray(value)) return value.length === 0;
	if (typeof value === 'object') {
		// URL field stores { url, text, opensInNewTab } — empty means no url
		if ('url' in value && Object.keys(value).every((k) => k === 'url' || k === 'text' || k === 'opensInNewTab')) {
			return !value.url;
		}
		// Heading-level field stores { text, level } — empty means no text
		// (level always has a default, so a heading with no text is the
		// "not filled in" state regardless of which level is selected).
		if ('text' in value && 'level' in value && Object.keys(value).length === 2) {
			return !value.text;
		}
		return Object.keys(value).length === 0;
	}
	return false;
}

/**
 * Validate a whole set of controls at once. Returns
 *   { ok: true } | { ok: false, errors: { [attributeKey]: message } }
 *
 * Skips controls hidden by conditional logic (caller passes `isVisible`).
 */
export function validateAll(controls, attributes, isVisible = () => true) {
	const errors = {};
	for (const control of controls) {
		if (!control.attributeKey) continue;
		if (!isVisible(control)) continue;
		const result = validate(control, attributes[control.attributeKey]);
		if (!result.ok) {
			errors[control.attributeKey] = result.message;
		}
	}
	const keys = Object.keys(errors);
	return keys.length === 0 ? { ok: true } : { ok: false, errors };
}
