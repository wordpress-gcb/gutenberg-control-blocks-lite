/**
 * Block-editor sidebar panel for CPT typed fields.
 *
 * Mirror of post-fields.js but rendered as a PluginDocumentSettingPanel
 * inside the block editor's Inspector instead of a classic meta-box.
 * Used by CPTs registered with 'has_body' => true so the typed fields
 * live next to the editor canvas rather than below it.
 *
 * Why a separate bundle and not a code branch inside post-fields.js?
 *  - This entry depends on @wordpress/plugins + @wordpress/edit-post,
 *    which exist only on screens that bootstrap the block editor. The
 *    meta-box bundle has to load on classic CPT screens where those
 *    packages aren't available.
 *  - Smaller bundle on meta-box screens (no edit-post pulled in).
 *
 * Data flow:
 *  - Server localises `window.gcbLiteSidebar = { postType, config, panelTitle }`
 *    via wp_add_inline_script (see PostFields/Registrar::enqueue_sidebar_bundle).
 *  - The panel renders only for the matching post type.
 *  - Values are read via useSelect on core/editor → getEditedPostAttribute('meta').
 *  - Edits dispatch core/editor.editPost({ meta: {...} }) so the editor's
 *    own save handler picks them up.
 *
 * Validation: the in-editor lint surface is the existing per-field
 * <ValidationWrapper> overlay (red ring + inline error). Server-side
 * validation still runs on save and forces draft if invalid — same as
 * the meta-box path.
 */

import { registerPlugin } from '@wordpress/plugins';
import { PluginDocumentSettingPanel } from '@wordpress/edit-post';
import { useSelect, useDispatch } from '@wordpress/data';
import { useMemo } from '@wordpress/element';
import {
	renderInspector,
	shouldRender,
	ControlContext,
	ValidationContext,
} from '@wordpress-gcb/fields';
import { validateAll } from './validation';
import './editor.scss';

function SidebarFieldsPanel() {
	const cfg = typeof window !== 'undefined' ? window.gcbLiteSidebar : null;
	if (!cfg || !cfg.postType || !cfg.config) {
		return null;
	}

	const currentPostType = useSelect(
		(select) => select('core/editor')?.getCurrentPostType?.(),
		[]
	);
	if (currentPostType !== cfg.postType) {
		return null;
	}

	const meta = useSelect(
		(select) => select('core/editor')?.getEditedPostAttribute?.('meta') || {},
		[]
	);
	const { editPost } = useDispatch('core/editor');

	const controls = cfg.config.controls || [];

	// Fill in defaults for fields that haven't been touched yet, so the
	// in-Inspector value reflects what the server resolves on render.
	const attributes = useMemo(() => {
		const out = { ...meta };
		for (const c of controls) {
			if (!c.attributeKey) continue;
			if (out[c.attributeKey] === undefined && 'default' in c) {
				out[c.attributeKey] = c.default;
			}
		}
		return out;
	}, [meta, controls]);

	const setAttributes = (patch) => {
		editPost({ meta: { ...meta, ...patch } });
	};

	const isVisible = (control) => shouldRender(control, attributes);
	const validation = useMemo(() => validateAll(controls, attributes, isVisible), [controls, attributes]);
	const errors = validation.ok ? {} : validation.errors;

	return (
		<PluginDocumentSettingPanel
			name="gcblite-fields"
			title={cfg.panelTitle || 'Fields'}
			className="gcblite-sidebar-fields"
		>
			<ControlContext.Provider value={{ variant: 'sidebar' }}>
				<ValidationContext.Provider value={{ errors, showErrors: false }}>
					{renderInspector(controls, attributes, setAttributes, { flatten: true })}
				</ValidationContext.Provider>
			</ControlContext.Provider>
		</PluginDocumentSettingPanel>
	);
}

registerPlugin('gcblite-sidebar-fields', {
	render: SidebarFieldsPanel,
	icon: null,
});
