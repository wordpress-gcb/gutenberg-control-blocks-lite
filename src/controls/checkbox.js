import { CheckboxControl } from '@wordpress/components';

export default function CheckboxField({ control, value, onChange }) {
	return (
		<CheckboxControl
			label={control.label}
			help={control.helpText}
			checked={!!value}
			onChange={onChange}
			__nextHasNoMarginBottom
		/>
	);
}
