/**
 * Token helpers — ported from the original GCB.
 *
 * Two layers of tokens:
 *   - Built-in groups (this file): hard-coded design system tokens that ship
 *     with the plugin. Useful as a fallback when a theme has no theme.json.
 *   - Theme groups (window.gcbLite.tokens): parsed from theme.json by PHP.
 *     Always merged in by getTokenGroupTokens() below — theme tokens win on
 *     a path collision.
 *
 * Token path syntax: "category:subKey" or "category:subKey:tokenKey".
 *   "spacing:scale"   — the group of tokens
 *   "spacing:scale:30" — a specific token
 */

const builtInTokenGroups = {
	color: {
		label: 'Color',
		children: {
			palette: {
				label: 'Palette',
				tokens: [
					{ key: 'primary',   value: 'color-primary',   label: 'Primary' },
					{ key: 'secondary', value: 'color-secondary', label: 'Secondary' },
					{ key: 'accent',    value: 'color-accent',    label: 'Accent' },
					{ key: 'neutral',   value: 'color-neutral',   label: 'Neutral' },
					{ key: 'dark',      value: 'color-dark',      label: 'Dark' },
					{ key: 'light',     value: 'color-light',     label: 'Light' },
				],
			},
			duotone: {
				label: 'Duotone',
				tokens: [
					{ key: 'blue',   value: 'duotone-blue',   label: 'Blue Duotone' },
					{ key: 'purple', value: 'duotone-purple', label: 'Purple Duotone' },
					{ key: 'green',  value: 'duotone-green',  label: 'Green Duotone' },
				],
			},
		},
	},
	spacing: {
		label: 'Spacing',
		children: {
			scale: {
				label: 'Scale',
				tokens: [
					{ key: '0',  value: 'spacing-none', label: 'None (0)',          size: '0' },
					{ key: '10', value: 'spacing-10',   label: 'Step 1 (0.25rem)', size: '0.25rem' },
					{ key: '20', value: 'spacing-20',   label: 'Step 2 (0.5rem)',  size: '0.5rem' },
					{ key: '30', value: 'spacing-30',   label: 'Step 3 (1rem)',    size: '1rem' },
					{ key: '40', value: 'spacing-40',   label: 'Step 4 (1.5rem)',  size: '1.5rem' },
					{ key: '50', value: 'spacing-50',   label: 'Step 5 (2rem)',    size: '2rem' },
					{ key: '60', value: 'spacing-60',   label: 'Step 6 (3rem)',    size: '3rem' },
					{ key: '70', value: 'spacing-70',   label: 'Step 7 (4rem)',    size: '4rem' },
					{ key: '80', value: 'spacing-80',   label: 'Step 8 (6rem)',    size: '6rem' },
				],
			},
			presets: {
				label: 'Presets',
				tokens: [
					{ key: 'xs',  value: 'spacing-xs',  label: 'Extra Small (0.5rem)', size: '0.5rem' },
					{ key: 'sm',  value: 'spacing-sm',  label: 'Small (1rem)',         size: '1rem' },
					{ key: 'md',  value: 'spacing-md',  label: 'Medium (1.5rem)',      size: '1.5rem' },
					{ key: 'lg',  value: 'spacing-lg',  label: 'Large (2rem)',         size: '2rem' },
					{ key: 'xl',  value: 'spacing-xl',  label: 'Extra Large (3rem)',   size: '3rem' },
					{ key: '2xl', value: 'spacing-2xl', label: '2X Large (4rem)',      size: '4rem' },
					{ key: '3xl', value: 'spacing-3xl', label: '3X Large (6rem)',      size: '6rem' },
				],
			},
			semantic: {
				label: 'Semantic',
				tokens: [
					{ key: 'content',   value: 'spacing-content',   label: 'Content',   size: 'var(--wp--style--block-gap, 1.5rem)' },
					{ key: 'section',   value: 'spacing-section',   label: 'Section',   size: 'clamp(2rem, 5vw, 4rem)' },
					{ key: 'container', value: 'spacing-container', label: 'Container', size: 'clamp(1rem, 3vw, 2rem)' },
				],
			},
		},
	},
	typography: {
		label: 'Typography',
		children: {
			fontSize: {
				label: 'Font Sizes',
				tokens: [
					{ key: 'xs',   value: 'text-xs',   label: 'Extra Small (12px)' },
					{ key: 'sm',   value: 'text-sm',   label: 'Small (14px)' },
					{ key: 'base', value: 'text-base', label: 'Base (16px)' },
					{ key: 'lg',   value: 'text-lg',   label: 'Large (18px)' },
					{ key: 'xl',   value: 'text-xl',   label: 'Extra Large (20px)' },
					{ key: '2xl',  value: 'text-2xl',  label: '2X Large (24px)' },
				],
			},
			fontWeight: {
				label: 'Font Weights',
				tokens: [
					{ key: 'light',    value: 'font-light',    label: 'Light (300)' },
					{ key: 'normal',   value: 'font-normal',   label: 'Normal (400)' },
					{ key: 'medium',   value: 'font-medium',   label: 'Medium (500)' },
					{ key: 'semibold', value: 'font-semibold', label: 'Semibold (600)' },
					{ key: 'bold',     value: 'font-bold',     label: 'Bold (700)' },
				],
			},
		},
	},
	sizing: {
		label: 'Sizing',
		children: {
			containers: {
				label: 'Container Widths',
				tokens: [
					{ key: 'narrow', value: 'container-narrow', label: 'Narrow (600px)' },
					{ key: 'normal', value: 'container-normal', label: 'Normal (1200px)' },
					{ key: 'wide',   value: 'container-wide',   label: 'Wide (1600px)' },
					{ key: 'full',   value: 'container-full',   label: 'Full Width' },
				],
			},
			borderRadius: {
				label: 'Border Radius',
				tokens: [
					{ key: 'none', value: 'radius-none', label: 'None' },
					{ key: 'sm',   value: 'radius-sm',   label: 'Small' },
					{ key: 'md',   value: 'radius-md',   label: 'Medium' },
					{ key: 'lg',   value: 'radius-lg',   label: 'Large' },
					{ key: 'full', value: 'radius-full', label: 'Full (Pill)' },
				],
			},
		},
	},
};

