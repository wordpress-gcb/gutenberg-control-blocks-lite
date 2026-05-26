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

import { MediaUpload } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';

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

	const frame = window.wp.media({
		title:    gallery ? 'Edit gallery' : 'Select media',
		button:   { text: gallery ? 'Update gallery' : 'Use this media' },
		library:  allowedTypes ? { type: allowedTypes } : undefined,
		multiple: gallery ? 'add' : !!multiple,
		state:    gallery ? 'gallery-edit' : 'library',
	});

	// Pre-select prior value so the user lands on the existing pick.
	frame.on('open', () => {
		const selection = frame.state().get('selection');
		if (!selection) return;
		const ids = Array.isArray(value) ? value : (value ? [value] : []);
		ids.forEach((id) => {
			const attachment = window.wp.media.attachment(id);
			attachment.fetch();
			selection.add(attachment ? [attachment] : []);
		});
	});

	frame.on(gallery ? 'update' : 'select', () => {
		const selection = frame.state().get('selection');
		if (!selection) return;
		const picks = selection.toArray().map(toPlainAttachment);
		if (multiple || gallery) {
			onSelect(picks);
		} else {
			onSelect(picks[0] || null);
		}
	});

	frame.open();
}

/**
 * Decide which backend to use. If the block-editor data store is
 * registered, we can trust MediaUpload. Otherwise we fall back to
 * wp.media() directly.
 *
 * The check has to be done at render time inside a hook — useSelect
 * returning `undefined` when the store is absent is the lightest
 * signal we have.
 */
export default function MediaPicker(props) {
	const blockEditorReady = useSelect((select) => {
		// `select('core/block-editor')` returns null/undefined if the
		// store isn't registered. We don't need any of its data, just
		// the registration check.
		return !!select('core/block-editor');
	}, []);

	if (blockEditorReady) {
		return <MediaUpload {...props} />;
	}

	// Render prop with a synthetic `open` that fires wp.media().
	const open = () => openClassicMediaFrame(props);
	return props.render ? props.render({ open }) : null;
}
