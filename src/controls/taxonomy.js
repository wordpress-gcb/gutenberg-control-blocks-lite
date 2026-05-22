/**
 * TaxonomyField — ported verbatim from the original GCB.
 *
 * Single OR multiple term selection (control.multiple, default true).
 * Stored as ID(s) or full term object(s) (control.returnFormat).
 * Optional "create new term" UI (control.allowCreateTerms).
 * Drag-and-drop reordering of selected terms (multi-select only).
 */

import { __ } from '@wordpress/i18n';
import {
	Button,
	Dropdown,
	TextControl,
} from '@wordpress/components';
import { useState, useEffect, useMemo, useCallback } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
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

const TOGGLE_BUTTON_STYLE = {
	width: '100%',
	height: 'auto',
	padding: '12px',
	justifyContent: 'flex-start',
	border: '1px solid #ddd',
	borderRadius: '2px',
	backgroundColor: '#fff',
};

function TermIcon() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" style={{ marginRight: 8, flexShrink: 0, opacity: 0.6 }}>
			<path d="M8 12c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2zm8-2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
			<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
		</svg>
	);
}

function SortableTermItem({ term, onRemove }) {
	const {
		attributes: dndAttributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: term.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className="gcb-post-object-selected-item"
			{...dndAttributes}
			{...listeners}
		>
			<div className="gcb-post-object-drag-handle" aria-hidden>
				<svg viewBox="0 0 20 20" width="12">
					<path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
				</svg>
			</div>
			<TermIcon />
			<span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'none' }}>
				{term.name || __('(no name)', 'gcblite')}
			</span>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onRemove(term.id);
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

