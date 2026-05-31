/**
 * Schema Builder — wp-admin entry.
 *
 * Three views, keyboard-driven throughout:
 *
 *   1. <BlockList>      — landing. Lists every gcb-lite block in the active
 *                         theme + plugin examples. Click to edit, or hit
 *                         "+ New block".
 *   2. <RegisterBlock>  — form to scaffold a new block (block.json +
 *                         render.php + style.css). Re-uses IconField for
 *                         icon selection.
 *   3. <EditFields>     — the visual builder. Vertical list of fields on
 *                         the left, key-value property editor on the right.
 *                         Everything driven by Enter/Tab/Arrow keys —
 *                         autocomplete on field type, on property name,
 *                         and on property value (booleans, enums, refs).
 *
 * Schema vocabulary comes from window.gcbLiteBuilder.controlTypes plus the
 * GET /builder/control-docs/{type} endpoint (parsed frontmatter from
 * schemas/controls/{type}.md). Universal property keys (label,
 * attributeKey, validation, etc.) are baked in to UNIVERSAL_PROPS below.
 *
 * Talks to BuilderAPI endpoints under /wp-json/gcblite/v1/builder/.
 */

import { createRoot, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';

const CONFIG = (typeof window !== 'undefined' && window.gcbLiteBuilder) || {};

// ======================================================================
// Shared vocabulary
// ======================================================================

// Properties every control accepts. Type hints + descriptions used by
// the autocomplete + value editor.
const UNIVERSAL_PROPS = [
	{ name: 'id',                 type: 'string',                                          description: 'Unique within the block. Used by parentPanelId references.' },
	{ name: 'type',               type: 'string',                                          description: 'Control type. Editing this rebuilds the property set.' },
	{ name: 'label',              type: 'string',                                          description: 'Inspector label.' },
	{ name: 'attributeKey',       type: 'string',                                          description: 'WP attribute name. Becomes attributes.<key> on the block.' },
	{ name: 'default',                                                                     description: 'Initial value matching the control type.' },
	{ name: 'placeholder',        type: 'string',                                          description: 'Empty-state hint text.' },
	{ name: 'helpText',           type: 'string',                                          description: 'Short description shown under the field.' },
	{ name: 'parentPanelId',      type: 'string', ref: 'panel',                            description: 'Nest under a group/panel/tools-panel by its id.' },
	{ name: 'conditionalLogic',   type: 'object',                                          description: 'Show only when another control matches. { field, operator, value }.' },
	{ name: 'validation.required', type: 'boolean',                                        description: 'Block save until filled in.' },
	{ name: 'validation.minLength', type: 'number',                                        description: 'Minimum character count.' },
	{ name: 'validation.maxLength', type: 'number',                                        description: 'Maximum character count.' },
	{ name: 'validation.min',     type: 'number',                                          description: 'Minimum numeric value.' },
	{ name: 'validation.max',     type: 'number',                                          description: 'Maximum numeric value.' },
	{ name: 'validation.pattern', type: 'string',                                          description: 'Regex the value must match.' },
];

// Properties that always exist and can't be removed. attributeKey is
// only mandatory on non-structural controls (group/panel/tools-panel
// don't have one).
const MANDATORY_PROPS = ['id', 'type', 'label'];
function isMandatoryProp(propName, fieldType) {
	if (MANDATORY_PROPS.includes(propName)) return true;
	if (propName === 'attributeKey' && !isStructural(fieldType)) return true;
	return false;
}

// Per-type "happy path" defaults added on top of id/type/label/attributeKey.
// These get inserted when the user adds a new field via the autocomplete
// at the bottom of the field list. Authors should land in a state that
// already validates and renders something useful — no required wiring.
const TYPE_DEFAULTS = {
	text:       [['default', '']],
	textarea:   [['default', '']],
	email:      [['default', '']],
	url:        [['default', '']],
	number:     [['default', 0]],
	range:      [['default', 0], ['min', 0], ['max', 100], ['step', 1]],
	toggle:     [['default', false]],
	checkbox:   [['default', false]],
	select:     [['default', ''], ['options', [{ label: 'Option 1', value: 'option-1' }]]],
	radio:      [['default', ''], ['options', [{ label: 'Option 1', value: 'option-1' }]]],
	'checkbox-group': [['default', []], ['options', [{ label: 'Option 1', value: 'option-1' }]]],
	'button-group':   [['default', []], ['options', [{ label: 'Option 1', value: 'option-1' }]]],
	'toggle-group':   [['default', ''], ['options', [{ label: 'Option 1', value: 'option-1' }]]],
	color:      [['default', '#5956E9']],
	image:      [['enableFocalPoint', true], ['enableSizeOptions', true]],
	gallery:    [],
	file:       [],
	icon:       [],
	date:       [['default', '']],
	datetime:   [['default', '']],
	spacing:    [],
	size:       [],
	code:       [['default', '']],
	richtext:   [['default', '']],
	wysiwyg:    [['default', '']],
	oembed:     [['default', '']],
	message:    [['content', 'Information for the editor']],
	'post-object': [['post_type', 'post']],
	'page-link':   [],
	taxonomy:   [['taxonomy', 'category']],
	user:       [],
	relationship: [['post_type', 'post']],
	repeater:   [['fields', [
		{ type: 'text', attributeKey: 'label', label: 'Label' },
		{ type: 'url',  attributeKey: 'url',   label: 'URL' },
	]]],
	'google-map': [],
	// Structural (no attributeKey, no defaults)
	group:        [],
	panel:        [],
	'tools-panel': [],
};

// Cache for fetched per-control docs.
const docsCache = new Map();

// ======================================================================
// REST helper.
// ======================================================================

async function api(path, opts = {}) {
	const url = CONFIG.restUrl.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
	const res = await fetch(url, {
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			'X-WP-Nonce':   CONFIG.restNonce,
			...(opts.headers || {}),
		},
		...opts,
		body: opts.body ? JSON.stringify(opts.body) : undefined,
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		const err = new Error(data.message || `Request failed (${res.status})`);
		err.status = res.status;
		err.data   = data;
		throw err;
	}
	return data;
}

async function getControlDocs(type) {
	if (!type) return null;
	if (docsCache.has(type)) return docsCache.get(type);
	try {
		const data = await api(`control-docs/${type}`);
		docsCache.set(type, data);
		return data;
	} catch {
		docsCache.set(type, null);
		return null;
	}
}

// ======================================================================
// Root — view dispatcher.
// ======================================================================

function App({ initialView }) {
	// initialView mirrors data-view on the mount node and reflects which
	// wp-admin submenu the user is on ('blocks' or 'structured-fields').
	// Inside each top-level view we keep the same { name, ... } sub-view
	// state as before.
	if (initialView === 'structured-fields') {
		return (
			<div style={S.page}>
				<header style={S.header}>
					<h1 style={S.h1}>Structured fields</h1>
					<p style={S.lede}>
						Post / taxonomy / options-page / user meta — one schema per file in your active theme.
					</p>
				</header>
				<StructuredFieldsApp />
			</div>
		);
	}

	return (
		<div style={S.page}>
			<header style={S.header}>
				<h1 style={S.h1}>Blocks</h1>
				<p style={S.lede}>
					One schema per block in your active theme. Keyboard-driven editor: Enter / Tab / arrow keys.
				</p>
			</header>
			<BlocksApp />
		</div>
	);
}

// Block-side flow: list → edit. Creation is inline (one slug input on
// the list page); there's no separate scaffold form. Metadata
// (title/icon/category) is edited inside EditFields, not before.
function BlocksApp() {
	const [view, setView] = useState({ name: 'list' });
	return (
		<>
			{view.name === 'list' && (
				<BlockList
					onCreated={(slug) => setView({ name: 'edit', slug })}
					onEdit={(slug) => setView({ name: 'edit', slug })}
				/>
			)}
			{view.name === 'edit' && (
				<EditFields slug={view.slug} onBack={() => setView({ name: 'list' })} />
			)}
		</>
	);
}

// ======================================================================
// Structured fields app — same shape as BlocksApp, different data.
// ======================================================================

function StructuredFieldsApp() {
	const [view, setView] = useState({ name: 'list' });

	if (view.name === 'edit') {
		return (
			<StructuredEditFields
				kind={view.kind}
				id={view.id}
				pendingNew={view.pendingNew}
				onBack={() => setView({ name: 'list' })}
				onPicked={(kind) => setView({ name: 'edit', kind, id: view.id })}
			/>
		);
	}

	return (
		<StructuredList
			onEdit={(kind, id) => setView({ name: 'edit', kind, id })}
			onStartNew={(id) => setView({ name: 'edit', kind: null, id, pendingNew: true })}
		/>
	);
}

function StructuredList({ onEdit, onStartNew }) {
	const [state, setState] = useState({ loading: true, data: null, error: null });
	const [newId, setNewId] = useState('');
	const [createError, setCreateError] = useState(null);
	const newInputRef = useRef(null);

	useEffect(() => { reload(); }, []);

	function reload() {
		api('structured-fields').then(
			(data) => setState({ loading: false, data, error: null }),
			(err)  => setState({ loading: false, data: null, error: err.message }),
		);
	}

	if (state.loading) return <p style={S.muted}>Loading structured fields…</p>;
	if (state.error)   return <Notice type="error">{state.error}</Notice>;

	const d = state.data || {};

	// Flatten into one list. Each row is { kind, id, path, exists }.
	const rows = [];
	(d.post || []).forEach((i) => rows.push({ kind: 'post', id: i.id, path: i.path, exists: true, source: i.source }));
	(d.taxonomy || []).forEach((i) => rows.push({ kind: 'taxonomy', id: i.id, path: i.path, exists: true, source: i.source }));
	(d.options || []).forEach((i) => rows.push({ kind: 'options', id: i.id, path: i.path, exists: true, source: i.source }));
	// User is special: single row regardless of existence so it's discoverable.
	rows.push({ kind: 'user', id: 'user', path: d.user?.path || '', exists: !!d.user?.exists, source: d.user?.source });

	rows.sort((a, b) => {
		// Group by kind order: post, taxonomy, options, user — then alpha.
		const order = ['post', 'taxonomy', 'options', 'user'];
		const k = order.indexOf(a.kind) - order.indexOf(b.kind);
		if (k !== 0) return k;
		return a.id.localeCompare(b.id);
	});

	const submitNew = () => {
		const slug = newId.trim();
		if (!slug) return;
		if (!/^[a-z][a-z0-9_-]*$/.test(slug)) {
			setCreateError('Slug must be lowercase letters, digits, underscores, hyphens; starting with a letter.');
			return;
		}
		setNewId('');
		setCreateError(null);
		// Defer kind choice to the edit page — same as Blocks shows
		// scaffolding on the next screen.
		onStartNew(slug);
	};

	return (
		<div>
			<div style={S.toolbar}>
				<h2 style={S.h2}>Field sets</h2>
				<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
					<span style={S.muted}>{rows.filter((r) => r.exists).length} active</span>
					<button
						type="button"
						onClick={() => newInputRef.current?.focus()}
						style={{ ...S.primaryBtn, padding: '8px 16px' }}
					>
						+ New
					</button>
				</div>
			</div>

			<div style={S.listCard}>
				{rows.map((row, i) => (
					<StructuredRow
						key={`${row.kind}-${row.id}`}
						row={row}
						last={i === rows.length - 1 && !true /* always show add row below */}
						onEdit={() => onEdit(row.kind, row.id)}
					/>
				))}
				<NewInlineInput
					ref={newInputRef}
					value={newId}
					onChange={(v) => { setNewId(v); setCreateError(null); }}
					onSubmit={submitNew}
					placeholder="Type field set name and press ⏎"
				/>
				{createError && (
					<div style={{ padding: '8px 16px', color: T.danger, fontSize: 12, borderTop: `1px solid ${T.border}` }}>
						{createError}
					</div>
				)}
			</div>
		</div>
	);
}

const KIND_LABELS = {
	post:     'POST',
	taxonomy: 'TAX',
	options:  'OPTIONS',
	user:     'USER',
};

// Inline "+ NEW" row used at the bottom of the Blocks and Field-sets
// lists. Shaped like a proper input: solid border that brightens on
// focus, generous left padding, NEW chip on the left.
const NewInlineInput = forwardRef(function NewInlineInput(
	{ value, onChange, onSubmit, placeholder, disabled, creating },
	ref
) {
	const [focused, setFocused] = useState(false);
	return (
		<div
			style={{
				display: 'flex', alignItems: 'center', gap: 12,
				padding: '10px 14px',
				borderTop: `1px solid ${T.border}`,
				background: T.surface,
				borderLeft: focused ? `2px solid ${T.accent}` : '2px solid transparent',
				transition: 'border-color 120ms',
			}}
		>
			<span style={{ ...S.chip, ...CHIP_COLORS.block }}>NEW</span>
			<input
				ref={ref}
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSubmit(); } }}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				placeholder={placeholder}
				disabled={disabled}
				style={{
					flex: 1,
					border: 0, background: 'transparent', outline: 'none',
					padding: '6px 4px',
					fontSize: 13, color: T.ink, fontFamily: T.font,
				}}
			/>
			{creating && <span style={{ ...S.muted, fontSize: 12 }}>Creating…</span>}
		</div>
	);
});

