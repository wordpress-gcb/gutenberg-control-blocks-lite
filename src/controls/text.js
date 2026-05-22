import { TextControl } from '@wordpress/components';

export default function TextField({ control, value, onChange }) {
	return (
		<TextControl
			label={control.label}
			help={control.helpText}
			placeholder={control.placeholder}
			value={value ?? ''}
			onChange={onChange}
			__nextHasNoMarginBottom
		/>
	);
}