export default function TaxonomyField({ control, value, onChange }) {
	const [allTerms, setAllTerms] = useState([]);
	const [searchResults, setSearchResults] = useState([]);
	const [loading, setLoading] = useState(false);
	const [search, setSearch] = useState('');
	const [creatingTerm, setCreatingTerm] = useState(false);
	const [newTermName, setNewTermName] = useState('');
	const [activeId, setActiveId] = useState(null);

	const isMultiple = control.multiple !== false;
	const taxonomy = control.taxonomy || 'category';

	const selectedIds = isMultiple
		? (Array.isArray(value) ? value : (value ? [value] : []))
		: (value ? [value] : []);

	const selectedTerms = useMemo(
		() => selectedIds.map((id) => allTerms.find((t) => t.id === id)).filter(Boolean),
		[selectedIds, allTerms]
	);

	const mergeTermsIntoCache = useCallback((newTerms) => {
		setAllTerms((prev) => {
			const merged = [...prev];
			newTerms.forEach((nt) => {
				if (!merged.find((t) => t.id === nt.id)) merged.push(nt);
			});
			return merged;
		});
	}, []);

	const loadTerms = useCallback(async (term = '') => {
		setLoading(true);
		try {
			const response = await apiFetch({
				path: `/wp/v2/${taxonomy}?search=${encodeURIComponent(term)}&per_page=100&_fields=id,name`,
			});
			setSearchResults(response);
			mergeTermsIntoCache(response);
		} catch {
			// ignore
		}
		setLoading(false);
	}, [taxonomy, mergeTermsIntoCache]);

	useEffect(() => {
		loadTerms();
	}, [loadTerms]);

	const handleSelect = (termId) => {
		const newIds = isMultiple
			? (selectedIds.includes(termId)
				? selectedIds.filter((id) => id !== termId)
				: [...selectedIds, termId])
			: [termId];

		if (control.returnFormat === 'object') {
			const objs = newIds.map((id) => allTerms.find((t) => t.id === id)).filter(Boolean);
			onChange(isMultiple ? objs : (objs[0] || null));
		} else {
			onChange(isMultiple ? newIds : (newIds[0] || null));
		}
	};

	const handleRemove = (termId) => {
		const newIds = selectedIds.filter((id) => id !== termId);
		if (control.returnFormat === 'object') {
			const objs = newIds.map((id) => allTerms.find((t) => t.id === id)).filter(Boolean);
			onChange(isMultiple ? objs : (objs[0] || null));
		} else {
			onChange(isMultiple ? newIds : (newIds[0] || null));
		}
	};

	const handleReorder = (newOrder) => {
		if (control.returnFormat === 'object') {
			onChange(newOrder.map((id) => allTerms.find((t) => t.id === id)).filter(Boolean));
		} else {
			onChange(newOrder);
		}
	};

	const handleClear = () => onChange(isMultiple ? [] : null);

	const handleCreateTerm = async () => {
		if (!newTermName.trim() || !control.allowCreateTerms) return;
		setCreatingTerm(true);
		try {
			const newTerm = await apiFetch({
				path: `/wp/v2/${taxonomy}`,
				method: 'POST',
				data: { name: newTermName.trim() },
			});
			mergeTermsIntoCache([newTerm]);
			setSearchResults((prev) => [...prev, newTerm]);
			handleSelect(newTerm.id);
			setNewTermName('');
		} catch {
			// ignore
		}
		setCreatingTerm(false);
	};

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

	const handleDragStart = (e) => setActiveId(e.active.id);
	const handleDragCancel = () => setActiveId(null);
	const handleDragEnd = (e) => {
		const { active, over } = e;
		if (over && active.id !== over.id) {
			const oldIndex = selectedIds.indexOf(active.id);
			const newIndex = selectedIds.indexOf(over.id);
			handleReorder(arrayMove(selectedIds, oldIndex, newIndex));
		}
		setActiveId(null);
	};

	const activeTerm = activeId ? selectedTerms.find((t) => t.id === activeId) : null;
	const availableTerms = searchResults.filter((t) => !selectedIds.includes(t.id));

	return (
		<div className="components-base-control gcb-taxonomy-control">
			<div className="components-base-control__field">
				<label className="components-base-control__label">{control.label}</label>
			</div>
			{control.helpText && (
				<p className="components-base-control__help">{control.helpText}</p>
			)}

			<div className="gcb-post-object-stacked">
				<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					<Dropdown
						popoverProps={{ placement: 'left-start' }}
						renderToggle={({ isOpen, onToggle }) => (
							<Button
								onClick={onToggle}
								aria-expanded={isOpen}
								className="gcb-modal-toggle-button"
								style={{ ...TOGGLE_BUTTON_STYLE, flex: 1 }}
							>
								{selectedTerms.length > 0
									? `${selectedTerms.length} ${selectedTerms.length === 1 ? __('term', 'gcblite') : __('terms', 'gcblite')} ${__('selected', 'gcblite')}`
									: __('Select Terms', 'gcblite')}
							</Button>
						)}
						renderContent={({ onClose }) => (
							<div style={{ minWidth: 320, maxWidth: 400 }}>
								<div style={{ padding: '8px 8px 0 8px', display: 'flex', justifyContent: 'flex-end' }}>
									<Button
										icon={(
											<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
												<path d="M13 11.8l6.1-6.3-1-1-6.1 6.2-6.1-6.2-1 1 6.1 6.3-6.5 6.7 1 1 6.5-6.6 6.5 6.6 1-1z" />
											</svg>
										)}
										onClick={onClose}
										label={__('Close', 'gcblite')}
										isSmall
									/>
								</div>
								<div style={{ padding: '0 16px 8px 16px' }}>
									<TextControl
										value={search}
										onChange={(val) => {
											setSearch(val);
											loadTerms(val);
										}}
										placeholder={__('Search…', 'gcblite')}
										__nextHasNoMarginBottom
									/>

									{control.allowCreateTerms && (
										<div style={{ marginTop: 12, padding: 12, background: '#f0f6fc', borderRadius: 4 }}>
											<TextControl
												label={__('Create New Term', 'gcblite')}
												value={newTermName}
												onChange={setNewTermName}
												placeholder={__('Enter term name…', 'gcblite')}
												disabled={creatingTerm}
												__nextHasNoMarginBottom
											/>
											<Button
												variant="primary"
												size="small"
												onClick={handleCreateTerm}
												disabled={!newTermName.trim() || creatingTerm}
												style={{ marginTop: 8 }}
											>
												{creatingTerm ? __('Creating…', 'gcblite') : __('Create', 'gcblite')}
											</Button>
										</div>
									)}
								</div>

								<div className="block-editor-link-control__search-results-wrapper" style={{ maxHeight: 300, overflowY: 'auto' }}>
									{loading && (
										<p style={{ textAlign: 'center', color: '#757575', padding: 16 }}>
											{__('Loading…', 'gcblite')}
										</p>
									)}
									{!loading && availableTerms.length === 0 && (
										<p style={{ textAlign: 'center', color: '#757575', padding: 16 }}>
											{__('No terms found', 'gcblite')}
										</p>
									)}
									{!loading && availableTerms.length > 0 && (
										<div className="block-editor-link-control__search-results" role="listbox">
											<div className="components-menu-group">
												<div role="group">
													{availableTerms.map((term) => (
														<button
															key={term.id}
															type="button"
															role="option"
															className="components-button components-menu-item__button block-editor-link-control__search-item"
															onClick={() => handleSelect(term.id)}
															style={{
																display: 'flex',
																alignItems: 'center',
																width: '100%',
																padding: '8px 16px',
																textAlign: 'left',
																border: 'none',
																background: 'transparent',
																justifyContent: 'space-between',
															}}
														>
															<span style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
																<TermIcon />
																<span className="components-menu-item__item" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
																	{term.name}
																</span>
															</span>
														</button>
													))}
												</div>
											</div>
										</div>
									)}
								</div>
							</div>
						)}
					/>

					{selectedTerms.length > 0 && (
						<Button
							onClick={handleClear}
							variant="secondary"
							isSmall
							className="components-range-control__reset"
						>
							{__('Reset', 'gcblite')}
						</Button>
					)}
				</div>

				{selectedTerms.length > 0 && isMultiple && (
					<div className="gcb-post-object-selected-list" style={{ marginTop: 8 }}>
						<DndContext
							sensors={sensors}
							collisionDetection={closestCenter}
							onDragStart={handleDragStart}
							onDragEnd={handleDragEnd}
							onDragCancel={handleDragCancel}
						>
							<SortableContext items={selectedIds} strategy={verticalListSortingStrategy}>
								{selectedTerms.map((term) => (
									<SortableTermItem key={term.id} term={term} onRemove={handleRemove} />
								))}
							</SortableContext>
							<DragOverlay>
								{activeTerm ? (
									<div className="gcb-post-object-selected-item" style={{ opacity: 0.8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
										<div className="gcb-post-object-drag-handle" aria-hidden>
											<svg viewBox="0 0 20 20" width="12">
												<path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
											</svg>
										</div>
										<TermIcon />
										<span style={{ flex: 1 }}>{activeTerm.name}</span>
									</div>
								) : null}
							</DragOverlay>
						</DndContext>
					</div>
				)}

				{selectedTerms.length > 0 && !isMultiple && (
					<div className="gcb-post-object-selected-list" style={{ marginTop: 8 }}>
						<div className="gcb-post-object-selected-item">
							<TermIcon />
							<span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
								{selectedTerms[0].name}
							</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
