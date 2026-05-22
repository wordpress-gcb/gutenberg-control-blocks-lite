/**
 * Size — dimension with a unit selector (px / em / rem / % / vh / vw).
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
