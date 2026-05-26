/**
 * RichtextField — modern alternative to the `wysiwyg` (TinyMCE) control.
 *
 * Built on Tiptap (ProseMirror under the hood). Lighter, no jQuery, no
 * global state — fits the rest of the Inspector model where every
 * control is a self-contained React component.
 *
 * Stored shape: HTML string (e.g. `<p>Hello <strong>world</strong></p>`).
 * Compatible with WP's standard wp_kses() flow and any frontend that
 * renders HTML via dangerouslySetInnerHTML.
 *
 * Why TWO rich-text controls? The existing `wysiwyg` control wraps
 * wp_editor() / TinyMCE — it's what authors expect on every WordPress
 * install and we keep it for backwards compat. `richtext` is the new
 * default for themes that don't need TinyMCE-era plugin compatibility
 * and want a smaller, more modern editor.
 *
 * Toolbar uses @wordpress/components so it visually matches the rest
 * of our Inspector. Image button opens wp.media() and inserts an <img>
 * referencing the existing media library — same lower-level API as
 * MediaPicker, no @wordpress/block-editor dependency required (works
 * on any admin screen).
 */

import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';
import {
	Button,
	Popover,
	TextControl,
} from '@wordpress/components';
import {
	formatBold,
	formatItalic,
	formatStrikethrough,
	formatListBullets,
	formatListNumbered,
	code as codeIcon,
	quote as quoteIcon,
	link as linkIcon,
	image as imageIcon,
	undo as undoIcon,
	redo as redoIcon,
} from '@wordpress/icons';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';

/**
 * Open wp.media() and resolve with the picked image. Same wp.media
 * API our MediaPicker shim uses — no @wordpress/block-editor required.
 */
function pickImageFromMedia() {
	return new Promise((resolve) => {
		if (typeof window === 'undefined' || !window.wp?.media) {
			// eslint-disable-next-line no-console
			console.warn('gcb-lite: wp.media not loaded — call wp_enqueue_media() on this screen.');
			resolve(null);
			return;
		}
		const frame = window.wp.media({
			title: __('Insert image', 'gcblite'),
			button: { text: __('Insert image', 'gcblite') },
			library: { type: ['image'] },
			multiple: false,
		});
		frame.on('select', () => {
			const a = frame.state().get('selection').first()?.toJSON();
			resolve(a || null);
		});
		frame.on('close', () => resolve(null));
		frame.open();
	});
}

function ToolbarSeparator() {
	return (
		<span aria-hidden style={{
			display: 'inline-block',
			width: 1,
			height: 24,
			background: '#ddd',
			margin: '0 4px',
			alignSelf: 'center',
		}} />
	);
}

/**
 * Toolbar button. Uses @wordpress/icons so the toolbar visually
 * matches the rest of WP admin (block-editor toolbar, post-meta
 * controls, etc.). The icon prop on @wordpress/components Button
 * renders the SVG at WP's standard 24×24.
 */
function TbButton({ icon, label, isPressed, disabled, onClick }) {
	return (
		<Button
			icon={icon}
			label={label}
			showTooltip
			onClick={onClick}
			disabled={disabled}
			aria-pressed={isPressed}
			className="gcb-richtext-toolbar__btn"
		/>
	);
}

function LinkPopover({ editor, anchor, onClose }) {
	const initial = editor.getAttributes('link').href || '';
	const [url, setUrl] = useState(initial);

	const apply = () => {
		if (!url) {
			editor.chain().focus().unsetLink().run();
		} else {
			editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
		}
		onClose();
	};

	return (
		<Popover anchor={anchor} onClose={onClose} placement="bottom-start">
			<div style={{ padding: 12, minWidth: 280 }}>
				<TextControl
					label={__('Link URL', 'gcblite')}
					value={url}
					onChange={setUrl}
					placeholder="https://example.com"
					__nextHasNoMarginBottom
					__next40pxDefaultSize
				/>
				<div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
					<Button variant="primary" onClick={apply}>{__('Apply', 'gcblite')}</Button>
					{initial && (
						<Button
							variant="tertiary"
							onClick={() => {
								editor.chain().focus().unsetLink().run();
								onClose();
							}}
						>
							{__('Remove', 'gcblite')}
						</Button>
					)}
				</div>
			</div>
		</Popover>
	);
}

