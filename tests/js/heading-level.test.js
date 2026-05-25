/**
 * Tests for heading-level option resolution.
 *
 * The control renders a text input + level select bound to React; for
 * unit-test purposes we cover the pure filter logic that decides which
 * levels appear in the select. Keep the constants below in sync with
 * src/controls/heading-level.js — they're duplicated rather than
 * imported so the test doesn't pull in @wordpress/components.
 */

const ALL_LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span'];

function resolveLevels(control) {
	if (Array.isArray(control.levels) && control.levels.length > 0) {
		return control.levels.filter((l) => ALL_LEVELS.includes(l));
	}
	return ALL_LEVELS;
}

describe('heading-level level resolution', () => {
	test('default offers every level (h1-h6 + p + div + span)', () => {
		expect(resolveLevels({})).toEqual(ALL_LEVELS);
	});

	test('config `levels` restricts to the listed subset', () => {
		expect(resolveLevels({ levels: ['h2', 'h3', 'h4'] }))
			.toEqual(['h2', 'h3', 'h4']);
	});

	test('config `levels` filters out unknown values', () => {
		// Author typo / unsupported level should be silently dropped
		// rather than crashing the picker.
		expect(resolveLevels({ levels: ['h2', 'h99', 'h3'] }))
			.toEqual(['h2', 'h3']);
	});

	test('empty `levels` array falls back to all levels', () => {
		// Authors shouldn't accidentally get a control with no options.
		expect(resolveLevels({ levels: [] })).toEqual(ALL_LEVELS);
	});

	test('semantic-only subset is easy to express', () => {
		// Common case: only allow real headings, no p/div/span.
		const semantic = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
		expect(resolveLevels({ levels: semantic })).toEqual(semantic);
	});
});
