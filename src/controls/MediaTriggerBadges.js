/**
 * MediaTriggerBadges — places an inline clear (×) button to the right of
 * a media-control toggle. Used by ImageField and FileField on the metabox
 * surface. Edit affordance isn't needed — clicking the trigger itself
 * opens the picker/popover.
 */

import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';

const WRAP_STYLE = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: 6,
};

export default function MediaTriggerBadges({ children, onClear, hideClear }) {
	return (
		<span style={WRAP_STYLE} className="gcb-media-trigger-badges">
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
