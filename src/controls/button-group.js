/**
 * ButtonGroup — multi-select shown as a row of toggle buttons. Each option
 * looks like a pressable button; clicking toggles it on/off.
 *
 * Stored shape: array of selected values, same as checkbox-group.
 *   ['apple', 'cherry']
 *
 * Why not alias checkbox-group? Checkbox-group is checkboxes-in-a-column
 * (vertical, ☑ ☐ ☐). ButtonGroup is buttons-in-a-row (horizontal, compact,
 * visually weightier). Same data shape, different affordance.
 *
 * For single-select segmented controls use `toggle-group` instead.
 */

import { BaseControl, Button, __experimentalHStack as HStack } from '@wordpress/components';

export default function ButtonGroupField({ control, value, onChange }) {
	const current = Array.isArray(value) ? value : [];

	return (
		<BaseControl
			label={control.label}
			help={control.helpText}
			className="gcb-button-group-control components-base-control"
			__nextHasNoMarginBottom
		>
			<HStack spacing={1} justify="flex-start" wrap>
				{(control.options || []).map((option) => {
					const isOn = current.includes(option.value);
					return (
						<Button
							key={option.value}
							variant={isOn ? 'primary' : 'secondary'}
							onClick={() => {
								const next = isOn
									? current.filter((v) => v !== option.value)
									: [...current, option.value];
								onChange(next);
							}}
							aria-pressed={isOn}
						>
							{option.label}
						</Button>
					);
				})}
			</HStack>
		</BaseControl>
	);
}