function StructuredRow({ row, last, onEdit }) {
	const [hover, setHover] = useState(false);
	const color = CHIP_COLORS[row.kind] || CHIP_COLORS.block;
	const label = KIND_LABELS[row.kind] || row.kind.toUpperCase();
	const phpOnly = row.source === 'php';

	return (
		<div
			role={phpOnly ? undefined : 'button'}
			tabIndex={phpOnly ? -1 : 0}
			onClick={phpOnly ? undefined : onEdit}
			onKeyDown={(e) => {
				if (phpOnly) return;
				if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(); }
			}}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			style={{
				...S.listRow,
				...(last ? S.listRowLast : null),
				background: hover && !phpOnly ? T.surfaceAlt : T.surface,
				cursor: phpOnly ? 'default' : 'pointer',
				opacity: phpOnly ? 0.75 : 1,
			}}
		>
			<span style={{ ...S.chip, background: color.bg, color: color.fg, minWidth: 64, justifyContent: 'center' }}>
				{label}
			</span>
			<div style={{ flex: 1, minWidth: 0 }}>
				<div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
					{row.kind === 'user' ? 'User' : row.id}
					{phpOnly && (
						<span style={{ ...S.chip, fontSize: 9, padding: '1px 5px' }}>PHP</span>
					)}
					{!row.exists && !phpOnly && (
						<span style={{ ...S.muted, fontWeight: 400, fontSize: 12 }}>
							— not yet created
						</span>
					)}
				</div>
				<div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>
					<code style={{ fontFamily: T.mono }}>{row.path}</code>
					{phpOnly && (
						<span style={{ marginLeft: 8, color: T.ink3 }}>
							— registered in code, edit there to change
						</span>
					)}
				</div>
			</div>
			<span style={{ color: T.ink3, fontSize: 13 }}>
				{phpOnly ? '' : (row.exists ? 'Edit →' : 'Create →')}
			</span>
		</div>
	);
}

// Same flow as EditFields but talks to the structured-fields endpoints.
// The actual editor (FieldRow + PropertyEditor + validation) is shared.
function StructuredEditFields({ kind, id, pendingNew, onBack, onPicked }) {
	// New field set: ask the user what kind on this page, then proceed
	// to the editor below as if the kind was always known.
	if (pendingNew && !kind) {
		return <StructuredKindPicker id={id} onBack={onBack} onPick={onPicked} />;
	}
	return <StructuredEditFieldsInner kind={kind} id={id} onBack={onBack} />;
}

function StructuredKindPicker({ id, onBack, onPick }) {
	const options = [
		{ kind: 'post',     label: 'Post type',  hint: 'CPT meta (e.g. project, testimonial)' },
		{ kind: 'taxonomy', label: 'Taxonomy',   hint: 'Term meta (e.g. category, post_tag)' },
		{ kind: 'options',  label: 'Options',    hint: 'Top-level options page (e.g. site)' },
		{ kind: 'user',     label: 'User',       hint: 'User profile fields (one schema, no slug)' },
	];
	return (
		<div>
			<button type="button" onClick={onBack} style={{ ...S.backLink, marginBottom: 16 }}>← Field sets</button>
			<h2 style={{ ...S.h2, marginBottom: 6 }}>New field set: <code style={{ fontFamily: T.mono, fontSize: 18 }}>{id}</code></h2>
			<p style={{ ...S.muted, marginTop: 0, marginBottom: 24 }}>What kind of field set is this?</p>
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, maxWidth: 720 }}>
				{options.map((o) => {
					const color = CHIP_COLORS[o.kind] || CHIP_COLORS.block;
					return (
						<button
							key={o.kind}
							type="button"
							onClick={() => onPick(o.kind)}
							style={{
								background: T.surface, border: `1px solid ${T.border}`,
								borderRadius: 10, padding: 16, cursor: 'pointer', textAlign: 'left',
								display: 'flex', flexDirection: 'column', gap: 8,
								fontFamily: T.font,
							}}
						>
							<span style={{ ...S.chip, background: color.bg, color: color.fg, alignSelf: 'flex-start' }}>
								{KIND_LABELS[o.kind]}
							</span>
							<div style={{ fontWeight: 600, fontSize: 15, color: T.ink }}>{o.label}</div>
							<div style={{ fontSize: 12, color: T.ink3 }}>{o.hint}</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}

function StructuredEditFieldsInner({ kind, id, onBack }) {
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState(null);
	const [fields, setFields] = useState([]);
	const [otherKeys, setOtherKeys] = useState({});
	const setDisplayWhen = (dw) => setOtherKeys((prev) => {
		const next = { ...prev };
		if (dw == null) delete next.displayWhen;
		else next.displayWhen = dw;
		return next;
	});
	const [selectedIdx, setSelectedIdx] = useState(0);
	const [saving, setSaving] = useState(false);
	const [savedAt, setSavedAt] = useState(null);
	const [saveError, setSaveError] = useState(null);
	const newFieldRef = useRef(null);

	const endpoint = kind === 'user'
		? 'structured-fields/user'
		: `structured-fields/${kind}/${id}`;

	const fieldErrors = useMemo(
		() => fields.map((f) => validateField(f, fields)),
		[fields]
	);
	const totalErrorCount = useMemo(
		() => fieldErrors.reduce((n, e) => n + Object.keys(e).length, 0),
		[fieldErrors]
	);

	useEffect(() => {
		api(endpoint).then(
			(data) => {
				const content = data.content || { controls: [] };
				const controls = Array.isArray(content.controls) ? content.controls : [];
				setFields(controls.map(controlToField));
				const { controls: _drop, ...rest } = content;
				setOtherKeys(rest);
				setLoading(false);
			},
			(err) => { setLoadError(err.message); setLoading(false); },
		);
	}, [endpoint]);

	const save = async () => {
		setSaving(true);
		setSaveError(null);
		try {
			await api(endpoint, {
				method: 'POST',
				body: {
					content: {
						...otherKeys,
						controls: fields.map(fieldToControl),
					},
				},
			});
			setSavedAt(new Date());
		} catch (err) {
			setSaveError(err.message);
		} finally {
			setSaving(false);
		}
	};

	const addField = (type) => {
		const id = uniqueId(`ctrl_${type.replace(/-/g, '_')}`, fields);
		const attrKey = uniqueAttributeKey(type.replace(/-/g, '_'), fields);
		const defaults = TYPE_DEFAULTS[type] || [];
		const newField = {
			type,
			props: [
				['id', id], ['type', type], ['label', humanise(type)],
				...(isStructural(type) ? [] : [['attributeKey', attrKey]]),
				...defaults,
			],
		};
		const next = [...fields, newField];
		setFields(next);
		setSelectedIdx(next.length - 1);
	};
	const updateField = (idx, f) => setFields(fields.map((existing, i) => (i === idx ? f : existing)));
	const removeField = (idx) => {
		const next = fields.filter((_, i) => i !== idx);
		setFields(next);
		setSelectedIdx(Math.min(idx, next.length - 1));
	};
	const moveField = (from, to) => {
		if (to < 0 || to >= fields.length) return;
		const copy = [...fields];
		const [moved] = copy.splice(from, 1);
		copy.splice(to, 0, moved);
		setFields(copy);
		setSelectedIdx(to);
	};

	if (loading)   return <p style={S.muted}>Loading…</p>;
	if (loadError) return <Notice type="error">{loadError}</Notice>;

	const path = kind === 'user'
		? 'user-fields.fields.json'
		: `${kind}-fields/${id}.fields.json`;
	const displayName = kind === 'user' ? 'User fields' : id;

	return (
		<div>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
				<button type="button" onClick={onBack} style={{ ...S.backLink, marginBottom: 0 }}>← Field sets</button>
				<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
					{savedAt && !saving && (
						<span style={{ fontSize: 12, color: T.ink3 }}>
							Saved {savedAt.toLocaleTimeString()}
						</span>
					)}
					{totalErrorCount > 0 && (
						<span style={{ color: T.danger, fontSize: 12 }}>
							{totalErrorCount} error{totalErrorCount === 1 ? '' : 's'}
						</span>
					)}
					<button
						type="button"
						onClick={save}
						disabled={saving || totalErrorCount > 0}
						style={{
							...S.primaryBtn,
							padding: '8px 20px', fontSize: 14,
							...(totalErrorCount > 0 ? { opacity: 0.4, cursor: 'not-allowed' } : null),
						}}
					>
						{saving ? 'Saving…' : 'Save'}
					</button>
				</div>
			</div>

			<StructuredMetaStrip
				kind={kind}
				name={displayName}
				path={path}
			/>

			{saveError && <Notice type="error">{saveError}</Notice>}

			<div style={S.editLayout}>
				<section style={S.fieldList} aria-label="Fields in this schema">
					{fields.map((f, idx) => (
						<FieldRow
							key={idx}
							field={f}
							errors={fieldErrors[idx]}
							selected={idx === selectedIdx}
							onSelect={() => setSelectedIdx(idx)}
							onDelete={() => removeField(idx)}
							onMoveUp={() => moveField(idx, idx - 1)}
							onMoveDown={() => moveField(idx, idx + 1)}
						/>
					))}
					<NewFieldInput
						ref={newFieldRef}
						types={CONFIG.controlTypes || []}
						onAdd={addField}
					/>
				</section>

				<aside style={S.propPane} aria-label="Properties">
					{fields[selectedIdx] ? (
						<PropertyEditor
							field={fields[selectedIdx]}
							siblingFields={fields}
							errors={fieldErrors[selectedIdx] || {}}
							onChange={(f) => updateField(selectedIdx, f)}
						/>
					) : (
						<p style={S.muted}>Add a field on the left to start.</p>
					)}
				</aside>
			</div>

			<LocationRulesEditor
				kind={kind}
				value={otherKeys.displayWhen}
				onChange={setDisplayWhen}
			/>
		</div>
	);
}

function StructuredMetaStrip({ kind, name, path }) {
	const color = CHIP_COLORS[kind] || CHIP_COLORS.block;
	const label = KIND_LABELS[kind] || kind.toUpperCase();
	return (
		<div style={{ ...S.metaStrip, display: 'flex', alignItems: 'center', gap: 16 }}>
			<span style={{ ...S.chip, background: color.bg, color: color.fg, padding: '4px 10px', fontSize: 11 }}>
				{label}
			</span>
			<div style={{ flex: 1, minWidth: 0 }}>
				<div style={{ fontWeight: 600, fontSize: 18, letterSpacing: '-0.01em' }}>{name}</div>
				<div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>
					<code style={{ fontFamily: T.mono }}>{path}</code>
				</div>
			</div>
		</div>
	);
}

// ======================================================================
// BlockList — pick a block to edit, or create one inline.
// ======================================================================

function BlockList({ onCreated, onEdit }) {
	const [state, setState] = useState({ loading: true, blocks: [], error: null });
	const [creating, setCreating] = useState(false);
	const [newSlug, setNewSlug] = useState('');
	const [createError, setCreateError] = useState(null);
	const newInputRef = useRef(null);

	useEffect(() => { reload(); }, []);

	function reload() {
		api('blocks').then(
			(data) => setState({ loading: false, blocks: data.blocks || [], error: null }),
			(err)  => setState({ loading: false, blocks: [], error: err.message }),
		);
	}

	if (state.loading) return <p style={S.muted}>Loading blocks…</p>;
	if (state.error)   return <Notice type="error">{state.error}</Notice>;

	const themeBlocks   = state.blocks.filter((b) => b.target_kind === 'theme');
	const exampleBlocks = state.blocks.filter((b) => b.target_kind === 'plugin-examples');

	const submitNew = async () => {
		const slug = newSlug.trim();
		if (!slug) return;
		if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
			setCreateError('Slug must be lowercase letters, digits, hyphens; starting with a letter.');
			return;
		}
		setCreating(true);
		setCreateError(null);
		try {
			await api('blocks', {
				method: 'POST',
				body: {
					block_name: slug,
					meta: { title: humanise(slug), icon: 'core/layout', category: 'widgets' },
					render_mode: 'php',
					gcb: { controls: [] },
				},
			});
			setNewSlug('');
			onCreated(slug);
		} catch (err) {
			setCreateError(err.data?.data?.errors
				? err.data.data.errors.map((e) => `[${e.path}] ${e.message}`).join('\n')
				: err.message);
			setCreating(false);
		}
	};

	return (
		<div>
			<div style={S.toolbar}>
				<h2 style={S.h2}>Blocks</h2>
				<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
					<span style={S.muted}>{themeBlocks.length} in active theme</span>
					<button
						type="button"
						onClick={() => newInputRef.current?.focus()}
						style={{ ...S.primaryBtn, padding: '8px 16px' }}
					>
						+ New
					</button>
				</div>
			</div>

			<div style={S.listCard}>
				{themeBlocks.length === 0 && (
					<div style={{ padding: '40px 16px', textAlign: 'center', color: T.ink3 }}>
						No blocks in this theme yet. Type a name below and press ⏎.
					</div>
				)}
				{themeBlocks.map((b, i) => (
					<BlockListRow
						key={b.slug}
						block={b}
						last={i === themeBlocks.length - 1}
						onEdit={() => onEdit(b.slug)}
					/>
				))}
				<NewInlineInput
					ref={newInputRef}
					value={newSlug}
					onChange={(v) => { setNewSlug(v); setCreateError(null); }}
					onSubmit={submitNew}
					placeholder="Type block name and press ⏎"
					disabled={creating}
					creating={creating}
				/>
				{createError && (
					<div style={{ padding: '8px 16px', color: T.danger, fontSize: 12, borderTop: `1px solid ${T.border}` }}>
						{createError}
					</div>
				)}
			</div>

			{exampleBlocks.length > 0 && (
				<details style={{ marginTop: 32 }}>
					<summary style={{ cursor: 'pointer', color: T.ink3, fontSize: 13 }}>
						Plugin-bundled example blocks ({exampleBlocks.length}) — read-only
					</summary>
					<div style={{ ...S.listCard, marginTop: 8, opacity: 0.7 }}>
						{exampleBlocks.map((b, i) => (
							<div key={b.slug} style={{
								...S.listRow,
								...(i === exampleBlocks.length - 1 ? S.listRowLast : null),
								cursor: 'default',
							}}>
								<div style={{ flex: 1 }}>
									<div style={{ fontWeight: 600 }}>{b.title}</div>
									<div style={{ fontSize: 12, color: T.ink3 }}>
										<code style={{ fontFamily: T.mono }}>{b.name}</code>
									</div>
								</div>
								<span style={{ fontSize: 11, color: T.ink3 }}>plugin examples</span>
							</div>
						))}
					</div>
				</details>
			)}
		</div>
	);
}

function BlockListRow({ block, last, onEdit }) {
	const [hover, setHover] = useState(false);
	return (
		<div
			role="button"
			tabIndex={0}
			onClick={onEdit}
			onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(); } }}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			style={{
				...S.listRow,
				...(last ? S.listRowLast : null),
				background: hover ? T.surfaceAlt : T.surface,
			}}
		>
			<div style={{ flex: 1, minWidth: 0 }}>
				<div style={{ fontWeight: 600, fontSize: 14 }}>{block.title}</div>
				<div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>
					<code style={{ fontFamily: T.mono }}>{block.name}</code>
					<span style={{ margin: '0 6px' }}>·</span>
					{block.category}
					<span style={{ margin: '0 6px' }}>·</span>
					{block.has_render_php ? 'PHP-rendered' : 'React-rendered'}
					{block.has_fields ? '' : ' · no fields yet'}
				</div>
			</div>
			<span style={{ color: T.ink3, fontSize: 13 }}>Edit →</span>
		</div>
	);
}

