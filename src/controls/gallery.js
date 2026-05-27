/**
 * GalleryField — ported verbatim from the original GCB GalleryControlComponent.
 *
 * Stored shape: array of image objects (same shape as ImageField), with
 * focalPoint / size / customWidth / repeat / isFixed preserved per item across
 * media-library reselects.
 *
 * Each row is independently draggable (dnd-kit) and edits open the same
 * focal-point/size panel as the single-image control.
 */

import { __ } from '@wordpress/i18n';
import { useState } from '@wordpress/element';
import {
	Button,
	__experimentalHStack as HStack,
	__experimentalTruncate as Truncate,
} from '@wordpress/components';
import MediaPicker from './MediaPicker';
import MediaCapabilityGate from './MediaCapabilityGate';
import PopoverOrModal from './PopoverOrModal';
import {
	DndContext,
	closestCenter,
	PointerSensor,
	useSensor,
	useSensors,
	DragOverlay,
} from '@dnd-kit/core';
import {
	SortableContext,
	verticalListSortingStrategy,
	useSortable,
	arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ImageControlContent } from './image';

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
 * Single gallery row — drag handle + thumbnail dropdown trigger + remove button.
 */
function SortableGalleryImage({ image, onUpdate, onRemove, control }) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: image.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
		marginBottom: 8,
	};

	const displayTitle = image.title || image.filename || image.alt || __('(no description)', 'gcblite');

	return (
		<div ref={setNodeRef} style={style} className="gcb-gallery-image-item">
			<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
				<div
					{...attributes}
					{...listeners}
					style={{
						cursor: 'grab',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						padding: 4,
						flexShrink: 0,
					}}
					aria-label={__('Drag to reorder', 'gcblite')}
				>
					<svg viewBox="0 0 20 20" width="16" height="16" style={{ fill: '#666' }}>
						<path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
					</svg>
				</div>

				<MediaPicker
					onSelect={(media) => onUpdate(image.id, {
						...image,
						id: media.id,
						url: media.url,
						alt: media.alt || '',
						title: media.title || media.filename || '',
						filename: media.filename || '',
						width: media.width,
						height: media.height,
						filesize: media.filesizeInBytes,
					})}
					allowedTypes={['image']}
					value={image.id}
					render={({ open }) => (
						<PopoverOrModal
							modalTitle={displayTitle || __('Gallery image', 'gcblite')}
							dropdownProps={{ popoverProps: { placement: 'left-start' } }}
							renderToggle={({ isOpen, onToggle }) => (
								<Button
									onClick={onToggle}
									aria-expanded={isOpen}
									aria-label={__('Image settings', 'gcblite')}
									className="gcb-modal-toggle-button gcb-image-control-toggle"
									style={{ ...TOGGLE_BUTTON_STYLE, flex: 1 }}
								>
									<HStack spacing={3} justify="flex-start">
										<span
											aria-hidden
											style={{
												width: 32,
												height: 32,
												borderRadius: '100%',
												backgroundImage: `url(${image.url})`,
												backgroundSize: 'cover',
												backgroundPosition: 'center',
												flexShrink: 0,
												border: '1px solid #ddd',
												display: 'block',
											}}
										/>
										<Truncate numberOfLines={1}>{displayTitle}</Truncate>
									</HStack>
								</Button>
							)}
							renderContent={({ close }) => (
								<div style={{ padding: 16, minWidth: 280 }}>
									<ImageControlContent
										control={control}
										value={image}
										onChange={(newValue) => onUpdate(image.id, newValue)}
										onReplace={() => { close(); open(); }}
									/>
									<div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #ddd' }}>
										<Button
											onClick={() => { onRemove(image.id); close(); }}
											variant="link"
											isDestructive
											style={{ width: '100%' }}
										>
											{__('Remove from gallery', 'gcblite')}
										</Button>
									</div>
								</div>
							)}
						/>
					)}
				/>
			</div>
		</div>
	);
}

