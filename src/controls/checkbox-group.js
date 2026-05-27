/**
 * CheckboxGroup — multi-select stored as an array of selected values.
 */
export default function CheckboxGroupField({ control, value, onChange }) {
	const current = Array.isArray(value) ? value : [];

	return (
		<div className="components-base-control gcb-checkbox-group-control">
			<div className="components-base-control__field">
				<label className="components-base-control__label">{control.label}</label>
				<div style={{
					display: 'flex',
					alignItems: 'stretch',
					flexDirection: 'column',
					gap: 6,
					justifyContent: 'center',
				}}>
					{(control.options || []).map((option, index) => {
						const isChecked = current.includes(option.value);
						const id = `gcb-checkbox-${control.id || control.attributeKey}-${option.value}-${index}`;

						return (
							<div key={`${control.id || control.attributeKey}-${option.value}`} className="gcb-checkbox-item">
								<label htmlFor={id} style={{
									display: 'flex',
									alignItems: 'center',
									gap: 8,
									cursor: 'pointer',
									fontSize: 13,
								}}>
									<input
										type="checkbox"
										id={id}
										checked={isChecked}
										onChange={(e) => {
											const next = e.target.checked
												? [...current, option.value]
												: current.filter((v) => v !== option.value);
											onChange(next);
										}}
										style={{ width: 16, height: 16, cursor: 'pointer' }}
									/>
									<span>{option.label}</span>
								</label>
							</div>
						);
					})}
				</div>
			</div>
			{control.helpText && (
				<p className="components-base-control__help">{control.helpText}</p>
			)}
		</div>
	);
}
