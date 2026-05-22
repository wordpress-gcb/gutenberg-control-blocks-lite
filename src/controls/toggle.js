import { ToggleControl } from '@wordpress/components';

export default function ToggleField({ control, value, onChange }) {
	return (
		<ToggleControl
			label={control.label}
			help={control.helpText}
			checked={!!value}
			onChange={onChange}
			__nextHasNoMarginBottom
		/>
	);
}
