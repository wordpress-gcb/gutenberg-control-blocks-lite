import { BaseControl, Button, DatePicker, Popover } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

export default function DateField({ control, value, onChange }) {
	const [open, setOpen] = useState(false);

	return (
		<BaseControl label={control.label} help={control.helpText} __nextHasNoMarginBottom>
			<Button variant="secondary" onClick={() => setOpen((o) => !o)}>
				{value ? new Date(value).toLocaleDateString() : __('Pick a date', 'gcblite')}
			</Button>
			{value && (
				<Button variant="tertiary" size="small" isDestructive onClick={() => onChange('')} style={{ marginLeft: 8 }}>
					{__('Clear', 'gcblite')}
				</Button>
			)}
			{open && (
				<Popover onClose={() => setOpen(false)} placement="bottom-start">
					<div style={{ padding: 8 }}>
						<DatePicker
							currentDate={value || undefined}
							onChange={(next) => {
								onChange(next || '');
								setOpen(false);
							}}
						/>
					</div>
				</Popover>
			)}
		</BaseControl>
	);
}
