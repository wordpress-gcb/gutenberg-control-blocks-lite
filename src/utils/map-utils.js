/**
 * Map utilities for fields that translate user-friendly keys to backend tokens.
 *
 *   simple:  { sm: 'spacing-sm', md: 'spacing-md' }
 *   labelled:{ sm: { label: 'Small (16px)', token: 'spacing-sm' } }
 */

export const parseMap = (map) => {
	if (!map || typeof map !== 'object') return null;
	const out = {};
	Object.entries(map).forEach(([key, value]) => {
		if (typeof value === 'string') {
			out[key] = { label: key, token: value };
		} else if (typeof value === 'object' && value.token) {
			out[key] = { label: value.label || key, token: value.token };
		}
	});
	return Object.keys(out).length > 0 ? out : null;
};

export const getTokenFromKey = (m, key) => (m && key ? m[key]?.token || null : null);

export const getKeyFromToken = (m, token) => {
	if (!m || !token) return null;
	const entry = Object.entries(m).find(([, v]) => v.token === token);
	return entry ? entry[0] : null;
};

export const mapToOptions = (m) => {
	if (!m) return [];
	return Object.entries(m).map(([key, v]) => ({ label: v.label, value: key }));
};

export const getMapKeys = (m) => {
	if (!m) return [];
	return Object.keys(m)
		.map((k) => Number(k))
		.filter((k) => !Number.isNaN(k))
		.sort((a, b) => a - b);
};

export const mapToRangeMarks = (m) => {
	if (!m) return null;
	return Object.entries(m).map(([key, v]) => ({ value: Number(key), label: v.label }));
};

export const isValidMapValue = (m, value) => {
	if (!m || value === null || value === undefined) return false;
	if (m[value]) return true;
	return Object.values(m).some((e) => e.token === value);
};
