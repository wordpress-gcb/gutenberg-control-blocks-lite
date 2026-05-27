/**
 * IconField — visual picker over the WP 7.0+ icon registry.
 *
 * Stored shape:
 *   { source: 'wp', name: 'core/arrow-down-left' }
 *
 * Authors don't type the name — they pick from a searchable grid in
 * a Popover. Icons come from /wp/v2/icons (the new WP 7.0 endpoint,
 * server-side registry exposed over REST). Storage is just the name;
 * render.php on the server hits WP_Icons_Registry to resolve to SVG
 * at render time so post_content stays small.
 *
 * Requires WP 7.0+. On older WP the endpoint 404s and the picker
 * surfaces a clear "needs WordPress 7.0" message rather than trying
 * to be clever with a legacy dashicon fallback.
 *
 * Older saved values that used the v1 shape ({ source: 'dashicon', icon })
 * still render — render.php dispatches by source. The picker just can't
 * MAKE a dashicon value anymore (one-way migration).
 */

import { __, sprintf } from '@wordpress/i18n';
import { useState, useEffect, useRef, useMemo } from '@wordpress/element';
import {
	Button,
	Popover,
	Spinner,
	TextControl,
	BaseControl,
} from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';

// Module-level cache for the icon catalogue. /wp/v2/icons returns all
// 88 icons in one request; we only need to fetch it once per page load
// regardless of how many icon fields are rendered.
let iconCache = null;
let iconFetchPromise = null;
let iconFetchError = null;

async function fetchAllIconPages() {
	// WP 7.0's icons endpoint caps per_page at 100 and there are 88
	// core icons. WP 7.1+ will let plugins register more, so paginate
	// at 100/page until a short page comes back.
	const all = [];
	for (let page = 1; page < 50; page++) {
		// eslint-disable-next-line no-await-in-loop
		const chunk = await apiFetch({ path: `/wp/v2/icons?per_page=100&page=${page}` });
		if (!Array.isArray(chunk) || chunk.length === 0) break;
		all.push(...chunk);
		if (chunk.length < 100) break;
	}
	return all;
}

function fetchIcons() {
	if (iconCache) return Promise.resolve(iconCache);
	if (iconFetchError) return Promise.reject(iconFetchError);
	if (iconFetchPromise) return iconFetchPromise;
	iconFetchPromise = fetchAllIconPages()
		.then((items) => {
			iconCache = items;
			return iconCache;
		})
		.catch((err) => {
			iconFetchError = err;
			iconFetchPromise = null;
			throw err;
		});
	return iconFetchPromise;
}

function useIcons() {
	const [icons, setIcons] = useState(iconCache);
	const [error, setError] = useState(null);
	useEffect(() => {
		if (icons) return;
		let cancelled = false;
		fetchIcons()
			.then((list) => { if (!cancelled) setIcons(list); })
			.catch((err) => {
				if (cancelled) return;
				const status = err?.data?.status;
				if (status === 404 || err?.code === 'rest_no_route') {
					setError('unsupported');
				} else {
					setError('fetch-failed');
				}
			});
		return () => { cancelled = true; };
	}, [icons]);
	return { icons, error };
}

/**
 * Inline-render an SVG string. We have to use dangerouslySetInnerHTML
 * because the icon `content` is an `<svg>...</svg>` string from the
 * registry, not a React element. The strings come from a trusted
 * server-side registry — no user content.
 */
function IconSvg({ content, className }) {
	if (!content) return null;
	return (
		<span
			className={className}
			aria-hidden="true"
			dangerouslySetInnerHTML={{ __html: content }}
		/>
	);
}

function normalize(v) {
	if (!v || typeof v !== 'object') return { source: 'wp', name: '' };
	return {
		source: v.source || 'wp',
		name: v.name || v.icon || '',
	};
}

export default function IconField({ control, value, onChange }) {
	const current = normalize(value);
	const { icons, error } = useIcons();
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState('');
	const triggerRef = useRef(null);

	const currentIcon = useMemo(() => {
		if (!icons || !current.name) return null;
		return icons.find((i) => i.name === current.name) || null;
	}, [icons, current.name]);

	const filtered = useMemo(() => {
		if (!icons) return [];
		if (!search) return icons;
		const q = search.toLowerCase();
		return icons.filter((i) =>
			i.name.toLowerCase().includes(q) ||
			(i.label || '').toLowerCase().includes(q)
		);
	}, [icons, search]);

	const pick = (name) => {
		onChange({ source: 'wp', name });
		setOpen(false);
		setSearch('');
	};

	const clear = () => {
		onChange({ source: 'wp', name: '' });
		setOpen(false);
	};

	return (
		<BaseControl
			label={control.label}
			help={control.helpText}
			className="gcb-icon-control"
			__nextHasNoMarginBottom
		>
			<Button
				ref={triggerRef}
				variant="secondary"
				onClick={() => setOpen((v) => !v)}
				className="gcb-icon-control__trigger"
				aria-expanded={open}
			>
				{currentIcon ? (
					<>
						<IconSvg content={currentIcon.content} className="gcb-icon-control__trigger-svg" />
						<span className="gcb-icon-control__trigger-label">{currentIcon.label}</span>
					</>
				) : (
					<span className="gcb-icon-control__trigger-empty">
						{current.name
							? sprintf(__('Unknown icon (%s)', 'gcblite'), current.name)
							: __('Choose an icon…', 'gcblite')}
					</span>
				)}
				<span aria-hidden className="gcb-icon-control__trigger-caret">▾</span>
			</Button>

			{open && (
				<Popover
					anchor={triggerRef.current}
					onClose={() => { setOpen(false); setSearch(''); }}
					placement="bottom-start"
					className="gcb-icon-control__popover"
				>
					<div className="gcb-icon-control__panel">
						{error === 'unsupported' && (
							<p className="gcb-icon-control__error">
								{__('The icon picker needs WordPress 7.0 or newer.', 'gcblite')}
							</p>
						)}
						{error === 'fetch-failed' && (
							<p className="gcb-icon-control__error">
								{__('Could not load icons from the REST API.', 'gcblite')}
							</p>
						)}
						{!error && !icons && (
							<div className="gcb-icon-control__loading"><Spinner /></div>
						)}
						{!error && icons && (
							<>
								<TextControl
									label={__('Search icons', 'gcblite')}
									hideLabelFromVision
									placeholder={__('Search…', 'gcblite')}
									value={search}
									onChange={setSearch}
									__nextHasNoMarginBottom
									__next40pxDefaultSize
								/>
								<div className="gcb-icon-control__grid" role="listbox">
									{filtered.length === 0 && (
										<p className="gcb-icon-control__empty">
											{__('No icons match.', 'gcblite')}
										</p>
									)}
									{filtered.map((icon) => (
										<button
											key={icon.name}
											type="button"
											role="option"
											aria-selected={icon.name === current.name}
											className={`gcb-icon-control__option${icon.name === current.name ? ' is-selected' : ''}`}
											title={icon.label}
											onClick={() => pick(icon.name)}
										>
											<IconSvg content={icon.content} className="gcb-icon-control__option-svg" />
										</button>
									))}
								</div>
								{current.name && (
									<div className="gcb-icon-control__footer">
										<Button variant="tertiary" onClick={clear} isDestructive>
											{__('Clear icon', 'gcblite')}
										</Button>
									</div>
								)}
							</>
						)}
					</div>
				</Popover>
			)}
		</BaseControl>
	);
}
