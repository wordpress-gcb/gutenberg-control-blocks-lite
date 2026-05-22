import { RadioControl } from '@wordpress/components';

export default function RadioField({ control, value, onChange }) {
	const options = (control.options || []).map((o) => ({
		label: o.label,
		value: String(o.value),
	}));

	return (
		<RadioControl
			label={control.label}
			help={control.helpText}
			selected={value != null ? String(value) : ''}
			options={options}
			onChange={onChange}
		/>
	);
}
