/**
 * SpacingField — preset spacing (None / S / M / L) with a custom-value escape hatch.
 *
 * Stored value is either one of the preset keys (`'small'`, etc.) or a CSS
 * length string (e.g. `'2rem'`). When set to a custom value, the toggle group
 * is disabled and a "custom value applied" hint shows.
 */

import { __ } from '@wordpress/i18n';
import { Button, TextControl, Notice } from '@wordpress/components';
import { useState } from '@wordpress/element';
import {
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
	__experimentalHStack as HStack,
} from '@wordpress/components';

const DEFAULT_PRESETS = [
	{ label: 'None', value: 'none' },
	{ label: 'S',    value: 'small' },
	{ label: 'M',    value: 'medium' },
	{ label: 'L',    value: 'large' },
];

const PRESET_KEYS = new Set(['none', 'small', 'medium', 'large']);

function isValidCSSValue(input) {
	if (!input) return true;
	return /^(\d*\.?\d+)(px|rem|em|%|vw|vh|vmin|vmax)?$/.test(String(input).trim());
}

export default function SpacingField({ control, value, onChange }) {
	// Decide if value is a preset or a custom string.
	const isCustom = typeof value === 'string' && value !== '' && !PRESET_KEYS.has(value);
	const presetValue = isCustom ? 'medium' : (value || 'medium');

	const [showCustom, setShowCustom] = useState(isCustom);
	const [customInput, setCustomInput] = useState(isCustom ? value : '');
	const [error, setError] = useState(null);

	const presets = control.presets || DEFAULT_PRESETS;

	const handlePreset = (next) => {
		setShowCustom(false);
		setCustomInput('');
		setError(null);
		onChange(next);
	};

	const handleCustom = (next) => {
		setCustomInput(next);
		if (next && !isValidCSSValue(next)) {
			setError(__('Invalid spacing value. Use a number with a unit (e.g. 2rem, 20px).', 'gcblite'));
			return;
		}
		setError(null);
		onChange(next || 'medium');
	};

	const handleReset = () => {
		setShowCustom(false);
		setCustomInput('');
		setError(null);
		onChange('medium');
	};

	const displayHint = showCustom
		? 'Custom'
		: (presetValue.charAt(0).toUpperCase() + presetValue.slice(1));

	return (
		<div className={`gcb-spacing-field components-base-control ${control.className || ''}`.trim()}>
			<div className="components-base-control__field">
			<HStack>
				<span className="components-base-control__label">
					{control.label}
					<span className="components-font-size-picker__header__hint">{displayHint}</span>
				</span>
				<Button
					size="small"
					label={__('Set custom spacing', 'gcblite')}
					onClick={() => setShowCustom(true)}
					isPressed={showCustom}
					icon={(
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden focusable="false">
							<path d="m19 7.5h-7.628c-.3089-.87389-1.1423-1.5-2.122-1.5-.97966 0-1.81309.62611-2.12197 1.5h-2.12803v1.5h2.12803c.30888.87389 1.14231 1.5 2.12197 1.5.9797 0 1.8131-.62611 2.122-1.5h7.628z" />
							<path d="m19 15h-2.128c-.3089-.8739-1.1423-1.5-2.122-1.5s-1.8131.6261-2.122 1.5h-7.628v1.5h7.628c.3089.8739 1.1423 1.5 2.122 1.5s1.8131-.6261 2.122-1.5h2.128z" />
						</svg>
					)}
				/>
			</HStack>

			{error && (
				<Notice status="warning" isDismissible onRemove={() => setError(null)}>
					{error}
				</Notice>
			)}

			{showCustom && (
				<div style={{ marginBottom: 16, fontSize: 13 }}>
					<span>{__('Custom value applied', 'gcblite')}</span>
					<Button variant="link" onClick={handleReset} style={{ marginLeft: 8, fontSize: 13 }}>
						{__('Reset', 'gcblite')}
					</Button>
				</div>
			)}

			<ToggleGroupControl
				label={control.label}
				value={presetValue}
				onChange={handlePreset}
				isBlock
				hideLabelFromVision
				disabled={showCustom}
				className={showCustom ? 'is-disabled' : ''}
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			>
				{presets.map((preset) => (
					<ToggleGroupControlOption
						key={preset.value}
						value={preset.value}
						label={preset.label}
					/>
				))}
			</ToggleGroupControl>

			{showCustom && (
				<TextControl
					label={__('Custom Spacing', 'gcblite')}
					value={customInput}
					onChange={handleCustom}
					placeholder="e.g. 2rem or 20px"
					help={__('Enter a value with unit (e.g. 2rem, 20px, 5%) or leave empty for 0.', 'gcblite')}
					__nextHasNoMarginBottom
				/>
			)}
			</div>
		</div>
	);
}
