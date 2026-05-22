import { BaseControl, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Icon control — minimal v1.
 *
 * Stored shape (compatible with the original GCB):
 *   { source, icon, svg }
 *
 * v1 only supports `source: 'dashicon'` (icon = dashicon name) and shows a live
 * preview. Future revisions can add picker UIs for FontAwesome / Lineicons / SVG
 * upload via a registry of icon sources.
 */
export default function IconField({ control, value, onChange }) {
	const icon = value && typeof value === 'object' ? value : { source: 'dashicon', icon: '', svg: '' };

	return (
		<BaseControl label={control.label} help={control.helpText ?? __('Dashicon name (e.g. admin-users, location-alt)', 'gcblite')} __nextHasNoMarginBottom>
			<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
				{icon.icon && (
					<span
						className={`dashicons dashicons-${icon.icon}`}
						style={{ fontSize: 24, width: 24, height: 24 }}
						aria-hidden
					/>
				)}
				<div style={{ flex: 1 }}>
					<TextControl
						label=""
						hideLabelFromVision
						value={icon.icon}
						onChange={(next) => onChange({ source: 'dashicon', icon: next, svg: '' })}
						placeholder="admin-generic"
						__nextHasNoMarginBottom
					/>
				</div>
			</div>
		</BaseControl>
	);
}
