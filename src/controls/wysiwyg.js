/**
 * WYSIWYG control — backwards-compat alias for the Tiptap-based
 * `richtext` control.
 *
 * Historically this control had two render paths: @wordpress/block-editor's
 * RichText in the Inspector sidebar, and a full wp_editor() / TinyMCE
 * boot on meta-box surfaces. Carrying two rich-text engines (RichText
 * for blocks, TinyMCE for everywhere else, plus Tiptap for the new
 * `richtext` type) was three engines too many — and the meta-box
 * TinyMCE path dragged jQuery + the wp.editor global namespace along
 * with it.
 *
 * Now: one Tiptap-backed component serves every surface. `wysiwyg`
 * stays in the registry as a stable alias so themes already using
 * `"type": "wysiwyg"` in block.fields.json or post-fields configs
 * don't have to change anything. Storage shape (HTML string) is
 * unchanged, so existing meta values continue to round-trip cleanly.
 *
 * For new fields, `richtext` is the canonical type name. `wysiwyg`
 * is kept for back-compat.
 */

export { default } from './richtext';
