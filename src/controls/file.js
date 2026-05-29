/**
 * FileField — non-image attachment picker. Stores `{ id, url, filename, title }`.
 *
 * The trigger button mirrors the image control's "popout" tile (file icon +
 * filename + chevron) so the Inspector feels consistent.
 */

import { __ } from '@wordpress/i18n';
import {
	Button,
	__experimentalHStack as HStack,
	__experimentalTruncate as Truncate,
} from '@wordpress/components';
import MediaPicker from './MediaPicker';
import PopoverOrModal from './PopoverOrModal';
import MediaCapabilityGate from './MediaCapabilityGate';
import MediaTriggerBadges from './MediaTriggerBadges';

const TOGGLE_BUTTON_STYLE = {
	width: '100%',
	height: 'auto',
	padding: '12px',
	justifyContent: 'flex-start',
	border: '1px solid #ddd',
	borderRadius: '2px',
	backgroundColor: '#fff',
};

function FileIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			width="20"
			height="20"
			style={{ flexShrink: 0, fill: '#1e1e1e' }}
			aria-hidden
		>
			<path d="M14 9V3.5L19.5 9H14zM6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h12V11h-5V4H6z" />
		</svg>
	);
}

export default function FileField({ control, value, onChange }) {
	const fileValue = (typeof value === 'object' && value !== null)
		? value
		: { id: null, url: value || '', filename: '', title: '' };
	const hasFile = !!(fileValue.id || fileValue.url);
	const displayTitle = fileValue.title || fileValue.filename || __('(no title)', 'gcblite');

	return (
		<div className="components-base-control gcb-file-control">
			<div className="components-base-control__field">
				<label className="components-base-control__label">{control.label}</label>
			</div>
			{control.helpText && (
				<p className="components-base-control__help">{control.helpText}</p>
			)}

			<MediaCapabilityGate>
				<MediaPicker
					onSelect={(media) => onChange({
						id: media.id,
						url: media.url,
						filename: media.filename,
						title: media.title,
					})}
					allowedTypes={control.allowedTypes || ['application', 'text', 'image', 'video', 'audio']}
					value={fileValue.id}
					render={({ open }) => (
						<div>
							{!hasFile && (
								<Button
									onClick={open}
									variant="secondary"
									style={{ marginBottom: 8 }}
								>
									{__('Select File', 'gcblite')}
								</Button>
							)}

							{hasFile && (
								<PopoverOrModal
									modalTitle={control.label || __('File', 'gcblite')}
									dropdownProps={{ popoverProps: { placement: 'left-start' } }}
									renderToggle={({ isOpen, onToggle }) => (
										<MediaTriggerBadges onClear={() => onChange({ id: null, url: '', filename: '', title: '' })}>
											<Button
												onClick={onToggle}
												aria-expanded={isOpen}
												className="gcb-modal-toggle-button gcb-file-control-toggle"
												style={TOGGLE_BUTTON_STYLE}
											>
												<HStack spacing={3}>
													<FileIcon />
													<Truncate numberOfLines={1}>{displayTitle}</Truncate>
												</HStack>
											</Button>
										</MediaTriggerBadges>
									)}
									renderContent={({ close }) => (
										<div style={{ padding: 16, minWidth: 280 }}>
											<Button
												onClick={() => { close(); open(); }}
												variant="secondary"
												style={{ width: '100%', marginBottom: 12 }}
											>
												{__('Replace File', 'gcblite')}
											</Button>
											<Button
												onClick={() => { onChange({ id: null, url: '', filename: '', title: '' }); close(); }}
												variant="tertiary"
												isDestructive
												style={{ width: '100%' }}
											>
												{__('Remove File', 'gcblite')}
											</Button>
										</div>
									)}
								/>
							)}

							{!hasFile && (
								<p style={{ fontSize: 13, color: '#757575', margin: 0 }}>
									{__('No file selected', 'gcblite')}
								</p>
							)}
						</div>
					)}
				/>
			</MediaCapabilityGate>
		</div>
	);
}
