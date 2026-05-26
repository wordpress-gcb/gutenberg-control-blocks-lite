/**
 * Message — informational note in the Inspector. No input.
 *
 * The body comes from `control.message` (preferred) or `control.helpText`
 * as a fallback.
 */
export default function MessageField({ control }) {
	return (
		<div className="components-base-control gcb-message-control">
			<div className="components-base-control__field">
				{control.label && (
					<label className="components-base-control__label">{control.label}</label>
				)}
				<div
					className="gcb-message-control__content"
					style={{
						padding: '12px',
						backgroundColor: '#f0f0f1',
						border: '1px solid #dcdcde',
						borderRadius: 2,
						fontSize: 13,
						lineHeight: 1.5,
					}}
				>
					{control.message || control.helpText || ''}
				</div>
			</div>
		</div>
	);
}
