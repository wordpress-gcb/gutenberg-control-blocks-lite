/**
 * Repeater Inspector control — multi-row form-of-forms.
 *
 * Distinct from the `gcb/repeater` block (which is an InnerBlocks-based
 * canvas surface). This control lives in the Inspector / post-fields /
 * options page, and stores an ARRAY OF OBJECTS — each object a "row"
 * shaped by the `fields` sub-config.
 *
 *   {
 *     attributeKey: 'social_links',
 *     type: 'repeater',
 *     label: 'Social links',
 *     fields: [
 *       { attributeKey: 'label', type: 'text', label: 'Label' },
 *       { attributeKey: 'url',   type: 'url',  label: 'URL' },
 *     ],
 *     min: 0,
 *     max: null,                  // null = unlimited
 *     addButtonLabel: 'Add link',
 *     collapsedTitle: 'label',    // which sub-field to show in row header
 *   }
 *
 * Stored:
 *   [
 *     { _id: 'r1', label: 'GitHub', url: 'https://...' },
 *     { _id: 'r2', label: 'X',      url: 'https://...' },
 *   ]
 *
 * Each row carries a stable `_id` so React keys + dnd-kit don't lose
 * track during reorders. _id is generated on add and persisted with
 * the row.
 *
 * Sub-fields can be any registered control type — the row body uses
 * the same `controlComponents` registry as the top-level Inspector,
 * so adding a control type automatically makes it usable inside a
 * repeater.
 */

