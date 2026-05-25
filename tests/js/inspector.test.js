/**
 * Tests for src/conditional-logic.js — the JS-side mirror of PHP
 * Conditional + panelsContainingErrors (used by the meta-box to auto-open
 * panels with validation errors).
 *
 * Keep `shouldRender` in sync with PHP Conditional::should_render. If
 * the two disagree, a field hidden on the client could still trigger a
 * server-side validation error.
 *
 * inspector.js re-exports both from this module so production callers can
 * keep using inspector imports; tests target the pure module to avoid
 * pulling in the whole React control library.
 */

import { shouldRender, panelsContainingErrors } from '../../src/conditional-logic';

const cond = (rules, operator) => ({
	conditionalLogic: { enabled: true, operator, rules },
});

describe('shouldRender — no rules', () => {
	test('no conditionalLogic block → always renders', () => {
		expect(shouldRender({ type: 'text' }, {})).toBe(true);
	});

	test('disabled block → always renders', () => {
		expect(
			shouldRender(
				{ conditionalLogic: { enabled: false, rules: [{ field: 'x', operator: '==', value: 1 }] } },
				{ x: 99 },
			),
		).toBe(true);
	});

	test('empty rules array → always renders', () => {
		expect(shouldRender(cond([]), {})).toBe(true);
	});
});

describe('shouldRender — operators', () => {
	test('==', () => {
		expect(shouldRender(cond([{ field: 'f', operator: '==', value: true }]), { f: true })).toBe(true);
		expect(shouldRender(cond([{ field: 'f', operator: '==', value: true }]), { f: false })).toBe(false);
	});

	test('!=', () => {
		const c = cond([{ field: 't', operator: '!=', value: 'free' }]);
		expect(shouldRender(c, { t: 'pro' })).toBe(true);
		expect(shouldRender(c, { t: 'free' })).toBe(false);
	});

	test('>, <, >=, <=', () => {
		const gt = cond([{ field: 'n', operator: '>', value: 5 }]);
		const lt = cond([{ field: 'n', operator: '<', value: 5 }]);
		const gte = cond([{ field: 'n', operator: '>=', value: 5 }]);
		const lte = cond([{ field: 'n', operator: '<=', value: 5 }]);

		expect(shouldRender(gt, { n: 10 })).toBe(true);
		expect(shouldRender(gt, { n: 5 })).toBe(false);
		expect(shouldRender(lt, { n: 3 })).toBe(true);
		expect(shouldRender(lt, { n: 5 })).toBe(false);
		expect(shouldRender(gte, { n: 5 })).toBe(true);
		expect(shouldRender(lte, { n: 5 })).toBe(true);
	});

	test('contains', () => {
		const c = cond([{ field: 's', operator: 'contains', value: 'vip' }]);
		expect(shouldRender(c, { s: 'this is a vip member' })).toBe(true);
		expect(shouldRender(c, { s: 'standard' })).toBe(false);
	});

	test('in', () => {
		const c = cond([{ field: 'r', operator: 'in', value: ['a', 'b'] }]);
		expect(shouldRender(c, { r: 'a' })).toBe(true);
		expect(shouldRender(c, { r: 'b' })).toBe(true);
		expect(shouldRender(c, { r: 'c' })).toBe(false);
	});

	test('unknown operator defaults to render (fail-open)', () => {
		const c = cond([{ field: 'x', operator: 'nonsense', value: 1 }]);
		expect(shouldRender(c, {})).toBe(true);
	});

	test('missing field in attributes', () => {
		const c = cond([{ field: 'doesnt_exist', operator: '==', value: 'anything' }]);
		expect(shouldRender(c, {})).toBe(false);
	});
});

describe('shouldRender — AND / OR', () => {
	test('and (default) — all must pass', () => {
		const c = cond([
			{ field: 'a', operator: '==', value: 1 },
			{ field: 'b', operator: '==', value: 2 },
		]);
		expect(shouldRender(c, { a: 1, b: 2 })).toBe(true);
		expect(shouldRender(c, { a: 1, b: 99 })).toBe(false);
	});

	test('or — any passes', () => {
		const c = cond(
			[
				{ field: 'a', operator: '==', value: 1 },
				{ field: 'b', operator: '==', value: 2 },
			],
			'or',
		);
		expect(shouldRender(c, { a: 1, b: 99 })).toBe(true);
		expect(shouldRender(c, { a: 99, b: 2 })).toBe(true);
		expect(shouldRender(c, { a: 99, b: 99 })).toBe(false);
	});
});

describe('panelsContainingErrors', () => {
	test('returns empty set when no errors', () => {
		const controls = [
			{ type: 'group', id: 'g1', label: 'Group' },
			{ type: 'text', attributeKey: 'a', parentPanelId: 'g1' },
		];
		expect(panelsContainingErrors(controls, {}).size).toBe(0);
	});

	test('finds the panel of an errored field', () => {
		const controls = [
			{ type: 'group', id: 'g1', label: 'Text' },
			{ type: 'text', attributeKey: 'a', parentPanelId: 'g1' },
			{ type: 'group', id: 'g2', label: 'Other' },
			{ type: 'text', attributeKey: 'b', parentPanelId: 'g2' },
		];
		const errored = panelsContainingErrors(controls, { a: 'msg' });
		expect(errored.has('g1')).toBe(true);
		expect(errored.has('g2')).toBe(false);
	});

	test('finds multiple panels when several have errors', () => {
		const controls = [
			{ type: 'group', id: 'g1', label: 'A' },
			{ type: 'text', attributeKey: 'a', parentPanelId: 'g1' },
			{ type: 'group', id: 'g2', label: 'B' },
			{ type: 'text', attributeKey: 'b', parentPanelId: 'g2' },
		];
		const errored = panelsContainingErrors(controls, { a: 'msg', b: 'msg' });
		expect(errored.size).toBe(2);
	});

	test('ignores ungrouped errored fields (no parentPanelId)', () => {
		// Field at the top level has no panel to open; it's already visible.
		const controls = [
			{ type: 'text', attributeKey: 'a' }, // no parentPanelId
		];
		expect(panelsContainingErrors(controls, { a: 'msg' }).size).toBe(0);
	});

	test('ignores structural controls', () => {
		const controls = [
			{ type: 'group', id: 'g1', label: 'X' },
			{ type: 'panel', id: 'g2', label: 'Y' },
		];
		expect(panelsContainingErrors(controls, { g1: 'msg' }).size).toBe(0);
	});
});
