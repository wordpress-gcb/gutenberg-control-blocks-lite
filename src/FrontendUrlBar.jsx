/**
 * FrontendUrlBar — Storybook-style strip at the top of the editor that
 * shows where the live preview is being rendered from.
 *
 * Mounted imperatively (not via @wordpress/plugins registerPlugin) so
 * the bar never blocks the editor from initialising. We inject our own
 * React root into a div above the editor skeleton, with a polling +
 * MutationObserver fallback for SPA-style navigation between pages.
 */

import { createRoot } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

const T = {
	indigo:      '#5956E9',
	indigoSoft:  '#f1f1fe',
	indigoText:  '#1d1c8a',
	ink:         '#111114',
	ink2:        '#3a3a44',
	ink3:        '#6b6b78',
	border:      '#e5e5ea',
	surface:     '#ffffff',
	surfaceAlt:  '#fafafa',
	mono:        'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace',
	font:        '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
};

const HOST_ID = 'gcblite-frontend-url-bar';

function GlobeIcon({ size = 13, color }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color || 'currentColor'}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
		>
			<circle cx="12" cy="12" r="10" />
			<line x1="2" y1="12" x2="22" y2="12" />
			<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
		</svg>
	);
}

function ArrowRightIcon({ color }) {
	return (
		<svg
			width={12}
			height={12}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color || 'currentColor'}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
		>
			<line x1="5" y1="12" x2="19" y2="12" />
			<polyline points="12 5 19 12 12 19" />
		</svg>
	);
}

function HeadlessBar({ url, source, settingsUrl }) {
	return (
		<div style={{
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'space-between',
			gap: 16,
			padding: '8px 20px',
			background: `linear-gradient(90deg, ${T.indigo} 0%, #6e6df0 100%)`,
			color: '#fff',
			fontFamily: T.font,
			fontSize: 13,
			fontWeight: 500,
			boxShadow: '0 2px 8px rgba(89, 86, 233, 0.15)',
			borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
		}}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
					<span
						aria-label={__('Live', 'gcblite')}
						style={{
							display: 'inline-block',
							width: 8,
							height: 8,
							borderRadius: '50%',
							background: '#86efac',
							animation: 'gcblite-pulse 2s ease-in-out infinite',
						}}
					/>
					<span style={{
						fontSize: 10,
						fontWeight: 700,
						letterSpacing: '0.08em',
						textTransform: 'uppercase',
						opacity: 0.9,
					}}>
						{__('Headless', 'gcblite')}
					</span>
				</div>

				<span style={{ opacity: 0.7, fontSize: 13 }}>
					{__('Rendering from', 'gcblite')}
				</span>

				<ArrowRightIcon color="rgba(255,255,255,0.65)" />

				<code style={{
					fontFamily: T.mono,
					fontSize: 13,
					padding: '4px 10px',
					background: 'rgba(255, 255, 255, 0.15)',
					border: '1px solid rgba(255, 255, 255, 0.2)',
					borderRadius: 6,
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap',
					maxWidth: 480,
				}}>
					{url}
				</code>
			</div>

			<div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
				<span
					title={source}
					style={{
						fontSize: 10,
						fontWeight: 700,
						letterSpacing: '0.06em',
						textTransform: 'uppercase',
						padding: '3px 8px',
						background: 'rgba(255, 255, 255, 0.15)',
						border: '1px solid rgba(255, 255, 255, 0.2)',
						borderRadius: 4,
					}}
				>
					{source}
				</span>

				<a
					href={url}
					target="_blank"
					rel="noopener noreferrer"
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: 6,
						padding: '5px 12px',
						background: '#fff',
						color: T.indigoText,
						borderRadius: 6,
						textDecoration: 'none',
						fontSize: 12,
						fontWeight: 600,
					}}
				>
					<GlobeIcon size={13} color={T.indigoText} />
					{__('Visit', 'gcblite')}
				</a>

				{source === 'option' && (
					<a
						href={settingsUrl}
						style={{
							color: 'rgba(255, 255, 255, 0.85)',
							fontSize: 12,
							textDecoration: 'none',
							borderBottom: '1px dotted rgba(255, 255, 255, 0.5)',
						}}
					>
						{__('Change', 'gcblite')}
					</a>
				)}
			</div>
		</div>
	);
}

