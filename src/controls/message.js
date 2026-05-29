/**
 * Message — informational note in the Inspector. No input.
 *
 * Variants: `neutral` (default) | `info` | `warning` | `danger` | `success`
 * Pair with `conditionalLogic` to fire context-sensitive messages (e.g.
 * a `danger` message that only shows when another field has an invalid
 * value).
 *
 * Body source: `control.message` (preferred) or `control.helpText` fallback.
 */

const VARIANTS = {
	neutral: { bg: '#f0f0f1', border: '#dcdcde', fg: '#1e1e1e', glyph: null },
	info:    { bg: '#f0f6fc', border: '#c5d9eb', fg: '#0b3b6f', glyph: 'ℹ' },
	warning: { bg: '#fcf9e8', border: '#f5e6a8', fg: '#674e00', glyph: '⚠' },
	danger:  { bg: '#fcf0f1', border: '#facfd2', fg: '#7c0c0c', glyph: '✕' },
	success: { bg: '#edfaef', border: '#b8e6bf', fg: '#0a4d12', glyph: '✓' },
};

export default function MessageField({ control }) {
	const variant = VARIANTS[control.variant] || VARIANTS.neutral;
	const body    = control.message || control.helpText || '';

	return (
		<div className={`components-base-control gcb-message-control gcb-message-control--${control.variant || 'neutral'}`}>
			<div className="components-base-control__field">
				{control.label && (
					<label className="components-base-control__label">{control.label}</label>
				)}
				<div
					className="gcb-message-control__content"
					role={control.variant === 'danger' || control.variant === 'warning' ? 'alert' : undefined}
					style={{
						display: 'flex',
						alignItems: 'flex-start',
						gap: 8,
						padding: '10px 12px',
						backgroundColor: variant.bg,
						border: `1px solid ${variant.border}`,
						color: variant.fg,
						borderRadius: 4,
						fontSize: 13,
						lineHeight: 1.5,
					}}
				>
					{variant.glyph && (
						<span aria-hidden style={{ flexShrink: 0, fontWeight: 600, lineHeight: 1.5 }}>
							{variant.glyph}
						</span>
					)}
					<span>{body}</span>
				</div>
			</div>
		</div>
	);
}
