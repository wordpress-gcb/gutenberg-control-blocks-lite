/**
 * Surface-aware replacement for @wordpress/block-editor's MediaUploadCheck.
 *
 * MediaUploadCheck reads from the `core/editor` store to decide whether to
 * render its children — but `core/editor` is only bootstrapped on screens
 * that load the block editor. On a classic meta-box-only screen (which is
 * what gcb-lite post-fields produces by stripping 'editor' support from
 * field-only CPTs), the store doesn't exist and MediaUploadCheck silently
 * renders nothing. Result: image / gallery / file fields appear as a label
 * only.
 *
 * We don't need MediaUploadCheck on the meta-box surface because admin-side
 * gcb-lite enqueues only happen for users WP already granted screen access
 * to — anyone editing this post has at minimum `edit_posts`. (Real upload
 * gating still happens server-side inside wp.media when the user tries to
 * actually upload a file.)
 *
 * On the sidebar (block editor) surface, MediaUploadCheck still matters —
 * blocks can be rendered in contexts where the editor store exists but the
 * user can't upload. So we pass through to it there.
 */

import { useContext } from '@wordpress/element';
import { MediaUploadCheck } from '@wordpress/block-editor';
import { ControlContext } from '../control-context';

export default function MediaCapabilityGate({ children }) {
	const ctx = useContext(ControlContext);
	if (ctx.variant === 'metabox') {
		return children;
	}
	return <MediaUploadCheck>{children}</MediaUploadCheck>;
}
