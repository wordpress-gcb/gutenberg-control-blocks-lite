/**
 * UserField — ported from the original GCB.
 *
 * Single OR multiple user selection (control.multiple). Stored as ID(s) or
 * full user object(s) (control.returnFormat). Drag-and-drop reordering for
 * multi-select.
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

function UserIcon() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" style={{ marginRight: 8, flexShrink: 0, opacity: 0.6 }}>
			<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
		</svg>
	);
}

function SortableUserItem({ user, onRemove }) {
	const {
		attributes: dndAttributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: user.id });

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
			<UserIcon />
			<span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'none' }}>
				{user.name || __('(no name)', 'gcblite')}
			</span>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onRemove(user.id);
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

export default function UserField({ control, value, onChange }) {
	const [allUsers, setAllUsers] = useState([]);
	const [searchResults, setSearchResults] = useState([]);
	const [loading, setLoading] = useState(false);
	const [search, setSearch] = useState('');
	const [activeId, setActiveId] = useState(null);

	const isMultiple = !!control.multiple;

	const selectedIds = isMultiple
		? (Array.isArray(value) ? value : (value ? [value] : []))
		: (value ? [value] : []);

	const selectedUsers = useMemo(
		() => selectedIds.map((id) => allUsers.find((u) => u.id === id)).filter(Boolean),
		[selectedIds, allUsers]
	);

	const mergeUsersIntoCache = useCallback((newUsers) => {
		setAllUsers((prev) => {
			const merged = [...prev];
			newUsers.forEach((nu) => {
				if (!merged.find((u) => u.id === nu.id)) merged.push(nu);
			});
			return merged;
		});
	}, []);

	const loadUsers = useCallback(async (term = '') => {
		setLoading(true);
		try {
			const response = await apiFetch({
				path: `/wp/v2/users?search=${encodeURIComponent(term)}&per_page=50&_fields=id,name`,
			});
			setSearchResults(response);
			mergeUsersIntoCache(response);
		} catch {
			// ignore
		}
		setLoading(false);
	}, [mergeUsersIntoCache]);

	useEffect(() => {
		loadUsers();
	}, [loadUsers]);

	const handleSelect = (userId) => {
		const newIds = isMultiple
			? (selectedIds.includes(userId)
				? selectedIds.filter((id) => id !== userId)
				: [...selectedIds, userId])
			: [userId];

		if (control.returnFormat === 'object') {
			const objs = newIds.map((id) => allUsers.find((u) => u.id === id)).filter(Boolean);
			onChange(isMultiple ? objs : (objs[0] || null));
		} else {
			onChange(isMultiple ? newIds : (newIds[0] || null));
		}
	};

	const handleRemove = (userId) => {
		const newIds = selectedIds.filter((id) => id !== userId);
		if (control.returnFormat === 'object') {
			const objs = newIds.map((id) => allUsers.find((u) => u.id === id)).filter(Boolean);
			onChange(isMultiple ? objs : (objs[0] || null));
		} else {
			onChange(isMultiple ? newIds : (newIds[0] || null));
		}
	};

	const handleReorder = (newOrder) => {
		if (control.returnFormat === 'object') {
			onChange(newOrder.map((id) => allUsers.find((u) => u.id === id)).filter(Boolean));
		} else {
			onChange(newOrder);
		}
	};

	const handleClear = () => onChange(isMultiple ? [] : null);

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

	const activeUser = activeId ? selectedUsers.find((u) => u.id === activeId) : null;
	const availableUsers = searchResults.filter((u) => !selectedIds.includes(u.id));

	return (
		<div className="components-base-control gcb-user-control">
			<div className="components-base-control__field">
				<label className="components-base-control__label">{control.label}</label>
			</div>
			{control.helpText && (
				<p className="components-base-control__help">{control.helpText}</p>
			)}

			<div className="gcb-post-object-stacked">
				<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					<PopoverOrModal
						modalTitle={control.label || __('Select users', 'gcblite')}
						dropdownProps={{ popoverProps: { placement: 'left-start' } }}
						renderToggle={({ isOpen, onToggle }) => (
							<Button
								onClick={onToggle}
								aria-expanded={isOpen}
								className="gcb-modal-toggle-button"
								style={{ ...TOGGLE_BUTTON_STYLE, flex: 1 }}
							>
								{selectedUsers.length > 0
									? `${selectedUsers.length} ${selectedUsers.length === 1 ? __('user', 'gcblite') : __('users', 'gcblite')} ${__('selected', 'gcblite')}`
									: __('Select Users', 'gcblite')}
							</Button>
						)}
						renderContent={({ close: onClose, variant }) => (
							<div style={variant === 'modal' ? { width: '100%' } : { minWidth: 320, maxWidth: 400 }}>
<div style={{ padding: '0 16px 8px 16px' }}>
									<TextControl
										value={search}
										onChange={(val) => {
											setSearch(val);
											loadUsers(val);
										}}
										placeholder={__('Search users…', 'gcblite')}
										__nextHasNoMarginBottom
									/>
								</div>

								<div className="block-editor-link-control__search-results-wrapper" style={{ maxHeight: 300, overflowY: 'auto' }}>
									{loading && (
										<p style={{ textAlign: 'center', color: '#757575', padding: 16 }}>
											{__('Loading…', 'gcblite')}
										</p>
									)}
									{!loading && availableUsers.length === 0 && (
										<p style={{ textAlign: 'center', color: '#757575', padding: 16 }}>
											{__('No users found', 'gcblite')}
										</p>
									)}
									{!loading && availableUsers.length > 0 && (
										<div className="block-editor-link-control__search-results" role="listbox">
											<div className="components-menu-group">
												<div role="group">
													{availableUsers.map((user) => (
														<button
															key={user.id}
															type="button"
															role="option"
															className="components-button components-menu-item__button block-editor-link-control__search-item"
															onClick={() => handleSelect(user.id)}
															style={{
																display: 'flex',
																alignItems: 'center',
																width: '100%',
																padding: '8px 16px',
																textAlign: 'left',
																border: 'none',
																background: 'transparent',
															}}
														>
															<UserIcon />
															<span className="components-menu-item__item" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
																{user.name}
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

					{selectedUsers.length > 0 && (
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

				{selectedUsers.length > 0 && isMultiple && (
					<div className="gcb-post-object-selected-list" style={{ marginTop: 8 }}>
						<DndContext
							sensors={sensors}
							collisionDetection={closestCenter}
							onDragStart={handleDragStart}
							onDragEnd={handleDragEnd}
							onDragCancel={handleDragCancel}
						>
							<SortableContext items={selectedIds} strategy={verticalListSortingStrategy}>
								{selectedUsers.map((user) => (
									<SortableUserItem key={user.id} user={user} onRemove={handleRemove} />
								))}
							</SortableContext>
							<DragOverlay>
								{activeUser ? (
									<div className="gcb-post-object-selected-item" style={{ opacity: 0.8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
										<div className="gcb-post-object-drag-handle" aria-hidden>
											<svg viewBox="0 0 20 20" width="12">
												<path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
											</svg>
										</div>
										<UserIcon />
										<span style={{ flex: 1 }}>{activeUser.name}</span>
									</div>
								) : null}
							</DragOverlay>
						</DndContext>
					</div>
				)}

				{selectedUsers.length > 0 && !isMultiple && (
					<div className="gcb-post-object-selected-list" style={{ marginTop: 8 }}>
						<div className="gcb-post-object-selected-item">
							<UserIcon />
							<span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
								{selectedUsers[0].name}
							</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
