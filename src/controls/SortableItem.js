/**
 * Sortable item — ported from the original GCB SortableItemComponent.
 *
 * Used by gallery, post-object (and any other future multi-select reorderable
 * field) to render a draggable row with handle, title, and remove button.
 */
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { __ } from '@wordpress/i18n';

const ICONS = {
	post: {
		viewBox: '0 0 24 24',
		path: (
			<>
				<path d="M15.5 7.5h-7V9h7V7.5Zm-7 3.5h7v1.5h-7V11Zm7 3.5h-7V16h7v-1.5Z" />
				<path d="M17 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2ZM7 5.5h10a.5.5 0 0 1 .5.5v12a.5.5 0 0 1-.5.5H7a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5Z" />
			</>
		),
	},
	tag: {
		viewBox: '0 0 24 24',
		path: <path d="M12.5 4.5h-2v7h7v-2l-5-5zm-2.5 8.5v5h2v-5h-2zm5 5h2v-5h-2v5z" />,
	},
	image: {
		viewBox: '0 0 24 24',
		path: <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.86 8.86l-3 3.87L9 13.14 6 17h12l-3.86-5.14z" />,
	},
};

export default function SortableItem({ item, onRemove, icon = 'post', getTitle, thumb }) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: item.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	const selectedIcon = ICONS[icon] || ICONS.post;

	return (
		<div
			ref={setNodeRef}
			style={style}
			className="gcb-sortable-item"
			{...attributes}
			{...listeners}
		>
			<div className="gcb-sortable-drag-handle" aria-hidden>
				<svg viewBox="0 0 20 20" width="12">
					<path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
				</svg>
			</div>

			{thumb ? (
				<img
					src={thumb}
					alt=""
					style={{
						width: 28, height: 28, borderRadius: 2, objectFit: 'cover',
						marginRight: 8, flexShrink: 0, border: '1px solid #ddd',
					}}
				/>
			) : (
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox={selectedIcon.viewBox}
					width="20"
					height="20"
					style={{ marginRight: 8, flexShrink: 0, opacity: 0.6 }}
				>
					{selectedIcon.path}
				</svg>
			)}

			<span style={{
				flex: 1,
				overflow: 'hidden',
				textOverflow: 'ellipsis',
				whiteSpace: 'nowrap',
				userSelect: 'none',
			}}>
				{getTitle ? getTitle(item) : (item.title?.rendered || item.name || __('(no title)', 'gcblite'))}
			</span>

			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onRemove(item.id);
				}}
				onPointerDown={(e) => e.stopPropagation()}
				className="gcb-sortable-remove"
				aria-label={__('Remove', 'gcblite')}
			>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
					<path d="M12 13.06l3.712 3.713 1.061-1.06L13.061 12l3.712-3.712-1.06-1.06L12 10.938 8.288 7.227l-1.061 1.06L10.939 12l-3.712 3.712 1.06 1.061L12 13.061z" />
				</svg>
			</button>
		</div>
	);
}
