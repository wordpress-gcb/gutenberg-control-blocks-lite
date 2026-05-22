import { TextControl } from '@wordpress/components';

export default function EmailField({ control, value, onChange }) {
	return (
		<TextControl
			label={control.label}
			help={control.helpText}
			placeholder={control.placeholder ?? 'name@example.com'}
			type="email"
			value={value ?? ''}
			onChange={onChange}
			__nextHasNoMarginBottom
		/>
	);
}
