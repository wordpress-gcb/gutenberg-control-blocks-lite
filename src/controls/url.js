import { BaseControl, Button, Popover, Modal, TextControl, CheckboxControl, __experimentalHStack as HStack, __experimentalSpacer as Spacer } from '@wordpress/components';
import { useState, useContext } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { __experimentalLinkControl as LinkControl } from '@wordpress/block-editor';
import { ControlContext } from '../control-context';

/**
 * URL control — stores `{ url, text, opensInNewTab }`.
 *
 * Two renderings of the same stored shape:
 *   - **Sidebar context** (block Inspector): compact summary + Edit popover
 *     that mounts the rich @wordpress/block-editor LinkControl.
 *   - **Meta-box context** (post-fields panel): three stacked inputs
 *     (URL, link text, open-in-new-tab checkbox). The popover-based UI
 *     feels out of place in a wide meta-box and the LinkControl's
 *     post/page suggestions push the popover off-screen.
 *
 * Both render the same data; the chooser is the `variant` field on the
 * ControlContext provider supplied by the host (block edit.js vs the
 * post-fields meta-box App). Default is sidebar.
 *
 * When wiring a React component on the frontend:
 *   const { url, text, opensInNewTab } = link || {};
 *   if (!url) return null;
 *   return <a
 *     href={url}
 *     target={opensInNewTab ? '_blank' : undefined}
 *     rel={opensInNewTab ? 'noopener noreferrer' : undefined}
 *   >{text || url}</a>;
 */
export default function UrlField({ control, value, onChange }) {
	const ctx = useContext(ControlContext);
	const link = value && typeof value === 'object'
		? value
		: { url: '', text: '', opensInNewTab: false };

	if (ctx.variant === 'metabox') {
		return <MetaboxUrl control={control} link={link} onChange={onChange} />;
	}
	return <SidebarUrl control={control} link={link} onChange={onChange} />;
}

function MetaboxUrl({ control, link, onChange }) {
	const [editing, setEditing] = useState(false);
	// Draft state so Cancel can discard pending edits without touching the
	// real meta value. Seed from `link` whenever the modal opens.
	const [draft, setDraft] = useState(link);
	const hasUrl = !!link.url;

	const openModal = () => {
		setDraft(link);
		setEditing(true);
	};

	const save = () => {
		onChange({
			url: draft.url || '',
			text: draft.text || '',
			opensInNewTab: !!draft.opensInNewTab,
		});
		setEditing(false);
	};

	return (
		<BaseControl label={control.label} help={control.helpText} __nextHasNoMarginBottom>
			<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
				<div style={{ flex: 1, fontSize: 13, color: hasUrl ? '#1e1e1e' : '#757575', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
					{hasUrl ? (link.text || link.url) : __('No link set', 'gcblite')}
				</div>
				<Button variant="secondary" onClick={openModal}>
					{hasUrl ? __('Edit', 'gcblite') : __('Set link', 'gcblite')}
				</Button>
				{hasUrl && (
					<Button variant="tertiary" isDestructive onClick={() => onChange({ url: '', text: '', opensInNewTab: false })}>
						{__('Clear', 'gcblite')}
					</Button>
				)}
			</div>

			{editing && (
				<Modal
					title={control.label || __('Edit link', 'gcblite')}
					onRequestClose={() => setEditing(false)}
					size="medium"
				>
					<div style={{ display: 'grid', gap: 16 }}>
						<TextControl
							label={__('URL', 'gcblite')}
							value={draft.url || ''}
							onChange={(url) => setDraft({ ...draft, url })}
							placeholder="https://example.com"
							type="url"
							__nextHasNoMarginBottom
							__next40pxDefaultSize
						/>
						<TextControl
							label={__('Link text', 'gcblite')}
							value={draft.text || ''}
							onChange={(text) => setDraft({ ...draft, text })}
							placeholder={draft.url || __('Optional display label', 'gcblite')}
							__nextHasNoMarginBottom
							__next40pxDefaultSize
						/>
						<CheckboxControl
							label={__('Open in new tab', 'gcblite')}
							checked={!!draft.opensInNewTab}
							onChange={(opensInNewTab) => setDraft({ ...draft, opensInNewTab })}
							__nextHasNoMarginBottom
						/>
					</div>
					<Spacer marginTop={6} />
					<HStack justify="flex-end" spacing={3}>
						<Button variant="tertiary" onClick={() => setEditing(false)}>
							{__('Cancel', 'gcblite')}
						</Button>
						<Button variant="primary" onClick={save}>
							{__('Save link', 'gcblite')}
						</Button>
					</HStack>
				</Modal>
			)}
		</BaseControl>
	);
}

function SidebarUrl({ control, link, onChange }) {
	const [editing, setEditing] = useState(false);
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