import { __ } from '@wordpress/i18n';
import { useEffect, useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import {
	DndContext,
	closestCenter,
	PointerSensor,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import {
	SortableContext,
	verticalListSortingStrategy,
	useSortable,
	arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { controlComponents } from './index';

/**
 * cheap-enough unique id. Crypto.randomUUID would be better but is
 * unsupported in some Playground / older Safari builds we still want to
 * cover. Collision risk on a single repeater is negligible.
 */
function newRowId() {
	return 'r' + Math.random().toString(36).slice(2, 10);
}

/**
 * Read `control.collapsedTitle` (a sub-field attributeKey) and pull the
 * matching value off the row. Falls back to the index-based "Item N"
 * label so empty rows are still identifiable.
 */
function rowTitle(row, control, index) {
	const key = control.collapsedTitle;
	if (key && typeof row?.[key] === 'string' && row[key].trim() !== '') {
		return row[key];
	}
	return `${__('Item', 'gcblite')} ${index + 1}`;
}

function SortableRow({
	row,
	index,
	control,
	isOpen,
	onToggle,
	onUpdate,
	onRemove,
	attributes: parentAttrs,
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: row._id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<div ref={setNodeRef} style={style} className="gcb-repeater-row">
			<div className="gcb-repeater-row__header">
				<button
					type="button"
					{...attributes}
					{...listeners}
					className="gcb-repeater-row__handle"
					aria-label={__('Drag to reorder', 'gcblite')}
					onClick={(e) => e.preventDefault()}
				>
					<svg viewBox="0 0 20 20" width="12" height="12">
						<path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
					</svg>
				</button>
				<button
					type="button"
					className="gcb-repeater-row__title"
					onClick={onToggle}
					aria-expanded={isOpen}
				>
					<span className="gcb-repeater-row__caret" aria-hidden>
						{isOpen ? '▾' : '▸'}
					</span>
					<span className="gcb-repeater-row__title-text">
						{rowTitle(row, control, index)}
					</span>
				</button>
				<button
					type="button"
					className="gcb-repeater-row__remove"
					onClick={onRemove}
					aria-label={__('Remove row', 'gcblite')}
				>
					<svg viewBox="0 0 24 24" width="16" height="16">
						<path d="M12 13.06l3.712 3.713 1.061-1.06L13.061 12l3.712-3.712-1.06-1.06L12 10.938 8.288 7.227l-1.061 1.06L10.939 12l-3.712 3.712 1.06 1.061L12 13.061z" />
					</svg>
				</button>
			</div>

			{isOpen && (
				<div className="gcb-repeater-row__body">
					{(control.fields || []).map((sub) => {
						const SubComponent = controlComponents[sub.type];
						if (!SubComponent) {
							return (
								<div
									key={sub.attributeKey}
									style={{ padding: 8, background: '#fff3cd', border: '1px solid #ffeeba', marginBottom: 8 }}
								>
									<strong>{sub.label}</strong>:{' '}
									{__('unknown control type', 'gcblite')}{' '}
									<code>{sub.type}</code>
								</div>
							);
						}
						return (
							<SubComponent
								key={sub.attributeKey}
								control={sub}
								value={row?.[sub.attributeKey]}
								onChange={(next) =>
									onUpdate({ ...row, [sub.attributeKey]: next })
								}
								attributes={parentAttrs}
							/>
						);
					})}
				</div>
			)}
		</div>
	);
}

export default function RepeaterField({ control, value, onChange, attributes }) {
	const rows = Array.isArray(value) ? value : [];
	const [openId, setOpenId] = useState(null);

	const min = typeof control.min === 'number' ? control.min : 0;
	const max =
		typeof control.max === 'number' && control.max > 0 ? control.max : null;
	const canAdd = max === null || rows.length < max;
	const canRemove = (i) => rows.length > min;

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
	);

	const handleDragEnd = (event) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		const oldIndex = rows.findIndex((r) => r._id === active.id);
		const newIndex = rows.findIndex((r) => r._id === over.id);
		if (oldIndex < 0 || newIndex < 0) return;
		onChange(arrayMove(rows, oldIndex, newIndex));
	};

	const addRow = () => {
		const fresh = { _id: newRowId() };
		(control.fields || []).forEach((sub) => {
			if (Object.prototype.hasOwnProperty.call(sub, 'default')) {
				fresh[sub.attributeKey] = sub.default;
			}
		});
		const next = [...rows, fresh];
		onChange(next);
		setOpenId(fresh._id);
	};

	const removeRow = (rowId) => {
		onChange(rows.filter((r) => r._id !== rowId));
		if (openId === rowId) setOpenId(null);
	};

	const updateRow = (rowId, nextRow) => {
		onChange(rows.map((r) => (r._id === rowId ? nextRow : r)));
	};

	// Lazy backfill: rows authored before this control existed (or
	// imported from an export) may lack a stable _id. Patch in an
	// effect (not during render) so reorders work without warning.
	useEffect(() => {
		if (rows.some((r) => !r || !r._id)) {
			onChange(rows.map((r) => (r && r._id ? r : { ...r, _id: newRowId() })));
		}
	}, [rows, onChange]);
	const normalizedRows = rows.map((r) =>
		r && r._id ? r : { ...r, _id: 'pending-' + Math.random() }
	);

	return (
		<div className="components-base-control gcb-repeater-control">
			{control.label && (
				<label className="components-base-control__label">
					{control.label}
				</label>
			)}
			{control.helpText && (
				<p className="components-base-control__help">{control.helpText}</p>
			)}

			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={handleDragEnd}
			>
				<SortableContext
					items={normalizedRows.map((r) => r._id)}
					strategy={verticalListSortingStrategy}
				>
					<div className="gcb-repeater-rows">
						{normalizedRows.map((row, index) => (
							<SortableRow
								key={row._id}
								row={row}
								index={index}
								control={control}
								isOpen={openId === row._id}
								onToggle={() =>
									setOpenId(openId === row._id ? null : row._id)
								}
								onUpdate={(next) => updateRow(row._id, next)}
								onRemove={() =>
									canRemove(index) ? removeRow(row._id) : null
								}
								attributes={attributes}
							/>
						))}
					</div>
				</SortableContext>
			</DndContext>

			{canAdd && (
				<Button
					variant="secondary"
					onClick={addRow}
					className="gcb-repeater__add"
				>
					{control.addButtonLabel || __('Add item', 'gcblite')}
				</Button>
			)}
		</div>
	);
}
