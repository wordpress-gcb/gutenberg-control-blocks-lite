/**
 * ImageField — ported verbatim from the original GCB ImageControlComponent.
 *
 * Stored shape:
 *   {
 *     id, url, alt, title, filename, width, height, filesize,
 *     focalPoint: { x, y },
 *     size: 'cover' | 'contain' | 'auto',
 *     repeat: boolean,
 *     isFixed: boolean,
 *     customWidth: string  // e.g. "320px", "50%"
 *   }
 *
 * Features (toggleable via control config):
 *   - enableFocalPoint        (default true)  → FocalPointPicker on the selected image
 *   - enableSizeOptions       (default true)  → cover / contain / tile + custom width
 *   - enableRepeatOptions     (default true)  → repeat toggle (when size != cover)
 *   - enableFixedBackground   (default true)  → background-attachment: fixed
 */

import { __ } from '@wordpress/i18n';
import {
	Button,
	FocalPointPicker,
	Icon,
	ToggleControl,
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
	__experimentalUnitControl as UnitControl,
	__experimentalHStack as HStack,
	__experimentalTruncate as Truncate,
	FlexItem,
	VisuallyHidden,
} from '@wordpress/components';
import { pencil as editIcon } from '@wordpress/icons';
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

/**
 * Resolve which MIME family the media library modal should allow. The
 * control defaults to images only; opt in to broader picks via the
 * schema:
 *
 *   { "type": "image", "allowVideo": true }            // image OR video
 *   { "type": "image", "allowedTypes": ["video"] }     // explicit override
 *
 * Authors uploading a video get a working URL back through the same
 * value shape — render templates pick <img> vs <video> by extension
 * (see the saas-banner / saas-feature-scroll item render.php examples).
 */
function resolveAllowedTypes(control) {
	if (Array.isArray(control?.allowedTypes) && control.allowedTypes.length > 0) {
		return control.allowedTypes;
	}
	if (control?.allowVideo) {
		return ['image', 'video'];
	}
	return ['image'];
}

/**
 * The settings panel rendered inside the Dropdown popover. Shows focal point,
 * size, custom width, repeat, fixed-background. Also offers a Replace button.
 *
 * Exported so the gallery control can reuse it for each gallery row.
 */
export function ImageControlContent({ control, value, onChange, onReplace }) {
	const enableFocalPoint = control.enableFocalPoint !== false;
	const enableSizeOptions = control.enableSizeOptions !== false;
	const enableRepeatOptions = control.enableRepeatOptions !== false;
	const enableFixedBackground = control.enableFixedBackground !== false;

	const imageValue = value || {};
	const focalPoint = imageValue.focalPoint || { x: 0.5, y: 0.5 };
	const size = imageValue.size || 'cover';
	const customWidth = imageValue.customWidth || '';
	const repeat = imageValue.repeat !== false;
	const isFixed = imageValue.isFixed || false;

	const updateValue = (updates) => onChange({ ...imageValue, ...updates });

	if (!imageValue.url) return null;

	const displayTitle = imageValue.title
		|| imageValue.filename
		|| imageValue.alt
		|| __('(no description)', 'gcblite');

	return (
		<div className="gcb-image-control-content__sections">
			{onReplace && (
				<Button
					onClick={onReplace}
					className="gcb-modal-toggle-button"
					aria-label={__('Replace image', 'gcblite')}
					style={{
						width: '100%',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'flex-start',
						padding: '8px 12px',
						border: '1px solid #ddd',
						borderRadius: 2,
						background: 'white',
						cursor: 'pointer',
						gap: 12,
					}}
				>
					<span
						aria-hidden
						style={{
							width: 32,
							height: 32,
							borderRadius: '100%',
							backgroundImage: `url(${imageValue.url})`,
							backgroundSize: 'cover',
							backgroundPosition: 'center',
							flexShrink: 0,
							border: '1px solid #ddd',
							display: 'block',
						}}
					/>
					<span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
						{displayTitle}
					</span>
					<Icon icon={editIcon} size={20} style={{ fill: '#1e1e1e', flexShrink: 0 }} />
				</Button>
			)}

			{enableFocalPoint && (
				<FocalPointPicker
					url={imageValue.url}
					value={focalPoint}
					onChange={(p) => updateValue({ focalPoint: p })}
				/>
			)}

			{enableFixedBackground && (
				<ToggleControl
					label={__('Fixed background', 'gcblite')}
					checked={isFixed}
					onChange={(v) => updateValue({ isFixed: v })}
					__nextHasNoMarginBottom
				/>
			)}

			{enableSizeOptions && (
				<div className="gcb-image-control-content__sections">
					<ToggleGroupControl
						label={__('Size', 'gcblite')}
						value={size}
						onChange={(v) => {
							if (v === 'cover' || v === 'contain') {
								updateValue({ size: v, repeat: false });
							} else {
								updateValue({ size: v });
							}
						}}
						isBlock
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						help={
							size === 'cover'
								? __('Image covers the space evenly.', 'gcblite')
								: size === 'contain'
								? __('Image is contained without distortion.', 'gcblite')
								: undefined
						}
					>
						<ToggleGroupControlOption value="cover" label={__('Cover', 'gcblite')} />
						<ToggleGroupControlOption value="contain" label={__('Contain', 'gcblite')} />
						<ToggleGroupControlOption value="auto" label={__('Tile', 'gcblite')} />
					</ToggleGroupControl>

					<HStack spacing={3}>
						<UnitControl
							value={customWidth}
							onChange={(v) => updateValue({ customWidth: v })}
							units={[
								{ value: 'px', label: 'px' },
								{ value: '%', label: '%' },
								{ value: 'em', label: 'em' },
								{ value: 'rem', label: 'rem' },
								{ value: 'vw', label: 'vw' },
								{ value: 'vh', label: 'vh' },
							]}
							placeholder={__('Auto', 'gcblite')}
							min={0}
							step={1}
							disabled={size === 'cover'}
							aria-label={__('Background image width', 'gcblite')}
							__nextHasNoMarginBottom
						/>
						{enableRepeatOptions && (
							<ToggleControl
								label={__('Repeat', 'gcblite')}
								checked={repeat}
								onChange={(v) => updateValue({ repeat: v })}
								disabled={size === 'cover'}
								__nextHasNoMarginBottom
							/>
						)}
					</HStack>
				</div>
			)}
		</div>
	);
}

