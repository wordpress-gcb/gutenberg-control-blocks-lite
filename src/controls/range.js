/**
 * RangeField — ported verbatim from the original.
 * Supports raw numeric ranges, legacy `map` configs, and `tokenGroup` binding.
 */

import { __ } from '@wordpress/i18n';
import { RangeControl, Spinner } from '@wordpress/components';
import { parseMap, getTokenFromKey, getKeyFromToken, getMapKeys, mapToRangeMarks } from '../utils/map-utils';
import { useTokens, getTokensByGroup, generateMapFromTokens } from '../hooks/useTokens';

function RangeFieldImpl({
	label,
	value,
	onChange,
	min = 0,
	max = 100,
	step = 1,
	help,
	allowReset = true,
	resetFallbackValue,
	className = '',
	map,
	tokenGroup,
	defaultOptionKey,
}) {
	const { tokens, loading } = useTokens();

	let normalizedMap = null;
	if (tokenGroup && tokens) {
		const groupTokens = getTokensByGroup(tokens, tokenGroup);
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

	const allowedKeys = normalizedMap ? getMapKeys(normalizedMap) : null;
	const marks = normalizedMap ? mapToRangeMarks(normalizedMap) : null;

	if ((value === undefined || value === null || value === '') && defaultOptionKey && normalizedMap) {
		const defaultToken = getTokenFromKey(normalizedMap, defaultOptionKey);
		if (defaultToken && onChange) onChange(defaultToken);
	}

	let displayValue;
	if (normalizedMap && value) {
		displayValue = Number(getKeyFromToken(normalizedMap, value)) || value;
	} else if (typeof value === 'string' && !isNaN(value)) {
		displayValue = Number(value);
	} else {
		displayValue = value;
	}

	const handleChange = (newSliderValue) => {
		let finalValue = normalizedMap
			? getTokenFromKey(normalizedMap, String(newSliderValue))
			: newSliderValue;
		if (onChange) onChange(finalValue);
	};

	const effectiveStep = normalizedMap && allowedKeys && allowedKeys.length > 1 ? 1 : step;
	const effectiveMin = normalizedMap && allowedKeys?.length ? Math.min(...allowedKeys) : min;
	const effectiveMax = normalizedMap && allowedKeys?.length ? Math.max(...allowedKeys) : max;

	return (
		<RangeControl
			label={label}
			value={displayValue}
			onChange={handleChange}
			min={effectiveMin}
			max={effectiveMax}
			step={effectiveStep}
			marks={marks}
			help={help}
			allowReset={allowReset}
			resetFallbackValue={resetFallbackValue}
			className={className}
			__nextHasNoMarginBottom
			__next40pxDefaultSize
		/>
	);
}

export default function RangeField({ control, value, onChange }) {
	return (
		<RangeFieldImpl
			label={control.label}
			value={value}
			onChange={onChange}
			min={control.min ?? 0}
			max={control.max ?? 100}
			step={control.step ?? 1}
			help={control.helpText}
			map={control.map}
			tokenGroup={control.tokenGroup}
			defaultOptionKey={control.defaultOptionKey ?? control.default}
		/>
	);
}
