/**
 * Size — dimension with a unit selector.
 *
 * Stored shape: a CSS length string with unit, e.g. `'16px'`, `'1.5rem'`,
 * `'100%'`. Empty string when not set.
 *
 * Supported units: px, em, rem, %, vh, vw.
 *
 * In a React component you can pass the value directly to `style.width`,
 * `style.height`, `style.padding`, etc. — it's already a valid CSS length.
 */
import { __experimentalUnitControl as UnitControl, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const UNITS = [
	{ value: 'px',  label: 'px' },
	{ value: 'em',  label: 'em' },
	{ value: 'rem', label: 'rem' },
	{ value: '%',   label: '%' },
	{ value: 'vh',  label: 'vh' },
	{ value: 'vw',  label: 'vw' },
];

export default function SizeField({ control, value, onChange }) {
	if (UnitControl) {
		return (
			<UnitControl
				label={control.label}
				value={value || ''}
				onChange={onChange}
				units={UNITS}
				help={control.helpText}
				__nextHasNoMarginBottom
			/>
		);
	}

	// Fallback when UnitControl isn't available — manual entry.
	return (
		<TextControl
			label={control.label}
			value={value || ''}
			onChange={onChange}
			placeholder="e.g. 16px, 1em, 100%"
			help={control.helpText || __('Enter a size with unit (px, em, rem, %, vh, vw)', 'gcblite')}
			__nextHasNoMarginBottom
		/>
	);
}