// ======================================================================
// EditFields — visual builder with metadata header.
// ======================================================================

function EditFields({ slug, onBack }) {
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState(null);
	const [fields, setFields] = useState([]);        // [{type, props: [[key, value], ...]}, ...]
	const [otherKeys, setOtherKeys] = useState({}); // root-level keys we don't manage (e.g. allowed_blocks) — preserved on save
	const [meta, setMeta] = useState({ title: '', category: 'widgets', icon: null, description: '' });
	const [selectedIdx, setSelectedIdx] = useState(0);
	const [saving, setSaving] = useState(false);
	const [savedAt, setSavedAt] = useState(null);
	const [saveError, setSaveError] = useState(null);
	const newFieldRef = useRef(null);
	const propPaneRef = useRef(null);

	// Per-field validation map. Recomputed every render — pure + cheap.
	// Indexed by field position; each entry is { [propKey]: errorMessage }.
	const fieldErrors = useMemo(
		() => fields.map((f) => validateField(f, fields)),
		[fields]
	);
	const totalErrorCount = useMemo(
		() => fieldErrors.reduce((n, e) => n + Object.keys(e).length, 0),
		[fieldErrors]
	);

	// Fetch + decompose into our editable model.
	useEffect(() => {
		api(`blocks/${slug}/fields`).then(
			(data) => {
				const content = data.content || { controls: [] };
				const controls = Array.isArray(content.controls) ? content.controls : [];
				setFields(controls.map(controlToField));
				const { controls: _drop, ...rest } = content;
				setOtherKeys(rest);
				if (data.meta) {
					setMeta({
						title:       data.meta.title || '',
						category:    data.meta.category || 'widgets',
						icon:        normaliseIconForEditor(data.meta.icon),
						description: data.meta.description || '',
					});
				}
				setLoading(false);
			},
			(err) => { setLoadError(err.message); setLoading(false); },
		);
	}, [slug]);

	const save = async () => {
		setSaving(true);
		setSaveError(null);
		try {
			const controls = fields.map(fieldToControl);
			const content = { ...otherKeys, controls };
			const body = {
				content,
				meta: {
					title:       meta.title,
					category:    meta.category,
					description: meta.description,
					icon:        meta.icon?.name || meta.icon || null,
				},
			};
			await api(`blocks/${slug}/fields`, { method: 'POST', body });
			setSavedAt(new Date());
		} catch (err) {
			setSaveError(err.data?.data?.errors
				? err.data.data.errors.map((e) => `[${e.path}] ${e.message}`).join('\n')
				: err.message);
		} finally {
			setSaving(false);
		}
	};

	const addField = (type) => {
		const id = uniqueId(`ctrl_${type.replace(/-/g, '_')}`, fields);
		const attrKey = uniqueAttributeKey(type.replace(/-/g, '_'), fields);
		const defaults = TYPE_DEFAULTS[type] || [];
		const newField = {
			type,
			props: [
				['id',           id],
				['type',         type],
				['label',        humanise(type)],
				...(isStructural(type) ? [] : [['attributeKey', attrKey]]),
				...defaults,
			],
		};
		const next = [...fields, newField];
		setFields(next);
		setSelectedIdx(next.length - 1);
		// Focus the property pane after render.
		setTimeout(() => propPaneRef.current?.focusFirstEditable?.(), 0);
	};

	const updateField = (idx, newField) => {
		setFields((f) => f.map((x, i) => (i === idx ? newField : x)));
	};

	const removeField = (idx) => {
		setFields((f) => f.filter((_, i) => i !== idx));
		setSelectedIdx((cur) => Math.max(0, cur >= idx ? cur - 1 : cur));
	};

	const moveField = (from, to) => {
		if (to < 0 || to >= fields.length) return;
		const copy = [...fields];
		const [moved] = copy.splice(from, 1);
		copy.splice(to, 0, moved);
		setFields(copy);
		setSelectedIdx(to);
	};

	if (loading)   return <p style={S.muted}>Loading {slug}…</p>;
	if (loadError) return <Notice type="error">{loadError}</Notice>;

	return (
		<div>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
				<button type="button" onClick={onBack} style={{ ...S.backLink, marginBottom: 0 }}>← Blocks</button>
				<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
					{savedAt && !saving && (
						<span style={{ fontSize: 12, color: T.ink3 }}>
							Saved {savedAt.toLocaleTimeString()}
						</span>
					)}
					{totalErrorCount > 0 && (
						<span style={{ color: T.danger, fontSize: 12 }}>
							{totalErrorCount} error{totalErrorCount === 1 ? '' : 's'}
						</span>
					)}
					<button
						type="button"
						onClick={save}
						disabled={saving || totalErrorCount > 0}
						style={{
							...S.primaryBtn,
							padding: '8px 20px', fontSize: 14,
							...(totalErrorCount > 0 ? { opacity: 0.4, cursor: 'not-allowed' } : null),
						}}
					>
						{saving ? 'Saving…' : 'Save'}
					</button>
				</div>
			</div>

			<BlockMetaStrip
				slug={slug}
				meta={meta}
				onChange={setMeta}
			/>

			{saveError && <Notice type="error">{saveError}</Notice>}

			<div style={S.editLayout}>
				<section style={S.fieldList} aria-label="Fields in this block">
					{fields.map((f, idx) => (
						<FieldRow
							key={idx}
							field={f}
							errors={fieldErrors[idx]}
							selected={idx === selectedIdx}
							onSelect={() => setSelectedIdx(idx)}
							onDelete={() => removeField(idx)}
							onMoveUp={() => moveField(idx, idx - 1)}
							onMoveDown={() => moveField(idx, idx + 1)}
						/>
					))}
					<NewFieldInput
						ref={newFieldRef}
						types={CONFIG.controlTypes || []}
						onAdd={addField}
					/>
				</section>

				<aside style={S.propPane} aria-label="Properties">
					{fields[selectedIdx] ? (
						<PropertyEditor
							ref={propPaneRef}
							field={fields[selectedIdx]}
							siblingFields={fields}
							errors={fieldErrors[selectedIdx] || {}}
							onChange={(f) => updateField(selectedIdx, f)}
						/>
					) : (
						<p style={S.muted}>Add a field on the left to start.</p>
					)}
				</aside>
			</div>
		</div>
	);
}

// ======================================================================
// Location rules (displayWhen)
// ======================================================================

// Keys we offer per kind. The PHP RuleEngine accepts more, but the
// builder UI focuses on the ones that make sense to author in the GUI;
// anything more exotic can still be hand-written in the JSON.
const RULE_KEYS_BY_KIND = {
	block: [], // blocks don't use displayWhen — rules are for structured-field sets
	post: [
		{ key: 'post_type',     label: 'Post type' },
		{ key: 'post_id',       label: 'Post ID' },
		{ key: 'post_template', label: 'Page template' },
		{ key: 'post_status',   label: 'Post status' },
		{ key: 'post_parent',   label: 'Parent page ID' },
		{ key: 'taxonomy_term', label: 'Has term (taxonomy)' },
		{ key: 'user_role',     label: 'Current user role' },
	],
	taxonomy: [
		{ key: 'taxonomy',        label: 'Taxonomy' },
		{ key: 'term_id',         label: 'Term ID' },
		{ key: 'user_role',       label: 'Current user role' },
	],
	options: [
		{ key: 'options_slug',    label: 'Options page slug' },
		{ key: 'user_role',       label: 'Current user role' },
		{ key: 'current_user_id', label: 'Current user ID' },
	],
	user: [
		{ key: 'target_user_id',  label: 'Target user ID' },
		{ key: 'user_role',       label: 'Target user role' },
	],
};

// Operators we offer per key shape. Falls back to equality for keys we
// don't have a special case for.
function operatorsForKey(key) {
	if (key === 'taxonomy_term') return ['contains', 'not_contains'];
	if (['post_id', 'term_id', 'target_user_id', 'current_user_id', 'post_parent'].includes(key)) {
		return ['=', '!=', 'in', 'not_in', '>', '>=', '<', '<='];
	}
	return ['=', '!=', 'in', 'not_in'];
}

// Common values authors might want — drives the value autocomplete.
function valueSuggestionsForKey(key) {
	if (key === 'post_type')    return ['post', 'page', 'attachment'];
	if (key === 'post_status')  return ['publish', 'draft', 'pending', 'private', 'future'];
	if (key === 'user_role')    return ['administrator', 'editor', 'author', 'contributor', 'subscriber'];
	if (key === 'taxonomy')     return ['category', 'post_tag'];
	return [];
}

/**
 * Parse whatever shape displayWhen holds into a normalised UI model:
 *   groups: Array<{ rules: Array<{ key, operator, value }> }>
 *
 * Reading order:
 *   - missing/empty → []
 *   - single rule  { key, op, value } → [{ rules: [that] }]
 *   - flat array (implicit AND) → [{ rules: [...] }]
 *   - { all: [...] } → [{ rules: [...] }]
 *   - { any: [ { all: [...] }, ... ] } → one group per `any` entry
 */
function parseDisplayWhen(dw) {
	if (!dw) return [];
	// Explicit any → multiple groups.
	if (typeof dw === 'object' && !Array.isArray(dw) && Array.isArray(dw.any)) {
		return dw.any.map((branch) => {
			if (Array.isArray(branch?.all)) return { rules: branch.all.map(normaliseRule) };
			if (branch && typeof branch === 'object' && branch.key) return { rules: [normaliseRule(branch)] };
			if (Array.isArray(branch)) return { rules: branch.map(normaliseRule) };
			return { rules: [] };
		});
	}
	// Explicit all → one group with those rules.
	if (typeof dw === 'object' && !Array.isArray(dw) && Array.isArray(dw.all)) {
		return [{ rules: dw.all.map(normaliseRule) }];
	}
	// Single rule.
	if (typeof dw === 'object' && !Array.isArray(dw) && dw.key) {
		return [{ rules: [normaliseRule(dw)] }];
	}
	// Implicit AND array.
	if (Array.isArray(dw)) {
		return [{ rules: dw.map(normaliseRule) }];
	}
	return [];
}