export default function GalleryField({ control, value, onChange }) {
	const [activeId, setActiveId] = useState(null);
	const images = Array.isArray(value) ? value : [];

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
	);

	const handleDragStart = (event) => setActiveId(event.active.id);

	const handleDragEnd = (event) => {
		const { active, over } = event;
		setActiveId(null);
		if (over && active.id !== over.id) {
			const oldIndex = images.findIndex((img) => img.id === active.id);
			const newIndex = images.findIndex((img) => img.id === over.id);
			onChange(arrayMove(images, oldIndex, newIndex));
		}
	};

	const handleSelect = (media) => {
		const newImages = Array.isArray(media) ? media : [media];
		const existingMap = new Map(images.map((img) => [img.id, img]));

		const formatted = newImages.map((img) => {
			const existing = existingMap.get(img.id);
			if (existing) {
				return {
					...existing,
					url: img.url,
					alt: img.alt || existing.alt,
					title: img.title || img.filename || existing.title,
					filename: img.filename || existing.filename,
					width: img.width,
					height: img.height,
					filesize: img.filesizeInBytes,
				};
			}
			return {
				id: img.id,
				url: img.url,
				alt: img.alt || '',
				title: img.title || img.filename || '',
				filename: img.filename || '',
				width: img.width,
				height: img.height,
				filesize: img.filesizeInBytes,
				focalPoint: { x: 0.5, y: 0.5 },
				size: 'cover',
				customWidth: '',
				repeat: true,
				isFixed: false,
			};
		});

		onChange(formatted);
	};

	const removeImage = (imageId) => onChange(images.filter((img) => img.id !== imageId));
	const updateImage = (imageId, updates) =>
		onChange(images.map((img) => (img.id === imageId ? { ...img, ...updates } : img)));

	return (
		<div className="components-base-control gcb-gallery-control">
			<div className="components-base-control__field">
				<label className="components-base-control__label">{control.label}</label>
			</div>
			{control.helpText && (
				<p className="components-base-control__help">{control.helpText}</p>
			)}

			<MediaCapabilityGate>
				<MediaPicker
					onSelect={handleSelect}
					allowedTypes={['image']}
					multiple
					gallery
					value={images.map((img) => img.id)}
					render={({ open }) => (
						<div className="gcb-gallery-control-content">
							{images.length === 0 ? (
								<Button
									onClick={open}
									variant="secondary"
									style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
								>
									{__('Add images', 'gcblite')}
								</Button>
							) : (
								<>
									<DndContext
										sensors={sensors}
										collisionDetection={closestCenter}
										onDragStart={handleDragStart}
										onDragEnd={handleDragEnd}
									>
										<SortableContext
											items={images.map((img) => img.id)}
											strategy={verticalListSortingStrategy}
										>
											<div className="gcb-gallery-items">
												{images.map((image) => (
													<SortableGalleryImage
														key={image.id}
														image={image}
														onUpdate={updateImage}
														onRemove={removeImage}
														control={control}
													/>
												))}
											</div>
										</SortableContext>

										<DragOverlay>
											{activeId
												? (() => {
													const active = images.find((img) => img.id === activeId);
													const title = active?.title || active?.filename || active?.alt || __('(no description)', 'gcblite');
													return (
														<div style={{
															display: 'flex',
															alignItems: 'center',
															gap: 8,
															padding: '8px 12px',
															background: 'white',
															borderRadius: 2,
															boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
															opacity: 0.9,
															maxWidth: 400,
															border: '1px solid #ddd',
														}}>
															<svg viewBox="0 0 20 20" width="16" height="16" style={{ fill: '#666' }}>
																<path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
															</svg>
															<span
																aria-hidden
																style={{
																	width: 32,
																	height: 32,
																	borderRadius: '100%',
																	backgroundImage: `url(${active?.url})`,
																	backgroundSize: 'cover',
																	backgroundPosition: 'center',
																	flexShrink: 0,
																	border: '1px solid #ddd',
																	display: 'block',
																}}
															/>
															<span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
																{title}
															</span>
														</div>
													);
												})()
												: null}
										</DragOverlay>
									</DndContext>

									<Button
										onClick={open}
										variant="secondary"
										style={{ width: '100%', marginTop: 12 }}
									>
										{__('Add more images', 'gcblite')}
									</Button>
								</>
							)}
						</div>
					)}
				/>
			</MediaCapabilityGate>
		</div>
	);
}
