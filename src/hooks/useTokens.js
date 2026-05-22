/**
 * useTokens — read theme.json + built-in tokens from window.gcbLite.tokens.
 *
 * Most controls just need `getTokensByGroup` synchronously (since the data
 * is already on window). The hook form is for cases where a component
 * wants a stable dependency to react on.
 */
import { useState, useEffect } from '@wordpress/element';
import { getAllTokenGroups } from '../utils/token-helper';

export function useTokens() {
	const [tokens, setTokens] = useState(getAllTokenGroups());

	useEffect(() => {
		// gcbLite is set by wp_localize_script before our bundle runs, so
		// the initial value above is already correct. Re-evaluate on mount
		// in case localisation arrives late (defer/async loading).
		setTokens(getAllTokenGroups());
	}, []);

	return { tokens, loading: false, error: null };
}

/**
 * Resolve a `tokenGroup` value (e.g. "custom:gap") to its tokens array.
 */
export function getTokensByGroup(allTokens, tokenGroup) {
	if (!allTokens || !tokenGroup) return null;
	const [categoryKey, subKey] = tokenGroup.split(':');
	const category = allTokens[categoryKey];
	if (!category?.children) return null;
	return category.children[subKey]?.tokens || null;
}

/**
 * Build a `key → { label, token }` map for SelectField / RangeField legacy shape.
 */
export function generateMapFromTokens(tokens) {
	if (!Array.isArray(tokens)) return null;
	const map = {};
	tokens.forEach((t) => {
		map[t.key] = { label: t.label, token: t.slug || t.value };
	});
	return map;
}