function PhpBar({ siteUrl, settingsUrl }) {
	return (
		<div style={{
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'space-between',
			gap: 16,
			padding: '6px 20px',
			background: T.surfaceAlt,
			color: T.ink2,
			fontFamily: T.font,
			fontSize: 12,
			borderBottom: `1px solid ${T.border}`,
		}}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
				<span style={{
					fontSize: 10,
					fontWeight: 700,
					letterSpacing: '0.08em',
					textTransform: 'uppercase',
					color: T.ink3,
				}}>
					{__('PHP-rendered', 'gcblite')}
				</span>
				<span style={{ opacity: 0.6 }}>{__('Rendering from', 'gcblite')}</span>
				<code style={{
					fontFamily: T.mono,
					fontSize: 12,
					color: T.ink,
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap',
					maxWidth: 360,
				}}>
					{siteUrl}
				</code>
			</div>
			<a
				href={settingsUrl}
				style={{
					fontSize: 11,
					color: T.ink3,
					textDecoration: 'none',
					borderBottom: `1px dotted ${T.ink3}`,
				}}
			>
				{__('Configure headless', 'gcblite')}
			</a>
		</div>
	);
}

function FrontendUrlBar({ data }) {
	const bar = data.isHeadless
		? <HeadlessBar url={data.url} source={data.source} settingsUrl={data.settingsUrl} />
		: <PhpBar siteUrl={data.siteUrl} settingsUrl={data.settingsUrl} />;
	return (
		<>
			{bar}
			<style>{`
				@keyframes gcblite-pulse {
					0%   { box-shadow: 0 0 0 0 rgba(134, 239, 172, 0.7); }
					70%  { box-shadow: 0 0 0 6px rgba(134, 239, 172, 0); }
					100% { box-shadow: 0 0 0 0 rgba(134, 239, 172, 0); }
				}
			`}</style>
		</>
	);
}

/**
 * Imperatively mount the bar above the block editor. Uses a polling
 * fallback + DOM mutation observer so we work across WP's various
 * mount timings (post.php, site-editor.php, etc.) without depending
 * on any internal API.
 */
export function mountFrontendUrlBar() {
	if (typeof window === 'undefined') return;
	const data = window.gcbLite?.frontend;
	if (!data) return;

	let mounted = false;
	let attempts = 0;
	const maxAttempts = 50; // ~4s @ 80ms

	const tryMount = () => {
		if (mounted) return true;
		attempts++;

		// Look for the editor's skeleton. We bail silently if the page
		// isn't an editor screen — settings pages, list tables etc. don't
		// need this strip.
		const skeleton =
			document.querySelector('.interface-interface-skeleton') ||
			document.querySelector('.editor-styles-wrapper')?.closest('.block-editor') ||
			document.querySelector('.edit-post-layout');
		if (!skeleton || !skeleton.parentElement) {
			return false;
		}

		// Don't re-inject.
		if (document.getElementById(HOST_ID)) {
			mounted = true;
			return true;
		}

		// Pin the bar directly below the WP admin bar. We can't insert
		// inline before the editor skeleton — WP's own header chrome
		// sits position:fixed at top:32px and would render OVER an
		// in-flow strip, AND our strip would push the rest of the
		// editor's chrome down by its own height. Fixed positioning
		// dodges both problems; we compensate by adding margin-top to
		// the skeleton so the editor's content + header still clear.
		const adminBar = document.getElementById('wpadminbar');
		const barOffset = adminBar ? adminBar.offsetHeight : 32;
		const BAR_HEIGHT_PX = 38; // matches HeadlessBar padding 8 + content ~22 + border

		const host = document.createElement('div');
		host.id = HOST_ID;
		host.style.position = 'fixed';
		host.style.top = `${barOffset}px`;
		host.style.left = '0';
		host.style.right = '0';
		host.style.zIndex = '99998'; // just under #wpadminbar (99999)
		document.body.appendChild(host);

		// Shift the editor down so its own top chrome (Save bar, etc.)
		// doesn't sit under our strip. We measure the rendered bar on
		// the next frame because content-driven height is not known
		// until after first paint.
		const applyOffset = () => {
			const measuredHeight = host.offsetHeight || BAR_HEIGHT_PX;
			skeleton.style.marginTop = `${measuredHeight}px`;
			// Match the body padding-top that WP set for the admin bar
			// so any other fixed editor chrome (e.g. fullscreen header)
			// still clears. We bump the existing var rather than
			// replacing it.
			document.documentElement.style.setProperty(
				'--gcblite-frontend-bar-height',
				`${measuredHeight}px`
			);
		};

		try {
			const root = createRoot(host);
			root.render(<FrontendUrlBar data={data} />);
			mounted = true;
			requestAnimationFrame(applyOffset);
		} catch (e) {
			// Defensive — if React mounting throws, remove our host to
			// avoid leaving an orphan div in the editor chrome.
			if (host.parentElement) host.parentElement.removeChild(host);
			// eslint-disable-next-line no-console
			console.warn('gcblite: FrontendUrlBar mount failed', e);
		}
		return mounted;
	};

	// Try immediately, then poll on a short interval, then back off.
	const poll = () => {
		if (tryMount()) return;
		if (attempts < maxAttempts) {
			setTimeout(poll, 80);
		}
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', poll, { once: true });
	} else {
		poll();
	}
}

export default FrontendUrlBar;
