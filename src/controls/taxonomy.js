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
	TextControl,
} from '@wordpress/components';
import PopoverOrModal from './PopoverOrModal';
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

// Normalise whatever the value used to look like into the canonical
// { taxonomy, ids[] } shape. Handles:
//   - bare ID (legacy single)             → { taxonomy: schemaDefault, ids: [3] }
//   - array of IDs (legacy multi)         → { taxonomy: schemaDefault, ids: [3, 5] }
//   - { id, name, taxonomy } (returnFormat=object, single)
//   - array of those objects (returnFormat=object, multi)
//   - new canonical { taxonomy, ids[] }   → passes through
function normaliseTaxonomyValue(value, schemaDefault) {
	if (!value) return { taxonomy: schemaDefault, ids: [] };
	// Already canonical.
	if (typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.ids)) {
		return { taxonomy: value.taxonomy || schemaDefault, ids: value.ids };
	}
	// Bare scalar (legacy single).
	if (typeof value === 'number' || typeof value === 'string') {
		return { taxonomy: schemaDefault, ids: [Number(value)] };
	}
	// Single object (returnFormat=object).
	if (typeof value === 'object' && !Array.isArray(value) && value.id != null) {
		return { taxonomy: value.taxonomy || schemaDefault, ids: [Number(value.id)] };
	}
	// Array shapes.
	if (Array.isArray(value)) {
		const ids = value
			.map((entry) => typeof entry === 'object' ? Number(entry.id) : Number(entry))
			.filter(Boolean);
		const tx = value.find((entry) => typeof entry === 'object' && entry?.taxonomy)?.taxonomy;
		return { taxonomy: tx || schemaDefault, ids };
	}
	return { taxonomy: schemaDefault, ids: [] };
}

const REST_BASE_OVERRIDES = { category: 'categories', post_tag: 'tags' };
function resolveRestBase(taxonomy, override) {
	if (override) return override;
	return REST_BASE_OVERRIDES[taxonomy] || taxonomy;
}

export default function TaxonomyField({ control, value, onChange }) {
	const [allTerms, setAllTerms] = useState([]);
	const [searchResults, setSearchResults] = useState([]);
	const [loading, setLoading] = useState(false);
	const [search, setSearch] = useState('');
	const [creatingTerm, setCreatingTerm] = useState(false);
	const [newTermName, setNewTermName] = useState('');
	const [activeId, setActiveId] = useState(null);
	const [availableTaxonomies, setAvailableTaxonomies] = useState([]);

	const isMultiple = control.multiple !== false;
	// Schema-locked vs author-picks-at-edit-time.
	// When the schema omits `taxonomy`, the editor user picks via a
	// dropdown. The picked value is stored alongside the IDs so the
	// renderer can still resolve them at read-time.
	const dynamic = !control.taxonomy;
	const schemaDefault = control.taxonomy || 'category';

	// Canonical { taxonomy, ids[] } shape.
	const normalised = useMemo(
		() => normaliseTaxonomyValue(value, schemaDefault),
		[value, schemaDefault]
	);
	const taxonomy = normalised.taxonomy || schemaDefault;
	const selectedIds = normalised.ids;

	const restBase = resolveRestBase(taxonomy, control.restBase);

	const selectedTerms = useMemo(
		() => selectedIds.map((id) => allTerms.find((t) => t.id === id)).filter(Boolean),
		[selectedIds, allTerms]
	);

	// Fetch the list of registered taxonomies once, only when the schema
	// didn't lock to one. Used to populate the taxonomy dropdown.
	useEffect(() => {
		if (!dynamic) return;
		let cancelled = false;
		apiFetch({ path: '/wp/v2/taxonomies?context=view' })
			.then((res) => {
				if (cancelled) return;
				// REST returns an object keyed by taxonomy slug.
				const list = Object.entries(res || {}).map(([slug, info]) => ({
					slug,
					name: info?.name || slug,
					restBase: info?.rest_base || slug,
				}));
				setAvailableTaxonomies(list);
			})
			.catch(() => {});
		return () => { cancelled = true; };
	}, [dynamic]);

	// Emit the canonical shape — always { taxonomy, ids[] }, regardless
	// of single/multi, so the renderer never has to guess.
	const emitChange = useCallback((ids) => {
		onChange({ taxonomy, ids });
	}, [onChange, taxonomy]);

	const handleTaxonomyChange = (newTax) => {
		// Switching taxonomy clears the selected terms — IDs from one
		// taxonomy don't translate to another.
		onChange({ taxonomy: newTax, ids: [] });
		setAllTerms([]);
		setSearchResults([]);
	};

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
				path: `/wp/v2/${restBase}?search=${encodeURIComponent(term)}&per_page=100&_fields=id,name`,
			});
			setSearchResults(response);
			mergeTermsIntoCache(response);
		} catch {
			// ignore
		}
		setLoading(false);
	}, [restBase, mergeTermsIntoCache]);

	useEffect(() => {
		loadTerms();
	}, [loadTerms]);

	const handleSelect = (termId) => {
		const newIds = isMultiple
			? (selectedIds.includes(termId)
				? selectedIds.filter((id) => id !== termId)
				: [...selectedIds, termId])
			: [termId];
		emitChange(newIds);
	};

	const handleRemove = (termId) => {
		emitChange(selectedIds.filter((id) => id !== termId));
	};

	const handleReorder = (newOrder) => {
		emitChange(newOrder);
	};

	const handleClear = () => emitChange([]);

	const handleCreateTerm = async () => {
		if (!newTermName.trim() || !control.allowCreateTerms) return;
		setCreatingTerm(true);
		try {
			const newTerm = await apiFetch({
				path: `/wp/v2/${restBase}`,
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
				{dynamic && (
					<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
						<label style={{ fontSize: 12, fontWeight: 600, color: '#1e1e1e', minWidth: 70 }}>
							{__('Taxonomy', 'gcblite')}
						</label>
						<select
							value={taxonomy}
							onChange={(e) => handleTaxonomyChange(e.target.value)}
							style={{
								flex: 1,
								padding: '6px 8px',
								border: '1px solid #8c8f94',
								borderRadius: 4,
								fontSize: 13,
								background: '#fff',
							}}
						>
							{availableTaxonomies.length === 0 && (
								<option value={taxonomy}>{taxonomy}</option>
							)}
							{availableTaxonomies.map((tx) => (
								<option key={tx.slug} value={tx.slug}>
									{tx.name} ({tx.slug})
								</option>
							))}
						</select>
					</div>
				)}
				<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					<PopoverOrModal
						modalTitle={control.label || __('Select terms', 'gcblite')}
						dropdownProps={{ popoverProps: { placement: 'left-start' } }}
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
						renderContent={({ close: onClose, variant }) => (
							<div style={variant === 'modal' ? { width: '100%' } : { minWidth: 320, maxWidth: 400 }}>
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
