/**
 * WYSIWYG control — two renderings of the same stored HTML string:
 *   - sidebar  → @wordpress/block-editor's RichText (narrow contenteditable,
 *                no toolbar — fits a 280px Inspector sidebar)
 *   - metabox  → wp.editor.initialize(...) → full TinyMCE with toolbar
 *                (bold/italic/lists/links/headings/quote/etc.) — matches
 *                ACF's WYSIWYG and what most editors expect when they see
 *                "WYSIWYG field" on a CPT
 *
 * Storage is identical: an HTML string. Frontend dangerouslySetInnerHTMLs it
 * (or runs through a sanitiser before rendering).
 *
 * TinyMCE caveat: wp.editor is a global, not React-managed. We render a
 * textarea with a unique id, call wp.editor.initialize on mount, and
 * wp.editor.remove on unmount. Content changes are picked up via tinymce
 * editor events.
 */

import { __ } from '@wordpress/i18n';
import { useContext, useEffect, useId, useRef } from '@wordpress/element';
import { RichText } from '@wordpress/block-editor';
import { ControlContext } from '../control-context';

export default function WysiwygField({ control, value, onChange }) {
	const ctx = useContext(ControlContext);
	if (ctx.variant === 'metabox') {
		return <MetaboxWysiwyg control={control} value={value} onChange={onChange} />;
	}
	return <SidebarWysiwyg control={control} value={value} onChange={onChange} />;
}

function SidebarWysiwyg({ control, value, onChange }) {
	return (
		<div className="components-base-control gcb-wysiwyg-control">
			<div className="components-base-control__field">
				<label className="components-base-control__label">{control.label}</label>
			</div>
			{control.helpText && (
				<p className="components-base-control__help">{control.helpText}</p>
			)}
			<RichText
				value={value || ''}
				onChange={onChange}
				placeholder={control.placeholder || __('Start writing…', 'gcblite')}
				multiline="p"
			/>
		</div>
	);
}

function MetaboxWysiwyg({ control, value, onChange }) {
	// useId gives us a stable unique id per instance — TinyMCE uses it to
	// key its internal editor map, and we use it to write the textarea.
	// Hyphens aren't allowed in tinymce editor ids in older WPs; sanitise.
	const editorId = 'gcb-wysiwyg-' + useId().replace(/[^a-zA-Z0-9]/g, '');
	const lastSyncedValue = useRef(value || '');
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	useEffect(() => {
		// wp.editor is loaded via wp_enqueue_editor on the server. If it's
		// missing fall through to a plain textarea (the textarea below
		// already exists; just skip init).
		if (typeof window.wp === 'undefined' || !window.wp.editor) {
			return;
		}

		// Wait a tick — the textarea has to be in the DOM before initialize.
		window.wp.editor.initialize(editorId, {
			tinymce: {
				wpautop: true,
				plugins: 'lists link paste wordpress wpautoresize wplink wptextpattern',
				toolbar1: 'formatselect bold italic bullist numlist blockquote alignleft aligncenter alignright link unlink wp_more',
				toolbar2: 'strikethrough hr forecolor pastetext removeformat charmap outdent indent undo redo',
				menubar: false,
				branding: false,
				setup: (editor) => {
					// Wire change events back into React state. Use both
					// 'input' and 'change' so we catch typing and toolbar
					// actions (toolbar fires 'change', typing fires 'input').
					const sync = () => {
						const next = editor.getContent();
						if (next !== lastSyncedValue.current) {
							lastSyncedValue.current = next;
							onChangeRef.current(next);
						}
					};
					editor.on('input change keyup undo redo SetContent', sync);
				},
			},
			quicktags: true,
			mediaButtons: true,
		});

		return () => {
			if (window.wp && window.wp.editor) {
				window.wp.editor.remove(editorId);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [editorId]);

	// External value changes (e.g. resetting the field) — push into TinyMCE
	// if it differs from what we last synced out.
	useEffect(() => {
		if (
			window.tinymce &&
			window.tinymce.get(editorId) &&
			(value || '') !== lastSyncedValue.current
		) {
			lastSyncedValue.current = value || '';
			window.tinymce.get(editorId).setContent(value || '');
		}
	}, [value, editorId]);

	return (
		<div className="components-base-control gcb-wysiwyg-control gcb-wysiwyg-control--metabox">
			<div className="components-base-control__field">
				<label className="components-base-control__label" htmlFor={editorId}>
					{control.label}
				</label>
			</div>
			{control.helpText && (
				<p className="components-base-control__help">{control.helpText}</p>
			)}
			<textarea
				id={editorId}
				defaultValue={value || ''}
				rows={10}
				style={{ width: '100%' }}
			/>
		</div>
	);
}
