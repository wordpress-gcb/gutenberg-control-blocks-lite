import { TextareaControl } from '@wordpress/components';

export default function TextareaField({ control, value, onChange }) {
	return (
		<TextareaControl
			label={control.label}
			help={control.helpText}
			placeholder={control.placeholder}
			value={value ?? ''}
			onChange={onChange}
			rows={4}
			__nextHasNoMarginBottom
		/>
	);
}
