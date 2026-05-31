/**
 * MediaTriggerBadges — places an inline clear (×) button to the right of
 * a media-control toggle. Used by ImageField and FileField on the metabox
 * surface. Edit affordance isn't needed — clicking the trigger itself
 * opens the picker/popover.
 */

import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';

// Default sizing is content-width (inline-flex). In sidebar / Inspector
// contexts an external rule promotes it to full-width — see editor.scss
// "Sidebar / Inspector surface: media trigger fills width".
export default function MediaTriggerBadges({ children, onClear, hideClear }) {
	return (
		<span className="gcb-media-trigger-badges">
			{children}
			{!hideClear && (
				<Button
					variant="tertiary"
					isDestructive
					onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClear?.(); }}
					aria-label={__('Clear', 'gcblite')}
					title={__('Clear', 'gcblite')}
				>
					✕
				</Button>
			)}
		</span>
	);
}
