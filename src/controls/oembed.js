/**
 * oEmbed — URL input with a quick preview underneath.
 */
import { __ } from '@wordpress/i18n';
import { TextControl } from '@wordpress/components';

export default function OembedField({ control, value, onChange }) {
	return (
		<div className="components-base-control gcb-oembed-control">
			<div className="components-base-control__field">
				<label className="components-base-control__label">{control.label}</label>
			</div>
			{control.helpText && (
				<p className="components-base-control__help">{control.helpText}</p>
			)}
			<TextControl
				value={value || ''}
				onChange={onChange}
				placeholder={__('Enter URL to embed (YouTube, Twitter, etc.)', 'gcblite')}
				type="url"
				__nextHasNoMarginBottom
			/>
			{value && (
				<div style={{ marginTop: 12 }}>
					<wp-embed>
						<a href={value}>{value}</a>
					</wp-embed>
				</div>
			)}
		</div>
	);
}
