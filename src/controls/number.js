import { __experimentalNumberControl as NumberControl } from '@wordpress/components';

export default function NumberField({ control, value, onChange }) {
	return (
		<NumberControl
			label={control.label}
			help={control.helpText}
			placeholder={control.placeholder}
			value={value ?? 0}
			onChange={(next) => onChange(next === '' ? 0 : Number(next))}
			min={control.min}
			max={control.max}
			step={control.step ?? 1}
			__nextHasNoMarginBottom
		/>
	);
}