function Toolbar({ editor, control }) {
	const [linkPopoverAnchor, setLinkPopoverAnchor] = useState(null);

	if (!editor) return null;

	const headingLevels = control.headingLevels || [2, 3, 4];
	// Build heading select options. 'p' is paragraph (no heading).
	const headingValue = editor.isActive('heading', { level: headingLevels[0] })
		? `h${headingLevels[0]}`
		: editor.isActive('heading', { level: headingLevels[1] })
		? `h${headingLevels[1]}`
		: editor.isActive('heading', { level: headingLevels[2] })
		? `h${headingLevels[2]}`
		: 'p';

	const setHeading = (val) => {
		if (val === 'p') {
			editor.chain().focus().setParagraph().run();
		} else {
			const level = parseInt(val.slice(1), 10);
			editor.chain().focus().toggleHeading({ level }).run();
		}
	};

	const insertImage = async () => {
		const img = await pickImageFromMedia();
		if (!img?.url) return;
		editor.chain().focus().setImage({ src: img.url, alt: img.alt || '' }).run();
	};

	return (
		<div className="gcb-richtext-toolbar" style={{
			display: 'flex',
			flexWrap: 'wrap',
			alignItems: 'center',
			gap: 2,
			padding: 6,
			border: '1px solid #ddd',
			borderBottom: 'none',
			background: '#fff',
			borderRadius: '8px 8px 0 0',
		}}>
			{/* Block-type select */}
			<select
				value={headingValue}
				onChange={(e) => setHeading(e.target.value)}
				className="gcb-richtext-block-select"
				aria-label={__('Text style', 'gcblite')}
				style={{ height: 28, padding: '0 4px', border: '1px solid transparent', background: 'transparent' }}
			>
				<option value="p">{__('Paragraph', 'gcblite')}</option>
				{headingLevels.map((l) => (
					<option key={l} value={`h${l}`}>{`Heading ${l}`}</option>
				))}
			</select>

			<ToolbarSeparator />

			<TbButton
				icon={formatBold}
				label={__('Bold', 'gcblite')}
				isPressed={editor.isActive('bold')}
				onClick={() => editor.chain().focus().toggleBold().run()}
			/>
			<TbButton
				icon={formatItalic}
				label={__('Italic', 'gcblite')}
				isPressed={editor.isActive('italic')}
				onClick={() => editor.chain().focus().toggleItalic().run()}
			/>
			<TbButton
				icon={formatStrikethrough}
				label={__('Strikethrough', 'gcblite')}
				isPressed={editor.isActive('strike')}
				onClick={() => editor.chain().focus().toggleStrike().run()}
			/>
			<TbButton
				icon={codeIcon}
				label={__('Inline code', 'gcblite')}
				isPressed={editor.isActive('code')}
				onClick={() => editor.chain().focus().toggleCode().run()}
			/>

			<ToolbarSeparator />

			<TbButton
				icon={formatListBullets}
				label={__('Bulleted list', 'gcblite')}
				isPressed={editor.isActive('bulletList')}
				onClick={() => editor.chain().focus().toggleBulletList().run()}
			/>
			<TbButton
				icon={formatListNumbered}
				label={__('Numbered list', 'gcblite')}
				isPressed={editor.isActive('orderedList')}
				onClick={() => editor.chain().focus().toggleOrderedList().run()}
			/>
			<TbButton
				icon={quoteIcon}
				label={__('Blockquote', 'gcblite')}
				isPressed={editor.isActive('blockquote')}
				onClick={() => editor.chain().focus().toggleBlockquote().run()}
			/>

			<ToolbarSeparator />

			<TbButton
				icon={linkIcon}
				label={__('Link', 'gcblite')}
				isPressed={editor.isActive('link')}
				onClick={(e) => setLinkPopoverAnchor(e.currentTarget)}
			/>
			{control.allowImages !== false && (
				<TbButton
					icon={imageIcon}
					label={__('Insert image', 'gcblite')}
					onClick={insertImage}
				/>
			)}

			<ToolbarSeparator />

			<TbButton
				icon={undoIcon}
				label={__('Undo', 'gcblite')}
				onClick={() => editor.chain().focus().undo().run()}
				disabled={!editor.can().undo()}
			/>
			<TbButton
				icon={redoIcon}
				label={__('Redo', 'gcblite')}
				onClick={() => editor.chain().focus().redo().run()}
				disabled={!editor.can().redo()}
			/>

			{linkPopoverAnchor && (
				<LinkPopover
					editor={editor}
					anchor={linkPopoverAnchor}
					onClose={() => setLinkPopoverAnchor(null)}
				/>
			)}
		</div>
	);
}

export default function RichtextField({ control, value, onChange }) {
	const headingLevels = control.headingLevels || [2, 3, 4];

	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				// Disable headings here; we'll re-add only the levels the
				// theme has allowed so the toolbar select stays in sync.
				heading: { levels: headingLevels },
			}),
			Link.configure({
				openOnClick: false,
				HTMLAttributes: { rel: 'noopener noreferrer' },
			}),
			Image.configure({
				HTMLAttributes: { class: 'gcb-richtext-image' },
			}),
		],
		content: value || '',
		onUpdate: ({ editor: ed }) => {
			const html = ed.getHTML();
			// Tiptap returns "<p></p>" for an empty document. Normalise
			// to '' so validation's required-check still triggers on
			// truly-empty input.
			onChange(html === '<p></p>' ? '' : html);
		},
	});

	// Sync external value changes (e.g. value reset, conditional logic
	// swap) without re-triggering onUpdate.
	useEffect(() => {
		if (!editor) return;
		const current = editor.getHTML();
		const incoming = value || '';
		if (current === incoming) return;
		if (current === '<p></p>' && incoming === '') return;
		editor.commands.setContent(incoming, false);
	}, [value, editor]);

	return (
		<div className="components-base-control gcb-richtext-control">
			{control.label && (
				<label className="components-base-control__label">
					{control.label}
				</label>
			)}
			{control.helpText && (
				<p className="components-base-control__help">{control.helpText}</p>
			)}

			<Toolbar editor={editor} control={control} />
			<EditorContent
				editor={editor}
				className="gcb-richtext-editor"
			/>
		</div>
	);
}
