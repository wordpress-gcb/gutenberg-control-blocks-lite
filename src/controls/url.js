import { BaseControl, Button, Popover } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { __experimentalLinkControl as LinkControl } from '@wordpress/block-editor';

/**
 * URL control — returns `{ url, text, opensInNewTab }`.
 * UI: shows the saved URL with an Edit button that pops out a LinkControl.
 */
export default function UrlField({ control, value, onChange }) {
	const [editing, setEditing] = useState(false);
	const link = value && typeof value === 'object' ? value : { url: '', text: '', opensInNewTab: false };
	const hasUrl = !!link.url;

	return (
		<BaseControl label={control.label} help={control.helpText} __nextHasNoMarginBottom>
			<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
				<div style={{ flex: 1, fontSize: 12, color: hasUrl ? '#1e1e1e' : '#757575', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
					{hasUrl ? (link.text || link.url) : __('No link set', 'gcblite')}
				</div>
				<Button variant="secondary" size="small" onClick={() => setEditing((e) => !e)}>
					{hasUrl ? __('Edit', 'gcblite') : __('Set link', 'gcblite')}
				</Button>
				{hasUrl && (
					<Button variant="tertiary" size="small" isDestructive onClick={() => onChange({ url: '', text: '', opensInNewTab: false })}>
						{__('Clear', 'gcblite')}
					</Button>
				)}
			</div>
			{editing && (
				<Popover onClose={() => setEditing(false)} placement="bottom-start">
					<div style={{ width: 320, padding: 8 }}>
						<LinkControl
							value={link}
							onChange={(next) => onChange({
								url: next.url || '',
								text: next.title || link.text || '',
								opensInNewTab: !!next.opensInNewTab,
							})}
							settings={[
								{ id: 'opensInNewTab', title: __('Open in new tab', 'gcblite') },
							]}
						/>
					</div>
				</Popover>
			)}
		</BaseControl>
	);
}
