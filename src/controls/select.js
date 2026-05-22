/**
 * SelectField — ported from the original GCB SelectField.js verbatim.
 *
 * Supports plain {label, value} options, legacy `map` configs, and full
 * `tokenGroup` binding to theme.json tokens (with optional tokenKeys filter
 * and defaultOptionKey). When tokenGroup is set, the saved value is the
 * full token object { key, slug, value, cssVar } rather than a string.
 */

import { __ } from '@wordpress/i18n';
import { SelectControl, Spinner } from '@wordpress/components';
import { parseMap, getTokenFromKey, getKeyFromToken, mapToOptions } from '../utils/map-utils';
import { useTokens, getTokensByGroup, generateMapFromTokens } from '../hooks/useTokens';

function SelectFieldImpl({
	label,
	value,
	options = [],
	onChange,
	help,
	className = '',
	map,
	tokenGroup,
	tokenKeys,
	defaultOptionKey,
	placeholder,
}) {
	const { tokens, loading } = useTokens();

	let groupTokens = null;
	let normalizedMap = null;

	if (tokenGroup && tokens) {
		groupTokens = getTokensByGroup(tokens, tokenGroup);
		if (groupTokens && tokenKeys && Array.isArray(tokenKeys) && tokenKeys.length > 0) {
			groupTokens = groupTokens.filter((t) => tokenKeys.includes(t.key));
		}
		if (groupTokens) {
			const generatedMap = generateMapFromTokens(groupTokens);
			normalizedMap = generatedMap ? parseMap(generatedMap) : null;
		}
	} else if (map) {
		normalizedMap = parseMap(map);
	}

	if (tokenGroup && loading) {
		return (
			<div style={{ padding: '12px 0' }}>
				<div style={{ fontWeight: 500, marginBottom: '8px' }}>{label}</div>
				<Spinner />
			</div>
		);
	}

	let effectiveOptions = normalizedMap ? mapToOptions(normalizedMap) : options;

	// Add a clearing/placeholder option if no default is set, so users can pick blank.
	if (!defaultOptionKey && !effectiveOptions.some((o) => o.value === '')) {
		effectiveOptions = [
			{ label: '— ' + (placeholder || __('Select', 'gcblite')) + ' —', value: '' },
			...effectiveOptions,
		];
	}

	// Apply default if value is empty.
	if ((value === undefined || value === null || value === '') && defaultOptionKey && tokenGroup && groupTokens) {
		const defaultToken = groupTokens.find((t) => t.key === defaultOptionKey);
		if (defaultToken && onChange) {
			const defaultValue = {
				key: defaultToken.key,
				slug: defaultToken.slug,
				value: defaultToken.value,
				cssVar: defaultToken.cssVar,
			};
			onChange(defaultValue);
		}
	}

	let displayValue = value;
	if (typeof value === 'object' && value !== null) {
		displayValue = value.key !== undefined ? value.key : '';
	} else if (normalizedMap && value !== undefined && value !== null && value !== '') {
		displayValue = getKeyFromToken(normalizedMap, value) || value;
	}
	if ((displayValue === undefined || displayValue === null || displayValue === '') && defaultOptionKey) {
		displayValue = defaultOptionKey;
	}

	const handleChange = (newOptionKey) => {
		let finalValue = newOptionKey;

		if (tokenGroup && groupTokens) {
			const selected = groupTokens.find((t) => t.key === newOptionKey);
			if (selected) {
				finalValue = {
					key: selected.key,
					slug: selected.slug,
					value: selected.value,
					cssVar: selected.cssVar,
				};
			}
		} else if (normalizedMap) {
			finalValue = getTokenFromKey(normalizedMap, newOptionKey);
		}

		if (onChange) onChange(finalValue);
	};

	return (
		<SelectControl
			label={label}
			value={displayValue ?? ''}
			options={effectiveOptions}
			onChange={handleChange}
			help={help}
			className={className}
			__nextHasNoMarginBottom
		/>
	);
}

/**
 * Adapter: maps the registry's `{ control, value, onChange }` contract onto
 * SelectFieldImpl's flat-prop contract.
 */
export default function SelectField({ control, value, onChange }) {
	return (
		<SelectFieldImpl
			label={control.label}
			value={value}
			options={(control.options || []).map((o) => ({ label: o.label, value: o.value }))}
			onChange={onChange}
			help={control.helpText}
			placeholder={control.placeholder}
			map={control.map}
			tokenGroup={control.tokenGroup}
			tokenKeys={control.tokenKeys}
			defaultOptionKey={control.defaultOptionKey ?? control.default}
		/>
	);
}