function normaliseRule(r) {
	if (!r || typeof r !== 'object') return { key: '', operator: '=', value: '' };
	return {
		key:      r.key      || '',
		operator: r.operator || '=',
		value:    r.value    ?? '',
	};
}

/**
 * Serialise the UI groups back to the canonical PHP shape. Picks the
 * smallest accepted form:
 *   - 0 groups          → null (omit from output)
 *   - 1 group, 1 rule   → that single rule
 *   - 1 group, N rules  → { all: [...] }
 *   - N groups          → { any: [ { all: [...] }, ... ] }
 */
function serialiseDisplayWhen(groups) {
	const clean = groups
		.map((g) => ({ rules: g.rules.filter((r) => r.key) }))
		.filter((g) => g.rules.length > 0);
	if (clean.length === 0) return null;
	if (clean.length === 1) {
		if (clean[0].rules.length === 1) return clean[0].rules[0];
		return { all: clean[0].rules };
	}
	return { any: clean.map((g) => (g.rules.length === 1 ? g.rules[0] : { all: g.rules })) };
}

function LocationRulesEditor({ kind, value, onChange }) {
	// Local groups state — needed because partial rules (no key yet)
	// would be stripped by the serialiser, and re-parsing on every prop
	// change would erase rows the user just added. We hydrate from the
	// incoming value once on mount and again whenever the saved value
	// changes from outside (e.g. switching field sets).
	const [groups, setGroups] = useState(() => parseDisplayWhen(value));
	const lastSerialised = useRef(serialiseDisplayWhen(parseDisplayWhen(value)));

	useEffect(() => {
		const serialised = serialiseDisplayWhen(parseDisplayWhen(value));
		// Only re-hydrate when the saved value actually changed from
		// outside — guards against the round-trip loop where our own
		// onChange writes back to value and re-renders us.
		if (JSON.stringify(serialised) !== JSON.stringify(lastSerialised.current)) {
			setGroups(parseDisplayWhen(value));
			lastSerialised.current = serialised;
		}
	}, [value]);

	const availableKeys = RULE_KEYS_BY_KIND[kind] || RULE_KEYS_BY_KIND.post;

	const update = (nextGroups) => {
		setGroups(nextGroups);
		const serialised = serialiseDisplayWhen(nextGroups);
		lastSerialised.current = serialised;
		onChange(serialised);
	};

	const addGroup = () => {
		update([...groups, { rules: [{ key: '', operator: '=', value: '' }] }]);
	};
	const removeGroup = (gi) => update(groups.filter((_, i) => i !== gi));
	const addRule = (gi) => {
		const next = groups.map((g, i) => i === gi
			? { rules: [...g.rules, { key: '', operator: '=', value: '' }] }
			: g);
		update(next);
	};
	const updateRule = (gi, ri, patch) => {
		const next = groups.map((g, i) => i === gi
			? { rules: g.rules.map((r, j) => j === ri ? { ...r, ...patch } : r) }
			: g);
		update(next);
	};
	const removeRule = (gi, ri) => {
		const next = groups.map((g, i) => i === gi
			? { rules: g.rules.filter((_, j) => j !== ri) }
			: g);
		update(next);
	};

	// Blocks don't need rules (they aren't a structured-field set).
	if (kind === 'block') return null;

	return (
		<div style={{ ...S.metaStrip, marginTop: 20 }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
				<h3 style={{ ...S.h3, margin: 0 }}>Location rules</h3>
				<span style={{ ...S.muted, fontSize: 12 }}>
					Show this field set only when the conditions below match. Multiple groups are OR'd.
				</span>
			</div>

			{groups.length === 0 && (
				<p style={{ ...S.muted, fontSize: 13, margin: '8px 0 12px' }}>
					No rules — this field set always shows.
				</p>
			)}

			{groups.map((group, gi) => (
				<div key={gi} style={{
					padding: 12, marginBottom: 8,
					border: `1px solid ${T.border}`, borderRadius: 8,
					background: T.surfaceAlt,
				}}>
					{gi > 0 && (
						<div style={{ fontSize: 11, fontWeight: 700, color: T.accent, marginBottom: 8 }}>OR</div>
					)}
					{group.rules.map((rule, ri) => (
						<div key={ri} style={{
							display: 'grid',
							gridTemplateColumns: '180px 140px 1fr auto',
							gap: 8,
							alignItems: 'center',
							padding: '4px 0',
						}}>
							<select
								value={rule.key}
								onChange={(e) => updateRule(gi, ri, { key: e.target.value, operator: operatorsForKey(e.target.value)[0] || '=' })}
								style={{ ...S.input, padding: '6px 8px', fontSize: 13 }}
							>
								<option value="">— Pick a key —</option>
								{availableKeys.map((k) => (
									<option key={k.key} value={k.key}>{k.label}</option>
								))}
							</select>
							<select
								value={rule.operator}
								onChange={(e) => updateRule(gi, ri, { operator: e.target.value })}
								style={{ ...S.input, padding: '6px 8px', fontSize: 13, fontFamily: T.mono }}
								disabled={!rule.key}
							>
								{operatorsForKey(rule.key).map((op) => (
									<option key={op} value={op}>{op}</option>
								))}
							</select>
							{rule.key === 'taxonomy_term' ? (
								<TaxonomyTermValueInput
									value={rule.value}
									onChange={(v) => updateRule(gi, ri, { value: v })}
								/>
							) : (
								<input
									type="text"
									value={Array.isArray(rule.value) ? rule.value.join(', ') : String(rule.value ?? '')}
									onChange={(e) => {
										// Multi-value operators expect arrays; everything else is a scalar.
										const raw = e.target.value;
										const multi = ['in', 'not_in'].includes(rule.operator);
										updateRule(gi, ri, { value: multi
											? raw.split(',').map((s) => s.trim()).filter(Boolean)
											: raw });
									}}
									placeholder={(valueSuggestionsForKey(rule.key)[0]) || ''}
									list={`gcb-rule-values-${rule.key}`}
									style={{ ...S.input, padding: '6px 8px', fontSize: 13 }}
								/>
							)}
							{valueSuggestionsForKey(rule.key).length > 0 && (
								<datalist id={`gcb-rule-values-${rule.key}`}>
									{valueSuggestionsForKey(rule.key).map((v) => <option key={v} value={v} />)}
								</datalist>
							)}
							<button
								type="button"
								onClick={() => removeRule(gi, ri)}
								title="Remove rule"
								style={{ ...S.iconBtn, color: T.danger }}
							>
								✕
							</button>
						</div>
					))}
					<div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
						<button
							type="button"
							onClick={() => addRule(gi)}
							style={{ ...S.ghostBtn, fontSize: 12, color: T.ink2 }}
						>
							+ AND another rule
						</button>
						<button
							type="button"
							onClick={() => removeGroup(gi)}
							style={{ ...S.ghostBtn, fontSize: 12, color: T.danger, marginLeft: 'auto' }}
						>
							Remove group
						</button>
					</div>
				</div>
			))}

			<button
				type="button"
				onClick={addGroup}
				style={{ ...S.secondaryBtn, marginTop: 8 }}
			>
				+ {groups.length === 0 ? 'Add rule' : 'OR another group'}
			</button>
		</div>
	);
}

// Tiny composite input for the taxonomy_term key — value shape is
// { taxonomy, term } where term is a slug.
function TaxonomyTermValueInput({ value, onChange }) {
	const v = (typeof value === 'object' && value) ? value : { taxonomy: '', term: '' };
	return (
		<div style={{ display: 'flex', gap: 8 }}>
			<input
				type="text"
				value={v.taxonomy || ''}
				onChange={(e) => onChange({ ...v, taxonomy: e.target.value })}
				placeholder="taxonomy (e.g. category)"
				style={{ ...S.input, padding: '6px 8px', fontSize: 13, flex: 1 }}
			/>
			<input
				type="text"
				value={v.term || ''}
				onChange={(e) => onChange({ ...v, term: e.target.value })}
				placeholder="term slug (e.g. news)"
				style={{ ...S.input, padding: '6px 8px', fontSize: 13, flex: 1 }}
			/>
		</div>
	);
}

// Metadata strip — Title / Category / Icon. Save lives in the page
// header above. The gcb/{slug} caption is positioned absolutely so it
// doesn't push the title input off-center.
function BlockMetaStrip({ slug, meta, onChange }) {
	const set = (k) => (v) => onChange({ ...meta, [k]: v });
	return (
		<div style={{ ...S.metaStrip, position: 'relative', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 16px 16px 16px' }}>
			<div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
				<input
					type="text"
					value={meta.title}
					onChange={(e) => set('title')(e.target.value)}
					placeholder={humanise(slug)}
					style={{
						...S.input,
						fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em',
						padding: `10px ${Math.max(12 + slug.length * 7 + 24, 90)}px 10px 12px`,
					}}
				/>
				<code style={{
					position: 'absolute',
					top: '50%', right: 10,
					transform: 'translateY(-50%)',
					fontFamily: T.mono, fontSize: 11, color: T.ink3,
					background: T.surfaceAlt,
					border: `1px solid ${T.border}`,
					padding: '3px 8px', borderRadius: 4,
					lineHeight: 1.4,
					pointerEvents: 'none',
				}}>
					gcb/{slug}
				</code>
			</div>

			<input
				type="text"
				value={meta.category || ''}
				onChange={(e) => set('category')(e.target.value)}
				placeholder="widgets"
				style={{ ...S.input, width: 130, fontSize: 13, padding: '10px 12px', height: 42 }}
				list="gcblite-categories"
				title="Category"
			/>
			<datalist id="gcblite-categories">
				<option value="widgets" />
				<option value="text" />
				<option value="media" />
				<option value="design" />
				<option value="theme" />
				<option value="embed" />
			</datalist>

			<IconTile value={meta.icon} onChange={set('icon')} />
		</div>
	);
}

// IconTile — 64×64 swatch showing the current icon, with a pencil badge
// overlaid in the corner. Click to open a search popover. Uses the
// /wp/v2/icons endpoint directly to avoid pulling in @wordpress/components
// styles for one feature.
let _iconCache = null;
let _iconPromise = null;

function fetchIconsOnce() {
	if (_iconCache) return Promise.resolve(_iconCache);
	if (_iconPromise) return _iconPromise;
	const fetchAll = async () => {
		const all = [];
		for (let page = 1; page < 50; page++) {
			// eslint-disable-next-line no-await-in-loop
			const chunk = await apiFetch({ path: `/wp/v2/icons?per_page=100&page=${page}` });
			if (!Array.isArray(chunk) || chunk.length === 0) break;
			all.push(...chunk);
			if (chunk.length < 100) break;
		}
		_iconCache = all;
		return all;
	};
	_iconPromise = fetchAll().finally(() => { _iconPromise = null; });
	return _iconPromise;
}

function IconTile({ value, onChange }) {
	const current = value && typeof value === 'object' ? value : (value ? { source: 'wp', name: value } : null);
	const [icons, setIcons] = useState(_iconCache);
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState('');
	const popoverRef = useRef(null);
	const triggerRef = useRef(null);

	useEffect(() => {
		if (icons) return;
		let cancelled = false;
		fetchIconsOnce().then((list) => { if (!cancelled) setIcons(list); }).catch(() => {});
		return () => { cancelled = true; };
	}, [icons]);

	useEffect(() => {
		if (!open) return;
		const handler = (e) => {
			if (popoverRef.current && !popoverRef.current.contains(e.target) && !triggerRef.current?.contains(e.target)) {
				setOpen(false);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [open]);

	const currentIcon = useMemo(() => {
		if (!icons || !current?.name) return null;
		return icons.find((i) => i.name === current.name) || null;
	}, [icons, current?.name]);

	const filtered = useMemo(() => {
		if (!icons) return [];
		if (!search) return icons;
		const q = search.toLowerCase();
		return icons.filter((i) => i.name.toLowerCase().includes(q) || (i.label || '').toLowerCase().includes(q));
	}, [icons, search]);

	const pick = (name) => {
		onChange({ source: 'wp', name });
		setOpen(false);
		setSearch('');
	};

	return (
		<div style={{ position: 'relative', display: 'inline-block' }}>
			<button
				type="button"
				ref={triggerRef}
				onClick={() => setOpen((v) => !v)}
				aria-label={currentIcon ? `Icon: ${currentIcon.label}. Click to change.` : 'Pick an icon'}
				style={{
					minWidth: 42, height: 42, borderRadius: 0,
					border: `1px solid ${T.border}`,
					background: T.surfaceAlt,
					display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
					cursor: 'pointer', padding: '0 10px',
					transition: 'border-color 120ms, background 120ms',
				}}
			>
				{currentIcon ? (
					<span
						aria-hidden
						style={{ width: 20, height: 20, color: T.ink, display: 'inline-flex' }}
						dangerouslySetInnerHTML={{ __html: scaleSvg(currentIcon.content, 20) }}
					/>
				) : (
					<span aria-hidden style={{ color: T.ink3, fontSize: 18 }}>◇</span>
				)}
			</button>
			<span
				aria-hidden
				style={{
					position: 'absolute', bottom: -4, right: -4,
					width: 20, height: 20, borderRadius: '50%',
					background: T.ink, color: '#fff',
					display: 'flex', alignItems: 'center', justifyContent: 'center',
					fontSize: 11, boxShadow: '0 1px 3px rgba(17,17,20,0.15)',
					pointerEvents: 'none',
				}}
			>
				✎
			</span>

			{open && (
				<div
					ref={popoverRef}
					style={{
						position: 'absolute', top: 'calc(100% + 8px)', right: 0,
						background: T.surface, border: `1px solid ${T.border}`,
						borderRadius: 10, boxShadow: '0 8px 24px rgba(17,17,20,0.10)',
						padding: 12, zIndex: 100, width: 320,
					}}
				>
					<input
						type="text"
						autoFocus
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search icons…"
						style={{ ...S.input, marginBottom: 10 }}
					/>
					{!icons && (
						<div style={{ padding: 20, textAlign: 'center', color: T.ink3, fontSize: 12 }}>
							Loading icons…
						</div>
					)}
					{icons && (
						<div style={{
							display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
							gap: 4, maxHeight: 280, overflowY: 'auto',
						}}>
							{filtered.length === 0 && (
								<div style={{ gridColumn: '1 / -1', textAlign: 'center', color: T.ink3, fontSize: 12, padding: 16 }}>
									No icons match.
								</div>
							)}
							{filtered.map((icon) => {
								const selected = icon.name === current?.name;
								return (
									<button
										key={icon.name}
										type="button"
										onClick={() => pick(icon.name)}
										title={icon.label}
										style={{
											aspectRatio: '1', borderRadius: 6,
											border: selected ? `2px solid ${T.accent}` : `1px solid transparent`,
											background: selected ? T.accentSoft : 'transparent',
											display: 'flex', alignItems: 'center', justifyContent: 'center',
											cursor: 'pointer', padding: 0, color: T.ink,
										}}
									>
										<span
											aria-hidden
											style={{ width: 20, height: 20, display: 'inline-flex' }}
											dangerouslySetInnerHTML={{ __html: scaleSvg(icon.content, 20) }}
										/>
									</button>
								);
							})}
						</div>
					)}
					{current?.name && (
						<div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
							<span style={{ fontSize: 12, color: T.ink3, fontFamily: T.mono }}>
								{current.name}
							</span>
							<button
								type="button"
								onClick={() => { onChange(null); setOpen(false); }}
								style={{ ...S.ghostBtn, color: T.danger, fontSize: 12 }}
							>
								Clear
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// Map each gcb-lite control type to a WP 7.0 core/* icon name. Picked
// from the WP icon registry on intuition — if a name doesn't resolve at
// runtime, FieldTypeIcon falls back to a soft placeholder rather than
// erroring. Structural containers (group/panel/tools-panel) get their
// own visual treatment.
// Mapped against /wp-includes/images/icon-library/ — every value here is
// a real SVG that ships with WP 7.0. FieldTypeIcon falls back to a
// placeholder diamond if a name does ever drop out of the registry.
const FIELD_TYPE_ICONS = {
	text:             'core/text-horizontal',
	textarea:         'core/paragraph',
	email:            'core/envelope',
	url:              'core/link',
	number:           'core/format-list-numbered',
	range:            'core/justify-space-between',
	toggle:           'core/tabs-menu-item',
	checkbox:         'core/check',
	select:           'core/list-view',
	radio:            'core/list-item',
	'checkbox-group': 'core/format-list-bullets',
	'button-group':   'core/buttons',
	'toggle-group':   'core/buttons',
	color:            'core/swatch',
	image:            'core/image',
	gallery:          'core/gallery',
	file:             'core/file',
	icon:             'core/star-filled',
	date:             'core/calendar',
	datetime:         'core/calendar',
	spacing:          'core/justify-space-between-vertical',
	size:             'core/fullscreen',
	code:             'core/code',
	richtext:         'core/pencil',
	wysiwyg:          'core/pencil',
	oembed:           'core/video',
	message:          'core/info',
	'post-object':    'core/post',
	'page-link':      'core/custom-link',
	taxonomy:         'core/tag',
	user:             'core/people',
	relationship:     'core/connection',
	repeater:         'core/menu',
	'google-map':     'core/map-marker',
	heading:          'core/heading',
	'heading-level':  'core/heading',
	group:            'core/group',
	panel:            'core/sidebar',
	'tools-panel':    'core/tool',
};

function FieldTypeIcon({ type, size = 18 }) {
	const name = FIELD_TYPE_ICONS[type];
	const [icons, setIcons] = useState(_iconCache);

	useEffect(() => {
		if (icons || !name) return;
		let cancelled = false;
		fetchIconsOnce().then((list) => { if (!cancelled) setIcons(list); }).catch(() => {});
		return () => { cancelled = true; };
	}, [icons, name]);

	const icon = useMemo(() => {
		if (!icons || !name) return null;
		return icons.find((i) => i.name === name) || null;
	}, [icons, name]);

	const tile = (
		<span
			aria-hidden
			style={{
				width: size + 14, height: size + 14, borderRadius: 6,
				border: `1px solid ${T.border}`,
				background: T.surfaceAlt,
				display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
				color: T.ink2, flexShrink: 0,
			}}
		>
			{icon ? (
				<span
					style={{ width: size, height: size, display: 'inline-flex' }}
					dangerouslySetInnerHTML={{ __html: scaleSvg(icon.content, size) }}
				/>
			) : (
				<span style={{ fontSize: 12, color: T.ink3 }}>◇</span>
			)}
		</span>
	);
	return tile;
}

// The SVG strings from /wp/v2/icons come with width="24" height="24"
// baked in. Force them to inherit the parent font color so they pick up
// our ink color, and resize to whatever pixel size we want.
function scaleSvg(svg, size) {
	if (typeof svg !== 'string') return '';
	return svg
		.replace(/width="\d+"/, `width="${size}"`)
		.replace(/height="\d+"/, `height="${size}"`)
		.replace(/<svg /, '<svg fill="currentColor" ');
}

// IconField stores its value as { source, name }. block.json's icon
// field can be either that object or a plain dashicons slug. Coerce on
// load so the icon picker round-trips.
function normaliseIconForEditor(icon) {
	if (!icon) return null;
	if (typeof icon === 'string') return { source: 'wp', name: icon };
	if (typeof icon === 'object' && icon.name) return icon;
	return null;
}

// ----------------------------------------------------------------------
// Field row.
// ----------------------------------------------------------------------

function FieldRow({ field, errors, selected, onSelect, onDelete, onMoveUp, onMoveDown }) {
	const id    = field.props.find(([k]) => k === 'id')?.[1] || '(no id)';
	const label = field.props.find(([k]) => k === 'label')?.[1] || '';
	const structural = isStructural(field.type);
	const errCount = errors ? Object.keys(errors).length : 0;
	const [hover, setHover] = useState(false);

	const bg = selected
		? T.accentSoft
		: structural ? T.warnSoft
		: hover ? T.surfaceAlt
		: T.surface;
	const stripe = selected
		? `3px solid ${T.accent}`
		: structural ? `3px solid ${T.warn}`
		: '3px solid transparent';

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={onSelect}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
				if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); onDelete(); }
				if (e.key === 'ArrowUp' && e.metaKey) { e.preventDefault(); onMoveUp(); }
				if (e.key === 'ArrowDown' && e.metaKey) { e.preventDefault(); onMoveDown(); }
			}}
			style={{
				...S.fieldRow,
				background: bg,
				borderLeft: stripe,
			}}
		>
			<div style={{ flex: 1, minWidth: 0 }}>
				<div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
					<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
						{label || id}
					</span>
					{errCount > 0 && (
						<span
							aria-label={`${errCount} error${errCount === 1 ? '' : 's'}`}
							title={Object.entries(errors).map(([k, m]) => `${k}: ${m}`).join('\n')}
							style={{
								display: 'inline-block',
								width: 7, height: 7, borderRadius: '50%',
								background: T.danger, marginLeft: 'auto',
								flexShrink: 0,
							}}
						/>
					)}
				</div>
				<div style={{ fontSize: 11, color: T.ink3, marginTop: 1 }}>
					<code style={{ fontFamily: T.mono }}>{field.type}</code>
				</div>
			</div>
			<div style={{ display: 'flex', gap: 0, opacity: hover || selected ? 1 : 0, transition: 'opacity 120ms' }}>
				<button type="button" onClick={(e) => { e.stopPropagation(); onMoveUp(); }} style={S.iconBtn} title="Move up (⌘↑)">↑</button>
				<button type="button" onClick={(e) => { e.stopPropagation(); onMoveDown(); }} style={S.iconBtn} title="Move down (⌘↓)">↓</button>
				<button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} style={S.iconBtn} title="Delete (Backspace)">✕</button>
			</div>
		</div>
	);
}

// ----------------------------------------------------------------------
// "Add a new field" input — type to autocomplete the control type.
// ----------------------------------------------------------------------

// Control-type categories used to group the "+ Add field" dropdown.
// Order here is render order in the popover. Any type not listed below
// falls into an "Other" bucket so adding a new control type doesn't
// silently drop it.
const FIELD_CATEGORIES = [
	{ label: 'Text & numbers', types: ['text', 'textarea', 'email', 'url', 'number', 'range', 'code', 'oembed', 'date', 'datetime'] },
	{ label: 'Choice',         types: ['select', 'radio', 'checkbox', 'checkbox-group', 'button-group', 'toggle', 'toggle-group'] },
	{ label: 'Media',          types: ['image', 'gallery', 'file', 'icon'] },
	{ label: 'Content',        types: ['heading', 'heading-level', 'richtext', 'wysiwyg', 'message'] },
	{ label: 'Design',         types: ['color', 'spacing', 'size'] },
	{ label: 'Relationships',  types: ['post-object', 'page-link', 'taxonomy', 'user', 'relationship'] },
	{ label: 'Layout',         types: ['group', 'panel', 'tools-panel'] },
	{ label: 'Complex',        types: ['repeater', 'google-map'] },
];

function NewFieldInput({ types, onAdd }) {
	const [query, setQuery] = useState('');
	const [active, setActive] = useState(0);
	const [open, setOpen] = useState(false);
	const wrapRef  = useRef(null);
	const inputRef = useRef(null);

	// Group the filtered matches into the buckets above. When the user
	// types, fuzzy matches still respect the same ordering so they can
	// scan by category. Unknown types end up in "Other".
	const grouped = useMemo(() => {
		const q = query.toLowerCase();
		const inSet = new Set(types);
		const seen = new Set();
		const out = [];

		const matches = !q
			? types
			: types
				.filter((t) => t.toLowerCase().includes(q))
				.sort((a, b) => {
					const aStarts = a.toLowerCase().startsWith(q);
					const bStarts = b.toLowerCase().startsWith(q);
					if (aStarts && !bStarts) return -1;
					if (bStarts && !aStarts) return 1;
					return a.localeCompare(b);
				});
		const matchSet = new Set(matches);

		for (const cat of FIELD_CATEGORIES) {
			const items = cat.types.filter((t) => inSet.has(t) && matchSet.has(t));
			items.forEach((t) => seen.add(t));
			if (items.length > 0) out.push({ label: cat.label, items });
		}
		const other = matches.filter((t) => !seen.has(t));
		if (other.length > 0) out.push({ label: 'Other', items: other });
		return out;
	}, [query, types]);

	// Flattened ordered list used for keyboard navigation. Mirrors the
	// visual order of the grouped render.
	const matches = useMemo(
		() => grouped.flatMap((g) => g.items),
		[grouped]
	);

	useEffect(() => {
		if (!open) return;
		const handler = (e) => {
			if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [open]);

	const pick = (type) => {
		if (!type) return;
		onAdd(type);
		setQuery('');
		setActive(0);
		setOpen(false);
	};

	const openAndFocus = () => {
		setOpen(true);
		setTimeout(() => inputRef.current?.focus(), 0);
	};

	return (
		<div ref={wrapRef} style={{ position: 'relative', marginTop: 8 }}>
			{!open ? (
				<button
					type="button"
					onClick={openAndFocus}
					style={{
						width: '100%',
						display: 'flex', alignItems: 'center', justifyContent: 'space-between',
						padding: '10px 12px',
						border: `1px solid ${T.border}`,
						background: T.surface,
						borderRadius: 6,
						fontSize: 13, color: T.ink,
						cursor: 'pointer', fontFamily: T.font,
					}}
				>
					<span>+ Add field</span>
					<span aria-hidden style={{ color: T.ink3, fontSize: 10 }}>▾</span>
				</button>
			) : (
				<div style={{ position: 'relative' }}>
					<input
						ref={inputRef}
						type="text"
						value={query}
						placeholder="Search control type…"
						onChange={(e) => { setQuery(e.target.value); setActive(0); }}
						onKeyDown={(e) => {
							if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(matches.length - 1, a + 1)); }
							if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
							if (e.key === 'Enter')     { e.preventDefault(); pick(matches[active]); }
							if (e.key === 'Escape')    { setOpen(false); setQuery(''); }
						}}
						style={{
							...S.input,
							padding: '10px 32px 10px 12px',
							fontSize: 13,
						}}
					/>
					<span
						aria-hidden
						style={{
							position: 'absolute', top: '50%', right: 10,
							transform: 'translateY(-50%)',
							color: T.ink3, fontSize: 10, pointerEvents: 'none',
						}}
					>
						▴
					</span>
				</div>
			)}

			{open && matches.length > 0 && (
				<ul style={S.suggestList}>
					{(() => {
						let flatIdx = -1;
						return grouped.map((cat, ci) => (
							<li key={cat.label} style={{
								listStyle: 'none',
								marginTop: ci > 0 ? 8 : 0,
								paddingTop: ci > 0 ? 8 : 0,
								borderTop: ci > 0 ? `1px solid ${T.border}` : 0,
							}}>
								<div style={{
									padding: '4px 10px 6px',
									fontSize: 10,
									fontWeight: 700,
									letterSpacing: '0.06em',
									textTransform: 'uppercase',
									color: T.ink3,
								}}>
									{cat.label}
								</div>
								<ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
									{cat.items.map((t) => {
										flatIdx++;
										const i = flatIdx;
										return (
											<li
												key={t}
												onMouseDown={(e) => { e.preventDefault(); pick(t); }}
												onMouseEnter={() => setActive(i)}
												style={{ ...S.suggestItem, background: i === active ? T.accentSoft : 'transparent' }}
											>
												<code style={{ fontFamily: T.mono, background: 'transparent', padding: 0 }}>{t}</code>
											</li>
										);
									})}
								</ul>
							</li>
						));
					})()}
				</ul>
			)}
		</div>
	);
}

// ======================================================================
// Property pane.
// ======================================================================

const PropertyEditor = forwardRef(function PropertyEditor({ field, siblingFields, errors, onChange }, ref) {
	const [docs, setDocs] = useState(null);
	const rowRefs = useRef([]);
	const newRowRef = useRef(null);

	useEffect(() => {
		let cancelled = false;
		getControlDocs(field.type).then((d) => { if (!cancelled) setDocs(d); });
		return () => { cancelled = true; };
	}, [field.type]);

	// Build the vocabulary of property names valid for this control.
	const validProps = useMemo(() => {
		const fromDocs = Array.isArray(docs?.configOptions) ? docs.configOptions : [];
		return [
			...UNIVERSAL_PROPS,
			...fromDocs.map((o) => ({
				name: o.name,
				type: jsType(o.type),
				default: o.default,
				description: o.description || '',
			})),
		];
	}, [docs]);

	// Possible target IDs for `parentPanelId` etc. — sibling structural fields.
	const panelIds = useMemo(() =>
		siblingFields
			.filter((f) => isStructural(f.type))
			.map((f) => f.props.find(([k]) => k === 'id')?.[1])
			.filter(Boolean),
		[siblingFields]
	);

	// Possible attributeKeys (for conditionalLogic.field etc.).
	const attrKeys = useMemo(() =>
		siblingFields
			.map((f) => f.props.find(([k]) => k === 'attributeKey')?.[1])
			.filter(Boolean),
		[siblingFields]
	);

	const setProp = (idx, [k, v]) => {
		onChange({ ...field, props: field.props.map((p, i) => (i === idx ? [k, v] : p)) });
	};

	const removeProp = (idx) => {
		onChange({ ...field, props: field.props.filter((_, i) => i !== idx) });
	};

	const addProp = (k, v = '') => {
		onChange({ ...field, props: [...field.props, [k, v]] });
		setTimeout(() => newRowRef.current?.focus?.(), 0);
	};

	useImperativeHandle(ref, () => ({
		focusFirstEditable: () => {
			newRowRef.current?.focus();
		},
	}));

	return (
		<div>
			<div style={{ marginBottom: 16 }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
					<FieldTypeIcon type={field.type} />
					<code style={{ fontFamily: T.mono, fontSize: 13, color: T.ink, fontWeight: 600 }}>{field.type}</code>
				</div>
				{docs?.description && (
					<p style={{ color: T.ink3, fontSize: 13, margin: '8px 0 0', lineHeight: 1.5 }}>
						{docs.description}
					</p>
				)}
			</div>

			<div style={S.propTable}>
				{field.props.map(([k, v], idx) => (
					<PropRow
						key={idx}
						ref={(el) => (rowRefs.current[idx] = el)}
						k={k}
						v={v}
						propSpec={validProps.find((p) => p.name === k)}
						validProps={validProps.filter((p) => p.name !== k && !field.props.some(([pk]) => pk === p.name))}
						panelIds={panelIds}
						attrKeys={attrKeys}
						fieldType={field.type}
						mandatory={isMandatoryProp(k, field.type)}
						error={errors?.[k]}
						onChange={([nk, nv]) => setProp(idx, [nk, nv])}
						onRemove={() => removeProp(idx)}
						onNext={() => {
							if (idx === field.props.length - 1) {
								newRowRef.current?.focus();
							} else {
								rowRefs.current[idx + 1]?.focusKey();
							}
						}}
					/>
				))}

				<AddPropRow
					ref={newRowRef}
					validProps={validProps.filter((p) => !field.props.some(([pk]) => pk === p.name))}
					onAdd={addProp}
				/>
			</div>
		</div>
	);
});

// ----------------------------------------------------------------------
// One row of `key: value` with autocomplete on both sides.
// ----------------------------------------------------------------------

const PropRow = forwardRef(function PropRow(
	{ k, v, propSpec, validProps, panelIds, attrKeys, fieldType, mandatory, error, onChange, onRemove, onNext },
	ref
) {
	const keyRef   = useRef(null);
	const valueRef = useRef(null);

	useImperativeHandle(ref, () => ({
		focusKey: () => keyRef.current?.focus(),
	}));

	const valueOptions = useMemo(
		() => suggestValues(propSpec, k, fieldType, { panelIds, attrKeys }),
		[propSpec, k, fieldType, panelIds, attrKeys]
	);

	// `options` for choice controls renders as a stacked mini-editor
	// instead of a single string value — { label, value } pairs.
	const isOptionsRow = k === 'options' && CHOICE_TYPES.has(fieldType);

	// `fields` for repeater controls — each row is a mini field-spec
	// { type, attributeKey, label }.
	const isRepeaterFieldsRow = k === 'fields' && fieldType === 'repeater';

	// `conditionalLogic` shows a structured rule editor instead of a
	// raw value cell. Stored shape: { field, operator, value }.
	const isConditionalRow = k === 'conditionalLogic';

	const isExpandedRow = isOptionsRow || isRepeaterFieldsRow || isConditionalRow;

	return (
		<div style={{ ...S.propRow, alignItems: isExpandedRow ? 'flex-start' : 'center', padding: isExpandedRow ? '6px 0' : '2px 0' }}>
			{mandatory ? (
				<span style={{
					...S.propKey,
					padding: '4px 6px',
					fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
					fontSize: 13,
					color: '#1e1e1e',
				}} title="Required — can't be removed">{k}</span>
			) : (
				<AutoInput
					ref={keyRef}
					value={k}
					suggestions={validProps.map((p) => p.name)}
					placeholder="property"
					monospace
					style={S.propKey}
					onChange={(nk) => onChange([nk, v])}
					onCommit={(nk) => { onChange([nk, v]); valueRef.current?.focus(); }}
					onTab={() => valueRef.current?.focus()}
				/>
			)}
			<span style={S.propColon}>:</span>
			{isOptionsRow ? (
				<div style={{ width: '100%', ...errorWrap(error) }} title={error || undefined}>
					<OptionsEditor
						value={Array.isArray(v) ? v : parseOptions(v)}
						onChange={(opts) => onChange([k, opts])}
					/>
				</div>
			) : isRepeaterFieldsRow ? (
				<div style={{ width: '100%', ...errorWrap(error) }} title={error || undefined}>
					<RepeaterFieldsEditor
						value={Array.isArray(v) ? v : parseOptions(v)}
						onChange={(rows) => onChange([k, rows])}
					/>
				</div>
			) : isConditionalRow ? (
				<div style={{ width: '100%', ...errorWrap(error) }} title={error || undefined}>
					<ConditionalLogicEditor
						value={typeof v === 'object' && v !== null ? v : {}}
						attrKeys={attrKeys}
						onChange={(rule) => onChange([k, rule])}
					/>
				</div>
			) : (
				<AutoInput
					ref={valueRef}
					value={v == null ? '' : String(v)}
					suggestions={valueOptions}
					placeholder="value"
					style={{
						...S.propValue,
						...(error ? { borderColor: '#d63638', background: '#fdf2f2' } : null),
					}}
					title={error || undefined}
					onChange={(nv) => onChange([k, coerceValue(nv, propSpec)])}
					onCommit={() => onNext?.()}
					onTab={onNext}
				/>
			)}
			{mandatory ? (
				<span style={S.propRemove} title="Required" aria-hidden>·</span>
			) : (
				<button type="button" onClick={onRemove} style={S.propRemove} title="Remove">✕</button>
			)}
		</div>
	);
});

// Choice-family control types that take an `options: [{label,value}]` array.
const CHOICE_TYPES = new Set([
	'select', 'radio', 'checkbox-group', 'button-group', 'toggle-group',
]);

// Visual error treatment for nested editors (options/repeater fields) — a
// red ring + soft red background so the cell stands out without distorting
// the inner layout.
function errorWrap(error) {
	if (!error) return null;
	return {
		outline: '2px solid #d63638',
		outlineOffset: 2,
		background: '#fdf2f2',
		borderRadius: 3,
	};
}

function parseOptions(v) {
	if (typeof v !== 'string') return [];
	try {
		const parsed = JSON.parse(v);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

// Inline editor for the options: [{label, value}, ...] array.
function OptionsEditor({ value, onChange }) {
	const opts = Array.isArray(value) ? value : [];

	const update = (idx, key, val) => {
		const next = opts.map((o, i) => (i === idx ? { ...o, [key]: val } : o));
		onChange(next);
	};
	const add = () => {
		const next = [...opts, { label: '', value: '' }];
		onChange(next);
	};
	const remove = (idx) => {
		onChange(opts.filter((_, i) => i !== idx));
	};

	return (
		<div style={{ width: '100%' }}>
			{opts.length === 0 && (
				<div style={{ ...S.muted, fontSize: 12, padding: '4px 0' }}>No options yet — add one below.</div>
			)}
			{opts.map((o, i) => (
				<div key={i} style={{
					display: 'grid',
					gridTemplateColumns: '1fr 1fr 24px',
					gap: 6, alignItems: 'center',
					padding: '2px 0',
				}}>
					<input
						type="text"
						value={o.label ?? ''}
						placeholder="Label"
						onChange={(e) => update(i, 'label', e.target.value)}
						style={{ ...S.input, padding: '4px 6px', fontSize: 13 }}
					/>
					<input
						type="text"
						value={o.value ?? ''}
						placeholder="value"
						onChange={(e) => update(i, 'value', e.target.value)}
						style={{
							...S.input,
							padding: '4px 6px',
							fontSize: 13,
							fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
						}}
					/>
					<button type="button" onClick={() => remove(i)} style={S.propRemove} title="Remove option">✕</button>
				</div>
			))}
			<button type="button" onClick={add} style={{
				marginTop: 4,
				background: 'none', border: '1px dashed #c3c4c7',
				color: '#525260', padding: '4px 8px',
				fontSize: 12, cursor: 'pointer', borderRadius: 3, width: '100%',
			}}>+ Add option</button>
		</div>
	);
}

// Inline editor for a repeater's fields: [{ type, attributeKey, label }, ...].
// Each row is a compact field-spec — type + attributeKey + label is enough
// for the common case. For richer sub-field config, edit the JSON directly.
function RepeaterFieldsEditor({ value, onChange }) {
	const rows = Array.isArray(value) ? value : [];

	const update = (idx, key, val) => {
		onChange(rows.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
	};
	const add = () => {
		onChange([...rows, { type: 'text', attributeKey: '', label: '' }]);
	};
	const remove = (idx) => {
		onChange(rows.filter((_, i) => i !== idx));
	};

	const types = CONFIG.controlTypes || [];

	return (
		<div style={{ width: '100%' }}>
			{rows.length === 0 && (
				<div style={{ ...S.muted, fontSize: 12, padding: '4px 0' }}>No sub-fields yet — add one below.</div>
			)}
			{rows.map((r, i) => (
				<div key={i} style={{
					display: 'grid',
					gridTemplateColumns: '110px 1fr 1fr 24px',
					gap: 6, alignItems: 'center',
					padding: '2px 0',
				}}>
					<select
						value={r.type || 'text'}
						onChange={(e) => update(i, 'type', e.target.value)}
						style={{
							...S.input,
							padding: '4px 6px', fontSize: 12,
							fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
						}}
					>
						{types.map((t) => (
							<option key={t} value={t}>{t}</option>
						))}
					</select>
					<input
						type="text"
						value={r.attributeKey ?? ''}
						placeholder="attributeKey"
						onChange={(e) => update(i, 'attributeKey', e.target.value)}
						style={{
							...S.input,
							padding: '4px 6px', fontSize: 13,
							fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
						}}
					/>
					<input
						type="text"
						value={r.label ?? ''}
						placeholder="Label"
						onChange={(e) => update(i, 'label', e.target.value)}
						style={{ ...S.input, padding: '4px 6px', fontSize: 13 }}
					/>
					<button type="button" onClick={() => remove(i)} style={S.propRemove} title="Remove sub-field">✕</button>
				</div>
			))}
			<button type="button" onClick={add} style={{
				marginTop: 4,
				background: 'none', border: '1px dashed #c3c4c7',
				color: '#525260', padding: '4px 8px',
				fontSize: 12, cursor: 'pointer', borderRadius: 3, width: '100%',
			}}>+ Add sub-field</button>
		</div>
	);
}

// Conditional-logic editor — pick a sibling attributeKey, an operator,
// and a value. Stored shape: { field, operator, value }. Mirrors the
// shape the field's validation contract already supports; in PHP this
// is read by the Inspector when deciding whether to render the field.
const CONDITIONAL_OPERATORS = ['=', '!=', '>', '>=', '<', '<=', 'contains', 'in', 'not_in', 'empty', 'not_empty'];

function ConditionalLogicEditor({ value, attrKeys, onChange }) {
	const v = (typeof value === 'object' && value !== null) ? value : {};
	const set = (patch) => onChange({ ...v, ...patch });
	const op = v.operator || '=';
	const noValueOp = op === 'empty' || op === 'not_empty';
	const multi = op === 'in' || op === 'not_in';

	// Native <select> and <input> render at different heights by
	// default. Force a single uniform sizing on all three cells.
	const cellStyle = {
		...S.input,
		height: 30,
		padding: '0 8px',
		fontSize: 13,
		boxSizing: 'border-box',
		lineHeight: '28px',
	};

	return (
		<div style={{
			width: '100%',
			display: 'grid',
			gridTemplateColumns: '1fr 1fr 1fr',
			gap: 8, alignItems: 'center',
		}}>
			<select
				value={v.field || ''}
				onChange={(e) => set({ field: e.target.value })}
				style={{ ...cellStyle, fontFamily: T.mono }}
			>
				<option value="">— Pick a sibling field —</option>
				{attrKeys.map((k) => (
					<option key={k} value={k}>{k}</option>
				))}
			</select>
			<select
				value={op}
				onChange={(e) => set({ operator: e.target.value })}
				style={{ ...cellStyle, fontFamily: T.mono }}
				disabled={!v.field}
			>
				{CONDITIONAL_OPERATORS.map((o) => (
					<option key={o} value={o}>{o}</option>
				))}
			</select>
			{noValueOp ? (
				<span style={{ ...S.muted, fontSize: 12, paddingLeft: 6, alignSelf: 'center' }}>(no value needed)</span>
			) : (
				<input
					type="text"
					value={Array.isArray(v.value) ? v.value.join(', ') : String(v.value ?? '')}
					onChange={(e) => {
						const raw = e.target.value;
						set({ value: multi
							? raw.split(',').map((s) => s.trim()).filter(Boolean)
							: raw });
					}}
					placeholder={multi ? 'comma, separated, values' : 'value'}
					style={cellStyle}
				/>
			)}
		</div>
	);
}

// ----------------------------------------------------------------------
// The "add a new property" row.
// ----------------------------------------------------------------------

const AddPropRow = forwardRef(function AddPropRow({ validProps, onAdd }, ref) {
	const [k, setK] = useState('');

	const commit = (name) => {
		if (!name) return;
		onAdd(name, '');
		setK('');
	};

	return (
		<div style={S.propRow}>
			<AutoInput
				ref={ref}
				value={k}
				suggestions={validProps.map((p) => p.name)}
				placeholder="+ add property…"
				monospace
				style={{ ...S.propKey, color: k ? '#1e1e1e' : '#999' }}
				onChange={setK}
				onCommit={commit}
				onTab={() => k && commit(k)}
			/>
			<span style={S.propColon} />
			<span style={S.propValue} />
		</div>
	);
});

// ======================================================================
// AutoInput — the core typeahead primitive used everywhere above.
// ======================================================================

const AutoInput = forwardRef(function AutoInput(
	{ value, suggestions = [], placeholder, style, monospace, onChange, onCommit, onTab },
	ref
) {
	const inputRef = useRef(null);
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);

	useImperativeHandle(ref, () => ({
		focus: () => inputRef.current?.focus(),
	}));

	const filtered = useMemo(() => {
		const q = String(value || '').toLowerCase();
		if (!q) return suggestions.slice(0, 8);
		return suggestions
			.filter((s) => String(s).toLowerCase().includes(q))
			.sort((a, b) => {
				const as = String(a).toLowerCase().startsWith(q);
				const bs = String(b).toLowerCase().startsWith(q);
				if (as && !bs) return -1;
				if (bs && !as) return 1;
				return String(a).localeCompare(String(b));
			})
			.slice(0, 8);
	}, [value, suggestions]);

	return (
		<span style={{ position: 'relative', display: 'inline-block', ...style }}>
			<input
				ref={inputRef}
				type="text"
				value={value}
				placeholder={placeholder}
				onChange={(e) => { onChange(e.target.value); setActive(0); setOpen(true); }}
				onFocus={() => setOpen(true)}
				onBlur={() => setTimeout(() => setOpen(false), 150)}
				onKeyDown={(e) => {
					if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(filtered.length - 1, a + 1)); setOpen(true); return; }
					if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); return; }
					if (e.key === 'Enter') {
						e.preventDefault();
						const choice = filtered[active];
						if (choice !== undefined) onCommit?.(String(choice));
						else onCommit?.(value);
						setOpen(false);
						return;
					}
					if (e.key === 'Tab') {
						e.preventDefault();
						const choice = filtered[active];
						if (choice !== undefined) onCommit?.(String(choice));
						onTab?.();
						setOpen(false);
						return;
					}
					if (e.key === 'Escape') { setOpen(false); }
				}}
				style={{
					width: '100%',
					border: 'none',
					padding: '4px 6px',
					background: 'transparent',
					fontFamily: monospace ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
					fontSize: 13,
					outline: 'none',
				}}
			/>
			{open && filtered.length > 0 && (
				<ul style={S.suggestList}>
					{filtered.map((s, i) => (
						<li
							key={s}
							onMouseDown={(e) => { e.preventDefault(); onCommit?.(String(s)); setOpen(false); }}
							onMouseEnter={() => setActive(i)}
							style={{ ...S.suggestItem, background: i === active ? '#f0f6fc' : 'transparent' }}
						>
							<code style={{ background: 'transparent', padding: 0 }}>{s}</code>
						</li>
					))}
				</ul>
			)}
		</span>
	);
});

// ======================================================================
// Decompose / compose.
// ======================================================================

/** Convert a control object → {type, props: [[k,v]…]}. Preserves key order. */
function controlToField(control) {
	const type = control.type || 'text';
	const props = [];
	for (const [k, v] of Object.entries(control)) {
		flattenInto(props, k, v);
	}
	return { type, props };
}

/** Inverse — recompose a field into a control object. Honours dot-paths. */
function fieldToControl(field) {
	const out = { type: field.type };
	for (const [k, v] of field.props) {
		if (k === 'type') continue; // type is held on the field directly
		assignDotPath(out, k, parsePrimitive(v));
	}
	return out;
}

/** Walk into nested objects, emitting dot-path rows. */
function flattenInto(acc, key, value, prefix = '') {
	const path = prefix ? `${prefix}.${key}` : key;
	if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
		for (const [k, v] of Object.entries(value)) flattenInto(acc, k, v, path);
		return;
	}
	acc.push([path, value == null ? '' : (Array.isArray(value) ? JSON.stringify(value) : value)]);
}

function assignDotPath(obj, path, value) {
	const parts = path.split('.');
	let cur = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		const k = parts[i];
		if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
		cur = cur[k];
	}
	cur[parts[parts.length - 1]] = value;
}

/** Cast a raw string into the JSON type our writer expects. */
function parsePrimitive(v) {
	if (typeof v !== 'string') return v;
	const t = v.trim();
	if (t === '') return '';
	if (t === 'true')  return true;
	if (t === 'false') return false;
	if (t === 'null')  return null;
	if (/^-?\d+$/.test(t)) return parseInt(t, 10);
	if (/^-?\d+\.\d+$/.test(t)) return parseFloat(t);
	if ((t.startsWith('[') && t.endsWith(']')) || (t.startsWith('{') && t.endsWith('}'))) {
		try { return JSON.parse(t); } catch {}
	}
	return v;
}

function coerceValue(v, propSpec) {
	// Currently a pass-through; serialization happens at save (parsePrimitive).
	// Hook left for future per-type coercion (e.g. ensuring booleans are lowercase).
	return v;
}

/** Suggest values based on property spec + context. */
function suggestValues(propSpec, key, fieldType, ctx) {
	if (!propSpec && !key) return [];
	// Cross-field references.
	if (key === 'parentPanelId') return ctx.panelIds;
	if (key === 'conditionalLogic.field') return ctx.attrKeys;
	if (key === 'type') return CONFIG.controlTypes || [];

	// Type-aware suggestions for `default` — the most context-dependent prop.
	if (key === 'default') {
		switch (fieldType) {
			case 'toggle':
			case 'checkbox':
				return ['true', 'false'];
			case 'color':
				return ['#5956E9', '#1e1e1e', '#ffffff'];
			case 'number':
			case 'range':
				return ['0', '1'];
			case 'select':
			case 'radio':
			case 'toggle-group':
				return []; // populated from sibling options in v2
			case 'image':
			case 'gallery':
			case 'file':
				return ['{}']; // empty media object
			default:
				return [];
		}
	}

	// Per-control-type prop hints from the docs frontmatter.
	if (propSpec?.type === 'boolean') return ['true', 'false'];
	if (key === 'taxonomy') return ['category', 'post_tag'];
	if (key === 'post_type') return ['post', 'page'];
	if (key === 'category') return ['widgets', 'text', 'media', 'design', 'theme', 'embed'];
	if (key === 'icon')     return ['core/layout', 'core/image', 'core/heading', 'core/list', 'core/quote'];
	if (key === 'variant' && fieldType === 'message') return ['neutral', 'info', 'warning', 'danger', 'success'];
	if (key === 'conditionalLogic.operator') return ['=', '!=', '>', '>=', '<', '<=', 'contains', 'in', 'not_in', 'empty', 'not_empty'];

	return [];
}

function jsType(label) {
	if (!label) return undefined;
	const n = String(label).toLowerCase();
	if (n.startsWith('boolean')) return 'boolean';
	if (n.startsWith('number') || n.startsWith('integer')) return 'number';
	if (n.startsWith('string')) return 'string';
	return undefined;
}

function isStructural(type) {
	return type === 'group' || type === 'panel' || type === 'tools-panel';
}

function uniqueId(base, fields) {
	let n = 1;
	let candidate = base;
	const taken = new Set(fields.map((f) => f.props.find(([k]) => k === 'id')?.[1]).filter(Boolean));
	while (taken.has(candidate)) candidate = `${base}_${++n}`;
	return candidate;
}

function uniqueAttributeKey(base, fields) {
	let n = 1;
	let candidate = base;
	const taken = new Set(fields.map((f) => f.props.find(([k]) => k === 'attributeKey')?.[1]).filter(Boolean));
	while (taken.has(candidate)) candidate = `${base}_${++n}`;
	return candidate;
}

// ======================================================================
// Per-field validation. Returns { [propKey]: errorMessage }.
// Empty object = field is valid.
//
// Called on every field on every keystroke (cheap — pure function over a
// small array). The output gets keyed back to the value-cell border colour
// in PropRow and to the red dot on the field row in the left list.
// ======================================================================

const ID_REGEX     = /^[a-z][a-z0-9_]*$/i;
const ATTRKEY_REGEX = /^[a-z_][a-z0-9_]*$/i;

function validateField(field, allFields) {
	const errors = {};
	const get = (k) => field.props.find(([pk]) => pk === k)?.[1];

	const id       = get('id');
	const attrKey  = get('attributeKey');
	const type     = field.type;

	if (!id || String(id).trim() === '') {
		errors.id = 'Required';
	} else if (!ID_REGEX.test(String(id))) {
		errors.id = 'Use letters, digits, underscores; start with a letter';
	} else {
		const dupId = allFields.filter((f) => f !== field).some((f) => f.props.find(([k]) => k === 'id')?.[1] === id);
		if (dupId) errors.id = 'Duplicate id';
	}

	// attributeKey is only required (and only checked) on non-structural.
	if (!isStructural(type)) {
		if (!attrKey || String(attrKey).trim() === '') {
			errors.attributeKey = 'Required';
		} else if (!ATTRKEY_REGEX.test(String(attrKey))) {
			errors.attributeKey = 'Use letters, digits, underscores; start with a letter or underscore';
		} else {
			const dupKey = allFields.filter((f) => f !== field).some((f) => f.props.find(([k]) => k === 'attributeKey')?.[1] === attrKey);
			if (dupKey) errors.attributeKey = 'Duplicate attributeKey';
		}
	}

	// `default` value vs field type.
	const def = get('default');
	if (def !== undefined && def !== '' && def !== null) {
		const e = validateDefault(def, type);
		if (e) errors.default = e;
	}

	// number / range: min ≤ max.
	if (type === 'number' || type === 'range') {
		const min = toNum(get('min'));
		const max = toNum(get('max'));
		if (min != null && max != null && min > max) {
			errors.min = 'min must be ≤ max';
			errors.max = 'max must be ≥ min';
		}
	}

	// Choice controls: `options` must be a non-empty array of {label, value}
	// with unique values.
	if (CHOICE_TYPES.has(type)) {
		const opts = get('options');
		const arr = Array.isArray(opts) ? opts : (typeof opts === 'string' ? safeParseArray(opts) : []);
		if (!Array.isArray(arr) || arr.length === 0) {
			errors.options = 'Need at least one option';
		} else {
			const values = arr.map((o) => o?.value).filter((v) => v !== undefined && v !== '');
			if (values.length !== arr.length) {
				errors.options = 'Every option needs a value';
			} else if (new Set(values).size !== values.length) {
				errors.options = 'Option values must be unique';
			}
		}
	}

	// parentPanelId must reference an existing structural sibling.
	const parent = get('parentPanelId');
	if (parent) {
		const panels = allFields.filter((f) => f !== field && isStructural(f.type))
			.map((f) => f.props.find(([k]) => k === 'id')?.[1]);
		if (!panels.includes(parent)) {
			errors.parentPanelId = 'No panel with that id';
		}
	}

	// conditionalLogic.field must reference an existing sibling attributeKey.
	const condField = get('conditionalLogic.field');
	if (condField) {
		const keys = allFields.filter((f) => f !== field)
			.map((f) => f.props.find(([k]) => k === 'attributeKey')?.[1])
			.filter(Boolean);
		if (!keys.includes(condField)) {
			errors['conditionalLogic.field'] = 'No sibling with that attributeKey';
		}
	}

	return errors;
}

function validateDefault(def, type) {
	const s = String(def);
	switch (type) {
		case 'number':
		case 'range':
			if (typeof def === 'number') return null;
			if (s === '' || isNaN(Number(s))) return 'Must be a number';
			return null;
		case 'toggle':
		case 'checkbox':
			if (typeof def === 'boolean') return null;
			if (s === 'true' || s === 'false') return null;
			return 'Must be true or false';
		case 'color':
			if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(s)) return null;
			return 'Must be a hex colour (e.g. #5956E9)';
		case 'url':
		case 'email':
			// Both stored as plain strings; let the runtime control validate
			// shape. Empty already filtered above.
			return null;
		default:
			return null;
	}
}

function toNum(v) {
	if (v === undefined || v === null || v === '') return null;
	const n = Number(v);
	return isNaN(n) ? null : n;
}

function safeParseArray(s) {
	try {
		const p = JSON.parse(s);
		return Array.isArray(p) ? p : [];
	} catch { return []; }
}

// ======================================================================
// Small UI bits.
// ======================================================================

function Notice({ type, children }) {
	const cmap = {
		error:   { bg: '#fdf2f2', border: '#d63638', fg: '#7c0c0c' },
		success: { bg: '#edfaef', border: '#00a32a', fg: '#0a4d12' },
		info:    { bg: '#f6f7f7', border: '#c3c4c7', fg: '#1e1e1e' },
	};
	const c = cmap[type] || cmap.info;
	return (
		<div style={{
			background: c.bg, borderLeft: `4px solid ${c.border}`, color: c.fg,
			padding: '12px 16px', margin: '12px 0', whiteSpace: 'pre-wrap',
		}}>{children}</div>
	);
}

function FormRow({ label, help, children }) {
	return (
		<div style={{ marginBottom: 16 }}>
			<label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{label}</label>
			{children}
			{help && <div style={{ fontSize: 12, color: '#525260', marginTop: 4 }}>{help}</div>}
		</div>
	);
}

function humanise(slug) {
	if (!slug) return '';
	return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ======================================================================
// Design tokens — Linear/Notion vibe. Indigo accent, deep ink text,
// off-white surface, subtle borders, generous whitespace.
// ======================================================================

const T = {
	accent:      '#2271b1',
	accentHover: '#135e96',
	accentSoft:  '#f0f6fc',
	ink:         '#111114',
	ink2:        '#3a3a44',
	ink3:        '#6b6b78',
	border:      '#e5e5ea',
	borderStrong:'#d4d4dc',
	surface:     '#ffffff',
	surfaceAlt:  '#fafafa',
	danger:      '#d63638',
	dangerSoft:  '#fdf2f2',
	warn:        '#b88300',
	warnSoft:    '#fff8e5',
	font:        '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
	mono:        'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace',
};

const S = {
	// Layout
	page:         { maxWidth: 1320, margin: '0 auto', padding: '32px 32px 80px', color: T.ink, fontFamily: T.font, fontSize: 14, lineHeight: 1.5 },
	header:       { marginBottom: 32 },
	h1:           { fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 6px', color: T.ink },
	h2:           { fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: T.ink },
	h3:           { fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px', color: T.ink3 },
	lede:         { color: T.ink3, margin: '4px 0 0', maxWidth: 720, fontSize: 14 },
	muted:        { color: T.ink3 },
	toolbar:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 0 20px' },

	// Forms
	form:         { maxWidth: 640 },
	input:        { width: '100%', padding: '8px 12px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 14, fontFamily: T.font, color: T.ink, background: T.surface, boxSizing: 'border-box', outline: 'none', transition: 'border-color 120ms, box-shadow 120ms' },
	radioRow:     { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 14, cursor: 'pointer' },

	// Buttons
	primaryBtn:   { background: T.accent, color: '#fff', border: 0, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, borderRadius: 6, transition: 'background 120ms', fontFamily: T.font },
	secondaryBtn: { background: T.surface, color: T.ink, border: `1px solid ${T.border}`, padding: '7px 15px', cursor: 'pointer', fontSize: 13, fontWeight: 500, borderRadius: 6, fontFamily: T.font },
	ghostBtn:     { background: 'transparent', color: T.ink2, border: 0, padding: '6px 10px', cursor: 'pointer', fontSize: 13, fontFamily: T.font, borderRadius: 6 },
	backLink:     { background: 'none', border: 0, color: T.ink3, cursor: 'pointer', padding: 0, fontSize: 13, marginBottom: 16, fontFamily: T.font, display: 'inline-flex', alignItems: 'center', gap: 4 },

	// List rows (used for blocks list + structured field-sets list)
	list:         { listStyle: 'none', padding: 0, margin: 0 },
	listCard:     { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' },
	listRow:      { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', transition: 'background 80ms' },
	listRowLast:  { borderBottom: 0 },
	addRow:       { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderTop: `1px solid ${T.border}`, color: T.ink3, fontSize: 13, background: T.surface },

	// Edit layout
	editLayout:   { display: 'grid', gridTemplateColumns: '370px 1fr', gap: 20, marginTop: 12, alignItems: 'flex-start' },
	fieldList:    { display: 'flex', flexDirection: 'column', gap: 2, background: T.surface, border: `1px solid ${T.border}`, padding: 8, borderRadius: 10, minHeight: 224 },
	fieldRow:     { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', transition: 'background 80ms' },
	iconBtn:      { background: 'none', border: 0, color: T.ink3, cursor: 'pointer', padding: '4px 6px', fontSize: 12, borderRadius: 4, fontFamily: T.font },
	newFieldWrap: { position: 'relative', marginTop: 4 },
	newFieldInput:{ width: '100%', padding: '10px 12px', border: `1px dashed ${T.borderStrong}`, borderRadius: 6, fontSize: 13, background: 'transparent', color: T.ink2, boxSizing: 'border-box', fontFamily: T.font, outline: 'none' },

	// Property pane
	propPane:     { background: T.surface, border: `1px solid ${T.border}`, padding: 20, borderRadius: 10, minHeight: 224 },
	propTable:    { display: 'flex', flexDirection: 'column', gap: 0 },
	propRow:      { display: 'grid', gridTemplateColumns: '200px 12px 1fr 24px', alignItems: 'center', gap: 4, padding: '6px 0', borderBottom: `1px solid ${T.border}` },
	propKey:      { width: '100%', border: 0, background: 'transparent', fontFamily: T.mono, fontSize: 13, color: T.ink, padding: '4px 6px', outline: 'none' },
	propColon:    { color: T.ink3, textAlign: 'center' },
	propValue:    { width: '100%', border: `1px solid transparent`, background: 'transparent', fontSize: 13, color: T.ink, padding: '4px 8px', borderRadius: 4, outline: 'none', fontFamily: T.font },
	propRemove:   { background: 'none', border: 0, color: T.ink3, cursor: 'pointer', padding: 0, fontSize: 12, fontFamily: T.font },

	// Autocomplete
	suggestList:  { position: 'absolute', top: '100%', left: 0, right: 0, margin: 0, padding: 4, listStyle: 'none', background: T.surface, border: `1px solid ${T.border}`, boxShadow: '0 6px 18px rgba(17, 17, 20, 0.08)', zIndex: 10, maxHeight: 240, overflowY: 'auto', borderRadius: 8, marginTop: 4 },
	suggestItem:  { padding: '6px 10px', fontSize: 13, cursor: 'pointer', borderRadius: 4, fontFamily: T.font, color: T.ink },

	// Metadata header strip (inside EditFields)
	metaStrip:    { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 16 },
	metaGrid:     { display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(160px, auto) minmax(180px, auto)', gap: 16, alignItems: 'end' },
	metaLabel:    { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.ink3, marginBottom: 4 },

	// Chip (used for kind badges, NEW affordance, etc.). Matches the
	// in-input slug-badge style: surface-alt background, hairline border,
	// monospace, ink text. No color variants.
	chip:         {
		display: 'inline-flex', alignItems: 'center',
		padding: '3px 8px', borderRadius: 4,
		fontSize: 11, lineHeight: 1.4,
		fontFamily: T.mono,
		background: T.surfaceAlt, color: T.ink3,
		border: `1px solid ${T.border}`,
	},
};

// Kept as a single shared palette so every callsite resolves uniformly.
// Same neutral look across all kinds — distinct from the slug badge only
// by their lettering.
const CHIP_COLORS = {
	post:     { bg: T.surfaceAlt, fg: T.ink3 },
	taxonomy: { bg: T.surfaceAlt, fg: T.ink3 },
	options:  { bg: T.surfaceAlt, fg: T.ink3 },
	user:     { bg: T.surfaceAlt, fg: T.ink3 },
	block:    { bg: T.surfaceAlt, fg: T.ink3 },
};

// ======================================================================
// Mount. wp_enqueue_script puts admin scripts in the footer, so by the
// time this runs DOMContentLoaded has already fired. Mount immediately.
// ======================================================================

function mount() {
	const root = document.getElementById('gcblite-schema-builder-root');
	if (!root) return;
	const initialView = root.getAttribute('data-view') || 'blocks';
	root.innerHTML = '';
	root.setAttribute('data-state', 'ready');
	createRoot(root).render(<App initialView={initialView} />);
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', mount);
} else {
	mount();
}
