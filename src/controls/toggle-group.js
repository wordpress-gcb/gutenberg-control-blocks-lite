/**
 * ToggleGroup — radio-style segmented control. Stores a single value.
 */
import {
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';

export default function ToggleGroupField({ control, value, onChange }) {
	// ToggleGroupControl needs undefined (not '') when nothing is selected,
	// otherwise it shows every option as checked.
	const controlValue = value || undefined;

	return (
		<div className="gcb-toggle-group-control">
			<ToggleGroupControl
				label={control.label}
				value={controlValue}
				onChange={onChange}
				help={control.helpText}
				isBlock={control.isBlock !== false}
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			>
				{(control.options || []).map((option, idx) => (
					<ToggleGroupControlOption
						key={option.value || idx}
						value={option.value}
						label={option.label}
					/>
				))}
			</ToggleGroupControl>
		</div>
	);
}
