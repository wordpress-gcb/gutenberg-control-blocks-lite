/**
 * MediaPicker — a `MediaUpload`-shaped component that works on any
 * admin screen.
 *
 * `@wordpress/block-editor`'s `MediaUpload` requires the `core/block-editor`
 * data store, which is only initialised on screens that bootstrap the
 * block editor itself (post.php, site-editor.php, widgets.php). On
 * profile.php, term.php, options.php — anywhere we mount our post-fields
 * bundle on a classic admin page — the store isn't there, so the
 * MediaUpload modal silently fails to open and the image / gallery /
 * file controls feel broken.
 *
 * This wrapper falls back to the lower-level `wp.media()` JS API on
 * non-editor screens. wp.media is what WP's own avatar uploader uses
 * and is loaded by wp_enqueue_media() — available on every admin page
 * we care about. It's not React; we wrap it in the same render-prop
 * shape MediaUpload exposes so callers don't need to know which path
 * they're on.
 *
 * Shape:
 *   <MediaPicker
 *     onSelect={(media) => …}           // single media object (or array)
 *     allowedTypes={['image']}
 *     value={123 | [123,124] | null}
 *     multiple={false}
 *     gallery={false}
 *     render={({ open }) => <button onClick={open}>Pick</button>}
 *   />
 */

import { useContext } from '@wordpress/element';
import { MediaUpload } from '@wordpress/block-editor';
import { ControlContext } from '../control-context';

/**
 * Translate a wp.media attachment model into the same plain object
 * @wordpress/block-editor's MediaUpload onSelect receives.
 */
function toPlainAttachment(attachment) {
	const a = attachment.toJSON ? attachment.toJSON() : attachment;
	return {
		id:               a.id,
		url:              a.url,
		alt:              a.alt || '',
		title:            a.title || a.filename || '',
		filename:         a.filename || '',
		caption:          a.caption || '',
		description:      a.description || '',
		mime:             a.mime || a.type || '',
		type:             a.type || '',
		subtype:          a.subtype || '',
		width:            a.width,
		height:           a.height,
		filesizeInBytes:  a.filesizeInBytes,
		sizes:            a.sizes,
	};
}

function openClassicMediaFrame({ allowedTypes, multiple, gallery, value, onSelect }) {
	if (typeof window === 'undefined' || !window.wp || !window.wp.media) {
		// eslint-disable-next-line no-console
		console.warn('gcb-lite: wp.media not loaded — call wp_enqueue_media() on this screen.');
		return;
	}

	// IMPORTANT: don't open directly into 'gallery-edit' — WP 7.0's
	// media-views.js bootstraps menu/router state lazily, and asking for
	// 'gallery-edit' before the menu state exists throws
	// `Cannot read properties of undefined (reading 'get')` in
	// setMenuTabPanelAriaAttributes. The supported gallery flow is to open
	// the library with `multiple: true`, pre-select the existing images,
	// and treat the result as a gallery on 'select'.
	const isMulti = !!(gallery || multiple);

	const frame = window.wp.media({
		title:    gallery ? 'Edit gallery' : (isMulti ? 'Select media' : 'Select media'),
		button:   { text: gallery ? 'Update gallery' : 'Use this media' },
		library:  allowedTypes ? { type: allowedTypes } : undefined,
		multiple: isMulti,
	});

	// Pre-select prior value so the user lands on the existing pick.
	frame.on('open', () => {
		const selection = frame.state().get('selection');
		if (!selection) return;
		const ids = Array.isArray(value) ? value : (value ? [value] : []);
		ids.forEach((id) => {
			if (!id) return;
			const attachment = window.wp.media.attachment(id);
			if (!attachment) return;
			attachment.fetch();
			selection.add([attachment]);
		});
	});

	frame.on('select', () => {
		const selection = frame.state().get('selection');
		if (!selection) return;
		const picks = selection.toArray().map(toPlainAttachment);
		if (isMulti) {
			onSelect(picks);
		} else {
			onSelect(picks[0] || null);
		}
	});

	frame.open();
}

/**
 * Decide which backend to use based on render surface:
 *
 * - Block Inspector ('sidebar' variant): MediaUpload from
 *   @wordpress/block-editor. That's the right tool inside the block
 *   editor — it integrates with the editor's upload flow + capability
 *   store.
 *
 * - Post-fields meta-box / Options / Taxonomy / User pages
 *   ('metabox' variant): wp.media() directly. These screens often DON'T
 *   bootstrap the block editor (we strip 'editor' support from
 *   field-only CPTs), and MediaUpload silently renders nothing when the
 *   editor stores aren't fully initialised. wp.media() is the lower-
 *   level JS API loaded by wp_enqueue_media() — works on any admin page.
 *
 * Surface decision is made via ControlContext, which post-fields.js
 * sets to 'metabox' and the block Inspector leaves at 'sidebar'.
 */
export default function MediaPicker(props) {
	const ctx = useContext(ControlContext);

	if (ctx.variant !== 'metabox') {
		return <MediaUpload {...props} />;
	}

	// Metabox surface — synthesize the same render-prop shape with a
	// wp.media() backend.
	const open = () => openClassicMediaFrame(props);
	return props.render ? props.render({ open }) : null;
}
