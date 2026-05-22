import { TextareaControl } from '@wordpress/components';

/**
 * Minimal code field — a monospace textarea. The original plugin used CodeMirror
 * here; we can swap in once basic shape is proven. For now, monospace + tab-friendly
 * is good enough for snippets.
 */
export default function CodeField({ control, value, onChange }) {
	return (
		<TextareaControl
			label={control.label}
			help={control.helpText}
			placeholder={control.placeholder}
			value={value ?? ''}
			onChange={onChange}
			rows={control.rows ?? 8}
			className="gcblite-code-field"
			__nextHasNoMarginBottom
		/>
	);
}
