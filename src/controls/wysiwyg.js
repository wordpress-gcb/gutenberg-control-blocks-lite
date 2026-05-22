/**
 * WYSIWYG — RichText editor wrapped in our base-control shell.
 */
import { __ } from '@wordpress/i18n';
import { RichText } from '@wordpress/block-editor';

export default function WysiwygField({ control, value, onChange }) {
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