export default function ImageField({ control, value, onChange }) {
	const imageValue = value || {};

	return (
		<div className="components-base-control gcb-image-control">
			<div className="components-base-control__field">
				<label className="components-base-control__label">{control.label}</label>
			</div>
			{control.helpText && (
				<p className="components-base-control__help">{control.helpText}</p>
			)}

			<MediaCapabilityGate>
				<MediaPicker
					onSelect={(media) => {
						onChange({
							id: media.id,
							url: media.url,
							alt: media.alt || '',
							title: media.title || media.filename || '',
							filename: media.filename || '',
							width: media.width,
							height: media.height,
							filesize: media.filesizeInBytes,
							focalPoint: imageValue.focalPoint || { x: 0.5, y: 0.5 },
							size: imageValue.size || 'cover',
							repeat: imageValue.repeat !== false,
							isFixed: imageValue.isFixed || false,
							customWidth: imageValue.customWidth || '',
						});
					}}
					allowedTypes={resolveAllowedTypes(control)}
					value={imageValue?.id}
					render={({ open }) => (
						<div className="gcb-image-control-content">
							{!imageValue?.url && (
								<>
									<Button
										onClick={open}
										variant="secondary"
										style={{ marginBottom: 8 }}
									>
										{__('Add image', 'gcblite')}
									</Button>
									<p style={{ fontSize: 13, color: '#757575', margin: 0 }}>
										{__('No image selected', 'gcblite')}
									</p>
								</>
							)}

							{imageValue?.url && (
								<PopoverOrModal
									modalTitle={control.label || __('Image settings', 'gcblite')}
									dropdownProps={{ popoverProps: { placement: 'left-start' } }}
									renderToggle={({ isOpen, onToggle }) => {
										const displayTitle = imageValue.title || imageValue.filename || imageValue.alt || __('(no description)', 'gcblite');
										return (
											<MediaTriggerBadges onClear={() => onChange(null)}>
												<Button
													onClick={onToggle}
													aria-expanded={isOpen}
													aria-label={__('Image size, position and focal point options.', 'gcblite')}
													className="gcb-modal-toggle-button gcb-image-control-toggle"
													style={TOGGLE_BUTTON_STYLE}
												>
													<HStack spacing={3} justify="flex-start">
														<span
															aria-hidden
															style={{
																width: 32,
																height: 32,
																borderRadius: '100%',
																backgroundImage: `url(${imageValue.url})`,
																backgroundSize: 'cover',
																backgroundPosition: 'center',
																flexShrink: 0,
																border: '1px solid #ddd',
																display: 'block',
															}}
														/>
														<FlexItem>
															<Truncate numberOfLines={1}>{displayTitle}</Truncate>
															<VisuallyHidden>
																{__('Image:', 'gcblite')} {displayTitle}
															</VisuallyHidden>
														</FlexItem>
													</HStack>
												</Button>
											</MediaTriggerBadges>
										);
									}}
									renderContent={({ close }) => (
										<div style={{ padding: 16, minWidth: 280 }}>
											<ImageControlContent
												control={control}
												value={imageValue}
												onChange={onChange}
												onReplace={() => {
													close();
													open();
												}}
											/>
										</div>
									)}
								/>
							)}
						</div>
					)}
				/>
			</MediaCapabilityGate>
		</div>
	);
}
