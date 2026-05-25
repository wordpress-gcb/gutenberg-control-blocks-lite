/**
 * DateTime — like Date, but with a time picker too. Stores an ISO 8601
 * timestamp string (e.g. "2026-05-25T14:30:00").
 *
 * Uses WP's DateTimePicker rather than DatePicker so the panel shows hours
 * and minutes alongside the calendar. Renders inside PopoverOrModal so it
 * behaves correctly in both sidebar (popover) and metabox (modal) contexts.
 */

import { BaseControl, Button, DateTimePicker } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import PopoverOrModal from './PopoverOrModal';

export default function DatetimeField({ control, value, onChange }) {
	const displayLabel = value
		? new Date(value).toLocaleString()
		: __('Pick a date and time', 'gcblite');

	return (
		<BaseControl label={control.label} help={control.helpText} __nextHasNoMarginBottom>
			<PopoverOrModal
				modalTitle={control.label || __('Pick a date and time', 'gcblite')}
				dropdownProps={{ popoverProps: { placement: 'bottom-start' } }}
				renderToggle={({ onToggle }) => (
					<>
						<Button variant="secondary" onClick={onToggle}>
							{displayLabel}
						</Button>
						{value && (
							<Button
								variant="tertiary"
								size="small"
								isDestructive
								onClick={() => onChange('')}
								style={{ marginLeft: 8 }}
							>
								{__('Clear', 'gcblite')}
							</Button>
						)}
					</>
				)}
				renderContent={() => (
					<div style={{ padding: 8 }}>
						<DateTimePicker
							currentDate={value || undefined}
							onChange={(next) => onChange(next || '')}
							is12Hour
						/>
					</div>
				)}
			/>
		</BaseControl>
	);
}