/**
 * Get all token groups, merging built-ins with theme.json tokens.
 * Theme tokens override built-ins on a path collision.
 */
export function getAllTokenGroups() {
	const themeTokens = window.gcbLite?.tokens || {};
	const merged = { ...builtInTokenGroups };

	Object.keys(themeTokens).forEach((category) => {
		if (merged[category]) {
			merged[category] = {
				...merged[category],
				children: {
					...(merged[category].children || {}),
					...(themeTokens[category].children || {}),
				},
			};
		} else {
			merged[category] = themeTokens[category];
		}
	});

	return merged;
}

/**
 * Resolve a token group path to its token list.
 *
 * @param {string} tokenGroup  e.g. "spacing:scale", "custom:gap"
 * @returns {Array|null}
 */
export function getTokenGroupTokens(tokenGroup) {
	if (!tokenGroup || typeof tokenGroup !== 'string') return null;
	const [categoryKey, subKey] = tokenGroup.split(':');
	if (!categoryKey || !subKey) return null;

	const all = getAllTokenGroups();
	const category = all[categoryKey];
	if (!category?.children) return null;

	return category.children[subKey]?.tokens || null;
}

/**
 * Convert a token list to {label, value} options for a select/radio control.
 */
export function tokensToOptions(tokens) {
	if (!Array.isArray(tokens)) return [];
	return tokens.map((t) => ({ label: t.label, value: t.key }));
}

/**
 * For spacing tokens: resolve the raw size value (e.g. "1rem").
 * Accepts a full path ("spacing:scale:30"), a partial ("scale:30"),
 * or just a key ("30") — searches in priority order.
 */
export function getSpacingSize(tokenKey) {
	if (!tokenKey) return null;
	const parts = tokenKey.split(':');
	let categoryKey, subKey, key;

	if (parts.length === 3) {
		[categoryKey, subKey, key] = parts;
	} else if (parts.length === 2) {
		categoryKey = 'spacing';
		[subKey, key] = parts;
	} else {
		// Bare key — search every spacing subcategory.
		const spacing = getAllTokenGroups().spacing;
		if (spacing?.children) {
			for (const subCat of Object.values(spacing.children)) {
				const t = subCat.tokens?.find((tok) => tok.key === tokenKey);
				if (t?.size) return t.size;
				if (t?.value) return t.value; // theme.json tokens use `value`
			}
		}
		return null;
	}

	const cat = getAllTokenGroups()[categoryKey];
	const tok = cat?.children?.[subKey]?.tokens?.find((t) => t.key === key);
	return tok?.size || tok?.value || null;
}

/**
 * Convert a spacing token to the WP CSS custom property.
 * Falls back to var(--wp--preset--spacing--{key}) for unknown tokens.
 */
export function spacingTokenToCSSVar(tokenKey) {
	if (!tokenKey) return null;
	const parts = tokenKey.split(':');
	const key = parts.length > 1 ? parts[parts.length - 1] : tokenKey;
	return `var(--wp--preset--spacing--${key})`;
}

/**
 * Resolve a token to its cssVar, preferring an explicit cssVar property
 * (theme.json tokens have one), falling back to the spacing convention.
 */
export function tokenToCSSVar(token) {
	if (!token) return null;
	if (token.cssVar) return token.cssVar;
	if (token.slug) return `var(--wp--preset--spacing--${token.slug})`;
	return null;
}
