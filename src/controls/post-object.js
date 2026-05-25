/**
 * PostObjectField — ported verbatim from the original GCB PostObjectControlComponent.
 *
 * Features preserved:
 *   - Single OR multiple selection (control.multiple)
 *   - Stored as ID(s) or full post object(s) (control.returnFormat)
 *   - Multiple post types (CSV string or array)
 *   - Multiple post statuses
 *   - Optional taxonomy filter dropdowns (control.enableTaxonomyFilter / filterTaxonomies)
 *   - Optional post-type filter dropdown (control.enablePostTypeFilter)
 *   - Drag-and-drop reordering of selected posts (multi-select only)
 *   - REST endpoint discovery via /wp/v2/types
 */

import { __ } from '@wordpress/i18n';
import {
	Button,
	SelectControl,
	TextControl,
	__experimentalTruncate as Truncate,
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

/**
 * Sortable selected-post row.
 */
function SortablePostItem({ post, onRemove }) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: post.id });

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
			{...attributes}
			{...listeners}
		>
			<div className="gcb-post-object-drag-handle" aria-hidden>
				<svg viewBox="0 0 20 20" width="12">
					<path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
				</svg>
			</div>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" style={{ marginRight: 8, flexShrink: 0, opacity: 0.6 }}>
				<path d="M15.5 7.5h-7V9h7V7.5Zm-7 3.5h7v1.5h-7V11Zm7 3.5h-7V16h7v-1.5Z" />
				<path d="M17 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2ZM7 5.5h10a.5.5 0 0 1 .5.5v12a.5.5 0 0 1-.5.5H7a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5Z" />
			</svg>
			<span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'none' }}>
				{post.title?.rendered || __('(no title)', 'gcblite')}
			</span>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onRemove(post.id);
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

/**
 * The multi-select panel — search dropdown plus a sortable list of selected posts.
 */
