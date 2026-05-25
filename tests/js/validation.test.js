/**
 * Tests for src/validation.js — the JS-side mirror of PHP Validator.
 * Keep these in sync with tests/php/Unit/ValidatorTest.php; if the two
 * disagree on what counts as "empty" or "valid", the editor will silently
 * accept input the server rejects (or vice versa).
 */

import { validate, validateAll } from '../../src/validation';

const ctrl = (extra = {}) => ({
	type: 'text',
	attributeKey: 'k',
	label: 'Field',
	...extra,
});

describe('validate — required', () => {
	test('no validation block → always ok', () => {
		expect(validate(ctrl(), '')).toEqual({ ok: true });
	});

	test('required empty string fails', () => {
		const r = validate(ctrl({ validation: { required: true } }), '');
		expect(r.ok).toBe(false);
		expect(r.message).toMatch(/Field/);
	});

	test('required populated string ok', () => {
		expect(validate(ctrl({ validation: { required: true } }), 'hello').ok).toBe(true);
	});

	test('zero is not empty (toggle/number = 0 is a valid value)', () => {
		expect(validate(ctrl({ validation: { required: true } }), 0).ok).toBe(true);
		expect(validate(ctrl({ validation: { required: true } }), '0').ok).toBe(true);
	});

	test('boolean false is not empty (toggle off is a real saved value)', () => {
		expect(
			validate({ type: 'toggle', attributeKey: 'k', validation: { required: true } }, false).ok,
		).toBe(true);
	});

	test('empty array fails required', () => {
		const r = validate(
			{ type: 'checkbox-group', attributeKey: 'k', label: 'Tags', validation: { required: true } },
			[],
		);
		expect(r.ok).toBe(false);
	});

	test('url shape with no url counts as empty', () => {
		const r = validate(
			{ type: 'url', attributeKey: 'k', label: 'Link', validation: { required: true } },
			{ url: '', text: '', opensInNewTab: false },
		);
		expect(r.ok).toBe(false);
	});

	test('url shape with url set is ok', () => {
		expect(
			validate(
				{ type: 'url', attributeKey: 'k', validation: { required: true } },
				{ url: 'https://example.com', text: '', opensInNewTab: false },
			).ok,
		).toBe(true);
	});

	test('heading-level shape with no text counts as empty', () => {
		const r = validate(
			{ type: 'heading-level', attributeKey: 'k', label: 'Title', validation: { required: true } },
			{ text: '', level: 'h2' },
		);
		expect(r.ok).toBe(false);
	});

	test('heading-level shape with text is ok', () => {
		expect(
			validate(
				{ type: 'heading-level', attributeKey: 'k', validation: { required: true } },
				{ text: 'Section title', level: 'h2' },
			).ok,
		).toBe(true);
	});

	test('custom requiredMessage string', () => {
		const r = validate(
			ctrl({ validation: { required: true, requiredMessage: 'Custom required text.' } }),
			'',
		);
		expect(r.message).toBe('Custom required text.');
	});

	test('required as object with message', () => {
		const r = validate(
			ctrl({ validation: { required: { message: 'Object form message.' } } }),
			'',
		);
		expect(r.message).toBe('Object form message.');
	});
});

describe('validate — length', () => {
	test('minLength fail', () => {
		const r = validate(ctrl({ validation: { minLength: 5 } }), 'abc');
		expect(r.ok).toBe(false);
		expect(r.message).toMatch(/5/);
	});

	test('minLength pass', () => {
		expect(validate(ctrl({ validation: { minLength: 3 } }), 'abcd').ok).toBe(true);
	});

	test('maxLength fail', () => {
		expect(validate(ctrl({ validation: { maxLength: 3 } }), 'abcde').ok).toBe(false);
	});

	test('empty optional skips length check', () => {
		expect(validate(ctrl({ validation: { minLength: 5 } }), '').ok).toBe(true);
	});
});

describe('validate — numeric range', () => {
	test('min fail', () => {
		const r = validate(
			{ type: 'number', attributeKey: 'k', validation: { min: 10 } },
			5,
		);
		expect(r.ok).toBe(false);
		expect(r.message).toMatch(/10/);
	});

	test('max fail', () => {
		expect(
			validate({ type: 'number', attributeKey: 'k', validation: { max: 100 } }, 500).ok,
		).toBe(false);
	});

	test('numeric string coerced', () => {
		expect(
			validate({ type: 'number', attributeKey: 'k', validation: { min: 0 } }, '5').ok,
		).toBe(true);
	});

	test('zero in range', () => {
		expect(
			validate(
				{ type: 'number', attributeKey: 'k', validation: { min: 0, max: 10 } },
				0,
			).ok,
		).toBe(true);
	});

	test('non-numeric value is skipped, not failed', () => {
		// "abc" isn't a number so range comparison is a no-op (no false negative).
		expect(
			validate(
				{ type: 'text', attributeKey: 'k', validation: { min: 0, max: 10 } },
				'abc',
			).ok,
		).toBe(true);
	});
});

describe('validate — pattern', () => {
	test('default message on failure', () => {
		const r = validate(ctrl({ validation: { pattern: '^[A-Z]' } }), 'lowercase');
		expect(r.ok).toBe(false);
		expect(r.message).toBe('Value does not match the required format.');
	});

	test('custom message on failure', () => {
		const r = validate(
			ctrl({ validation: { pattern: '^[A-Z]', patternMessage: 'Capitalise it.' } }),
			'lowercase',
		);
		expect(r.message).toBe('Capitalise it.');
	});

	test('pattern pass', () => {
		expect(validate(ctrl({ validation: { pattern: '^[A-Z]' } }), 'Capital').ok).toBe(true);
	});

	test('invalid regex is treated as no constraint, not fatal', () => {
		const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
		const r = validate(ctrl({ validation: { pattern: '[unclosed' } }), 'anything');
		expect(r.ok).toBe(true);
		spy.mockRestore();
	});
});

describe('validateAll', () => {
	test('skips structural controls', () => {
		const controls = [
			{ type: 'group', id: 'g', label: 'Group' },
			ctrl({ validation: { required: true } }),
		];
		expect(validateAll(controls, { k: 'set' })).toEqual({ ok: true });
	});

	test('aggregates errors', () => {
		const controls = [
			ctrl({ attributeKey: 'a', label: 'A', validation: { required: true } }),
			ctrl({ attributeKey: 'b', label: 'B', validation: { required: true } }),
			ctrl({ attributeKey: 'c', label: 'C' }),
		];
		const r = validateAll(controls, { c: 'set' });
		expect(r.ok).toBe(false);
		expect(r.errors).toHaveProperty('a');
		expect(r.errors).toHaveProperty('b');
		expect(r.errors).not.toHaveProperty('c');
	});

	test('respects isVisible — hidden required fields are skipped', () => {
		const controls = [
			ctrl({ attributeKey: 'a', label: 'A', validation: { required: true } }),
		];
		expect(validateAll(controls, {}, () => false)).toEqual({ ok: true });
	});

	test('controls with no attributeKey are skipped silently', () => {
		const controls = [
			{ type: 'message', message: 'Info' }, // no attributeKey
		];
		expect(validateAll(controls, {})).toEqual({ ok: true });
	});
});
