/**
 * THE EMBED CONTROL (2026-10-10, Mark: "can gcb create a trust pilot component on its own?"). A third-party
 * widget's snippet, pasted as the provider gives it — a monospace textarea. What it may do on the page is the
 * render's call (gcblite_embed, includes/Render/embed.php): its markup through kses, its script only from a
 * known widget host.
 */
import { TextareaControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { controlComponents } from '@wordpress-gcb/fields';

export const EMBED_HELP = __(
	'Paste the widget code from the provider (Trustpilot, Calendly, Typeform…). Scripts load only from known widget providers.',
	'gcblite'
);

export default function EmbedControl( { control, value, onChange } ) {
	return (
		<TextareaControl
			label={ control.label }
			help={ control.helpText || control.help || EMBED_HELP }
			placeholder={ control.placeholder }
			value={ typeof value === 'string' ? value : '' }
			onChange={ onChange }
			rows={ control.rows ?? 8 }
			className="gcblite-embed-field"
			spellCheck={ false }
			style={ { fontFamily: 'Menlo, Consolas, monospace', fontSize: '12px' } }
			__nextHasNoMarginBottom
		/>
	);
}

/** Put the control where the inspector looks. Idempotent; never overrides one the fields package may one day ship. */
export function registerEmbedControl() {
	if ( controlComponents && ! controlComponents.embed ) {
		controlComponents.embed = EmbedControl;
	}
}