function PostObjectMultiSelect({
	posts,
	selectedIds,
	selectedPosts,
	loading,
	search,
	setSearch,
	loadPosts,
	handleSelect,
	handleRemove,
	handleReorder,
	handleClear,
	control,
	postTypeFilter,
	setPostTypeFilter,
	availablePostTypes,
}) {
	const [activeId, setActiveId] = useState(null);
	const [taxonomyTermsBySlug, setTaxonomyTermsBySlug] = useState({});
	const [loadingTaxonomies, setLoadingTaxonomies] = useState(false);
	const [taxonomyFilters, setTaxonomyFilters] = useState({});

	useEffect(() => {
		if (!control.enableTaxonomyFilter || !Array.isArray(control.filterTaxonomies) || control.filterTaxonomies.length === 0) {
			return;
		}
		setLoadingTaxonomies(true);
		const promises = control.filterTaxonomies.map((tax) =>
			apiFetch({ path: `/wp/v2/${tax.slug}?per_page=100` })
				.then((terms) => ({
					slug: tax.slug,
					label: tax.label,
					terms: terms.map((t) => ({ value: t.id, label: t.name })),
				}))
				.catch(() => ({ slug: tax.slug, label: tax.label, terms: [] }))
		);
		Promise.all(promises)
			.then((results) => {
				const map = {};
				const initialFilters = {};
				results.forEach((r) => {
					map[r.slug] = { label: r.label, terms: r.terms };
					initialFilters[r.slug] = 'all';
				});
				setTaxonomyTermsBySlug(map);
				setTaxonomyFilters(initialFilters);
			})
			.finally(() => setLoadingTaxonomies(false));
	}, [control.enableTaxonomyFilter, control.filterTaxonomies]);

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

	const handleDragStart = (event) => setActiveId(event.active.id);
	const handleDragCancel = () => setActiveId(null);

	const handleDragEnd = (event) => {
		const { active, over } = event;
		if (over && active.id !== over.id) {
			const oldIndex = selectedIds.indexOf(active.id);
			const newIndex = selectedIds.indexOf(over.id);
			handleReorder(arrayMove(selectedIds, oldIndex, newIndex));
		}
		setActiveId(null);
	};

	const activePost = activeId ? selectedPosts.find((p) => p.id === activeId) : null;
	const availablePosts = posts.filter((p) => !selectedIds.includes(p.id));

	return (
		<div className="gcb-post-object-stacked">
			<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
				<PopoverOrModal
					modalTitle={control.label || __('Select posts', 'gcblite')}
					dropdownProps={{ popoverProps: { placement: 'left-start' } }}
					renderToggle={({ isOpen, onToggle }) => (
						<Button
							onClick={onToggle}
							aria-expanded={isOpen}
							className="gcb-modal-toggle-button"
							style={{ ...TOGGLE_BUTTON_STYLE, flex: 1 }}
						>
							{selectedPosts.length > 0
								? `${selectedPosts.length} ${selectedPosts.length === 1 ? __('post', 'gcblite') : __('posts', 'gcblite')} ${__('selected', 'gcblite')}`
								: __('Select Posts', 'gcblite')}
						</Button>
					)}
					renderContent={({ close: onClose, variant }) => (
						<div style={variant === 'modal' ? { width: '100%' } : { minWidth: 320, maxWidth: 400 }}>
<div style={{ padding: '0 16px 8px 16px' }}>
								<TextControl
									value={search}
									onChange={(val) => {
										setSearch(val);
										loadPosts(val, postTypeFilter, taxonomyFilters);
									}}
									placeholder={__('Search…', 'gcblite')}
									__nextHasNoMarginBottom
								/>

								{control.enablePostTypeFilter && availablePostTypes.length > 1 && (
									<div style={{ marginTop: 8 }}>
										<SelectControl
											label={__('Filter by Post Type', 'gcblite')}
											value={postTypeFilter}
											options={[
												{ value: 'all', label: __('All Types', 'gcblite') },
												...availablePostTypes,
											]}
											onChange={(val) => {
												setPostTypeFilter(val);
												loadPosts(search, val, taxonomyFilters);
											}}
											__nextHasNoMarginBottom
										/>
									</div>
								)}

								{control.enableTaxonomyFilter && Object.keys(taxonomyTermsBySlug).length > 0 &&
									Object.entries(taxonomyTermsBySlug).map(([slug, data]) => (
										<div key={slug} style={{ marginTop: 8 }}>
											<SelectControl
												label={__('Filter by ', 'gcblite') + data.label}
												value={taxonomyFilters[slug] || 'all'}
												options={[
													{ value: 'all', label: __('All', 'gcblite') },
													...data.terms,
												]}
												onChange={(val) => {
													const newFilters = { ...taxonomyFilters, [slug]: val };
													setTaxonomyFilters(newFilters);
													loadPosts(search, postTypeFilter, newFilters);
												}}
												disabled={loadingTaxonomies}
												__nextHasNoMarginBottom
											/>
										</div>
									))}
							</div>

							<div className="block-editor-link-control__search-results-wrapper" style={{ maxHeight: 300, overflowY: 'auto' }}>
								{loading && (
									<p style={{ textAlign: 'center', color: '#757575', padding: 16 }}>
										{__('Loading…', 'gcblite')}
									</p>
								)}
								{!loading && availablePosts.length === 0 && (
									<p style={{ textAlign: 'center', color: '#757575', padding: 16 }}>
										{__('No posts found', 'gcblite')}
									</p>
								)}
								{!loading && availablePosts.length > 0 && (
									<div className="block-editor-link-control__search-results" role="listbox">
										<div className="components-menu-group">
											<div role="group">
												{availablePosts.map((post) => (
													<button
														key={post.id}
														type="button"
														role="option"
														className="components-button components-menu-item__button block-editor-link-control__search-item"
														onClick={() => handleSelect(post.id)}
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
															<svg
																xmlns="http://www.w3.org/2000/svg"
																viewBox="0 0 24 24"
																width="24"
																height="24"
																className="block-editor-link-control__search-item-icon"
																style={{ marginRight: 12, flexShrink: 0 }}
															>
																<path d="M15.5 7.5h-7V9h7V7.5Zm-7 3.5h7v1.5h-7V11Zm7 3.5h-7V16h7v-1.5Z" />
																<path d="M17 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2ZM7 5.5h10a.5.5 0 0 1 .5.5v12a.5.5 0 0 1-.5.5H7a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5Z" />
															</svg>
															<span
																className="components-menu-item__item"
																style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
															>
																{post.title?.rendered || __('(no title)', 'gcblite')}
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

				{selectedPosts.length > 0 && (
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

			{selectedPosts.length > 0 && (
				<div className="gcb-post-object-selected-list" style={{ marginTop: 8 }}>
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragStart={handleDragStart}
						onDragEnd={handleDragEnd}
						onDragCancel={handleDragCancel}
					>
						<SortableContext items={selectedIds} strategy={verticalListSortingStrategy}>
							{selectedPosts.map((post) => (
								<SortablePostItem key={post.id} post={post} onRemove={handleRemove} />
							))}
						</SortableContext>
						<DragOverlay>
							{activePost ? (
								<div
									className="gcb-post-object-selected-item"
									style={{ opacity: 0.8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
								>
									<div className="gcb-post-object-drag-handle" aria-hidden>
										<svg viewBox="0 0 20 20" width="12">
											<path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
										</svg>
									</div>
									<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" style={{ marginRight: 8, flexShrink: 0, opacity: 0.6 }}>
										<path d="M15.5 7.5h-7V9h7V7.5Zm-7 3.5h7v1.5h-7V11Zm7 3.5h-7V16h7v-1.5Z" />
										<path d="M17 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2ZM7 5.5h10a.5.5 0 0 1 .5.5v12a.5.5 0 0 1-.5.5H7a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5Z" />
									</svg>
									<span style={{ flex: 1 }}>
										{activePost.title?.rendered || __('(no title)', 'gcblite')}
									</span>
								</div>
							) : null}
						</DragOverlay>
					</DndContext>
				</div>
			)}
		</div>
	);
}

export default function PostObjectField({ control, value, onChange }) {
	const [allPosts, setAllPosts] = useState([]);
	const [searchResults, setSearchResults] = useState([]);
	const [loading, setLoading] = useState(false);
	const [search, setSearch] = useState('');
	const [postTypeFilter, setPostTypeFilter] = useState('all');
	const [postTypeEndpoints, setPostTypeEndpoints] = useState({});

	const availablePostTypes = useMemo(() => {
		if (!control.postType) return [{ value: 'post', label: 'Posts' }];
		const types = typeof control.postType === 'string'
			? control.postType.split(',').map((pt) => pt.trim()).filter(Boolean)
			: Array.isArray(control.postType) ? control.postType : ['post'];
		return types.map((type) => ({
			value: type,
			label: type.charAt(0).toUpperCase() + type.slice(1) + 's',
		}));
	}, [control.postType]);

	useEffect(() => {
		(async () => {
			try {
				const types = await apiFetch({ path: '/wp/v2/types' });
				const endpoints = {};
				Object.keys(types).forEach((key) => {
					endpoints[key] = types[key].rest_base || key;
				});
				setPostTypeEndpoints(endpoints);
			} catch {
				setPostTypeEndpoints({ post: 'posts', page: 'pages', media: 'media', attachment: 'media' });
			}
		})();
	}, []);

	const isMultiple = !!control.multiple;
	const selectedIds = isMultiple
		? (Array.isArray(value)
			? (control.returnFormat === 'object' ? value.map((v) => v?.id).filter(Boolean) : value)
			: (value ? [value] : []))
		: null;
	const singleSelectedId = !isMultiple
		? (control.returnFormat === 'object' && value && typeof value === 'object' ? value.id : value)
		: null;

	const mergePostsIntoCache = useCallback((newPosts) => {
		setAllPosts((prev) => {
			const merged = [...prev];
			newPosts.forEach((np) => {
				if (!merged.find((p) => p.id === np.id)) merged.push(np);
			});
			return merged;
		});
	}, []);

	const selectedPosts = useMemo(() => {
		if (isMultiple) {
			return selectedIds.map((id) => allPosts.find((p) => p.id === id)).filter(Boolean);
		}
		return allPosts.find((p) => p.id === singleSelectedId) || null;
	}, [allPosts, selectedIds, singleSelectedId, isMultiple]);

	const loadPosts = useCallback(async (searchTerm = '', filterPostType = 'all', taxFilters = {}) => {
		setLoading(true);
		try {
			let postTypes = control.postType;
			if (!postTypes || postTypes === '') {
				postTypes = ['post'];
			} else if (typeof postTypes === 'string') {
				postTypes = postTypes.split(',').map((pt) => pt.trim()).filter(Boolean);
				if (postTypes.length === 0) postTypes = ['post'];
			} else if (!Array.isArray(postTypes)) {
				postTypes = ['post'];
			}
			if (filterPostType !== 'all') postTypes = [filterPostType];

			let postStatuses = control.postStatus;
			if (!postStatuses || postStatuses === '') {
				postStatuses = ['publish'];
			} else if (typeof postStatuses === 'string') {
				postStatuses = postStatuses.split(',').map((s) => s.trim()).filter(Boolean);
				if (postStatuses.length === 0) postStatuses = ['publish'];
			} else if (!Array.isArray(postStatuses)) {
				postStatuses = ['publish'];
			}

			if (Object.keys(postTypeEndpoints).length === 0) {
				setLoading(false);
				return;
			}

			const collected = [];
			for (const postType of postTypes) {
				try {
					const endpoint = postTypeEndpoints[postType] || postType;
					let statusParam = 'publish';
					if (postStatuses.length > 1 || (postStatuses.length === 1 && postStatuses[0] !== 'publish')) {
						statusParam = 'any';
					} else if (postStatuses.length === 1) {
						statusParam = postStatuses[0];
					}
					const fields = postStatuses.length > 1 ? 'id,title,type,status' : 'id,title,type';
					let query = `search=${searchTerm}&per_page=50&_fields=${fields}&status=${statusParam}`;

					if (taxFilters && typeof taxFilters === 'object') {
						Object.entries(taxFilters).forEach(([slug, termId]) => {
							if (termId !== 'all') query += `&${slug}=${termId}`;
						});
					}

					if (control.taxonomy && control.taxonomyTerms) {
						const taxonomies = typeof control.taxonomy === 'string'
							? control.taxonomy.split(',').map((t) => t.trim()).filter(Boolean)
							: [control.taxonomy];
						taxonomies.forEach((tax) => {
							query += `&${tax}=${control.taxonomyTerms}`;
						});
					}

					const response = await apiFetch({ path: `/wp/v2/${endpoint}?${query}` });
					if (Array.isArray(response)) {
						if (postStatuses.length > 1 && statusParam === 'any') {
							collected.push(...response.filter((post) => postStatuses.includes(post.status)));
						} else {
							collected.push(...response);
						}
					}
				} catch {
					// ignore per-type errors; continue
				}
			}

			const unique = collected.filter((post, i, self) => i === self.findIndex((p) => p.id === post.id));
			setSearchResults(unique);
			mergePostsIntoCache(unique);
		} catch {
			// ignore
		}
		setLoading(false);
	}, [control.postType, control.postStatus, control.taxonomy, control.taxonomyTerms, mergePostsIntoCache, postTypeEndpoints]);

	useEffect(() => {
		loadPosts();
	}, [loadPosts]);

	const handleSelect = (postId) => {
		if (isMultiple) {
			const newIds = selectedIds.includes(postId)
				? selectedIds.filter((id) => id !== postId)
				: [...selectedIds, postId];
			if (control.returnFormat === 'object') {
				onChange(newIds.map((id) => allPosts.find((p) => p.id === id)).filter(Boolean));
			} else {
				onChange(newIds);
			}
		} else {
			if (control.returnFormat === 'object') {
				onChange(allPosts.find((p) => p.id === postId) || null);
			} else {
				onChange(postId);
			}
		}
	};

	const handleRemove = (postId) => {
		if (!isMultiple) return;
		const newIds = selectedIds.filter((id) => id !== postId);
		if (control.returnFormat === 'object') {
			onChange(newIds.map((id) => allPosts.find((p) => p.id === id)).filter(Boolean));
		} else {
			onChange(newIds);
		}
	};

	const handleReorder = (newOrder) => {
		if (control.returnFormat === 'object') {
			onChange(newOrder.map((id) => allPosts.find((p) => p.id === id)).filter(Boolean));
		} else {
			onChange(newOrder);
		}
	};

	const handleClear = () => onChange(isMultiple ? [] : null);

	const getDisplayText = () => {
		if (isMultiple) {
			return selectedPosts.length > 0
				? `${selectedPosts.length} ${__('selected', 'gcblite')}`
				: __('Select Posts', 'gcblite');
		}
		return selectedPosts?.title?.rendered || __('Select Post', 'gcblite');
	};

	return (
		<div className="components-base-control gcb-post-object-control">
			<div className="components-base-control__field">
				<label className="components-base-control__label">{control.label}</label>
			</div>
			{control.helpText && (
				<p className="components-base-control__help">{control.helpText}</p>
			)}

			{isMultiple ? (
				<PostObjectMultiSelect
					posts={searchResults}
					selectedIds={selectedIds}
					selectedPosts={selectedPosts}
					loading={loading}
					search={search}
					setSearch={setSearch}
					loadPosts={loadPosts}
					handleSelect={handleSelect}
					handleRemove={handleRemove}
					handleReorder={handleReorder}
					handleClear={handleClear}
					control={control}
					postTypeFilter={postTypeFilter}
					setPostTypeFilter={setPostTypeFilter}
					availablePostTypes={availablePostTypes}
				/>
			) : (
				<PopoverOrModal
					modalTitle={control.label || __('Select a post', 'gcblite')}
					dropdownProps={{ popoverProps: { placement: 'left-start' } }}
					renderToggle={({ isOpen, onToggle }) => (
						<Button
							onClick={onToggle}
							aria-expanded={isOpen}
							className="gcb-modal-toggle-button"
							style={TOGGLE_BUTTON_STYLE}
						>
							<Truncate numberOfLines={1}>{getDisplayText()}</Truncate>
						</Button>
					)}
					renderContent={({ close: onClose, variant }) => (
						<div style={variant === 'modal' ? { width: '100%' } : { minWidth: 320, maxWidth: 400 }}>
<div style={{ padding: '0 16px 8px 16px' }}>
								<TextControl
									value={search}
									onChange={(val) => {
										setSearch(val);
										loadPosts(val);
									}}
									placeholder={__('Search or type title', 'gcblite')}
									__nextHasNoMarginBottom
								/>
							</div>

							<div className="block-editor-link-control__search-results-wrapper" style={{ maxHeight: 300, overflowY: 'auto' }}>
								{loading && (
									<p style={{ textAlign: 'center', color: '#757575', padding: 16 }}>
										{__('Loading…', 'gcblite')}
									</p>
								)}
								{!loading && searchResults.length === 0 && (
									<p style={{ textAlign: 'center', color: '#757575', padding: 16 }}>
										{__('No posts found', 'gcblite')}
									</p>
								)}
								{!loading && searchResults.length > 0 && (
									<div className="block-editor-link-control__search-results" role="listbox">
										<div className="components-menu-group">
											<div role="group">
												{searchResults.map((post) => {
													const isSelected = singleSelectedId === post.id;
													return (
														<button
															key={post.id}
															type="button"
															role="option"
															className="components-button components-menu-item__button block-editor-link-control__search-item"
															onClick={() => handleSelect(post.id)}
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
																<svg
																	xmlns="http://www.w3.org/2000/svg"
																	viewBox="0 0 24 24"
																	width="24"
																	height="24"
																	className="block-editor-link-control__search-item-icon"
																	style={{ marginRight: 12, flexShrink: 0 }}
																>
																	<path d="M15.5 7.5h-7V9h7V7.5Zm-7 3.5h7v1.5h-7V11Zm7 3.5h-7V16h7v-1.5Z" />
																	<path d="M17 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2ZM7 5.5h10a.5.5 0 0 1 .5.5v12a.5.5 0 0 1-.5.5H7a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5Z" />
																</svg>
																<span
																	className="components-menu-item__item"
																	style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
																>
																	{post.title?.rendered || __('(no title)', 'gcblite')}
																</span>
															</span>
															{isSelected && (
																<svg
																	xmlns="http://www.w3.org/2000/svg"
																	viewBox="0 0 24 24"
																	width="24"
																	height="24"
																	className="components-menu-items__item-icon has-icon-right"
																	style={{ marginLeft: 8, flexShrink: 0, fill: '#2271b1' }}
																>
																	<path d="M16.5 7.5 10 13.9l-2.5-2.4-1 1 3.5 3.6 7.5-7.6z" />
																</svg>
															)}
														</button>
													);
												})}
											</div>
										</div>
									</div>
								)}
							</div>

							{selectedPosts && (
								<div style={{ padding: '8px 16px 16px', borderTop: '1px solid #ddd' }}>
									<Button onClick={handleClear} variant="tertiary" style={{ width: '100%' }}>
										{__('Clear Selection', 'gcblite')}
									</Button>
								</div>
							)}
						</div>
					)}
				/>
			)}
		</div>
	);
}
