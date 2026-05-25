import { BaseControl, Button, DatePicker } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import PopoverOrModal from './PopoverOrModal';

export default function DateField({ control, value, onChange }) {
	return (
		<BaseControl label={control.label} help={control.helpText} __nextHasNoMarginBottom>
			<PopoverOrModal
				modalTitle={control.label || __('Pick a date', 'gcblite')}
				dropdownProps={{ popoverProps: { placement: 'bottom-start' } }}
				renderToggle={({ onToggle }) => (
					<>
						<Button variant="secondary" onClick={onToggle}>
							{value ? new Date(value).toLocaleDateString() : __('Pick a date', 'gcblite')}
						</Button>
						{value && (
							<Button variant="tertiary" size="small" isDestructive onClick={() => onChange('')} style={{ marginLeft: 8 }}>
								{__('Clear', 'gcblite')}
							</Button>
						)}
					</>
				)}
				renderContent={({ close }) => (
					<div style={{ padding: 8 }}>
						<DatePicker
							currentDate={value || undefined}
							onChange={(next) => {
								onChange(next || '');
								close();
							}}
						/>
					</div>
				)}
			/>
		</BaseControl>
	);
}
