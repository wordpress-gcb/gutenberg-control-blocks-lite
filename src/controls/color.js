/**
 * ColorField — ported verbatim from the original GCB.
 * Tabbed color/gradient picker that uses theme.json palettes via useSetting.
 *
 * Control config can opt out of gradients with `showGradients: false`.
 * For dual-attribute mode (separate color + gradient attrs), set
 * `gradientAttributeKey` on the control config.
 */

import { __ } from '@wordpress/i18n';
import {
	BaseControl,
	Button,
	ColorPalette,
	GradientPicker,
	TabPanel,
	__experimentalHStack as HStack,
} from '@wordpress/components';
import { useSetting } from '@wordpress/block-editor';
import PopoverOrModal from './PopoverOrModal';

/**
 * The popover contents — palette + (optional) gradient tab.
 */
function ColorPanel({
	colorValue,
	gradientValue,
	onColorChange,
	onGradientChange,
	colors,
	gradients,
	enableAlpha,
	disableCustomColors,
	disableCustomGradients,
	showGradients,
}) {
	const palette = (
		<>
			<ColorPalette
				colors={colors}
				value={colorValue}
				onChange={onColorChange}
				clearable
				disableCustomColors={disableCustomColors}
				enableAlpha={enableAlpha}
			/>
			{colorValue && (
				<Button variant="secondary" onClick={() => onColorChange('')} style={{ marginTop: 10 }}>
					{__('Reset Color', 'gcblite')}
				</Button>
			)}
		</>
	);

	if (!showGradients) {
		return <div style={{ minWidth: 260, padding: 12 }}>{palette}</div>;
	}

	return (
		<div style={{ minWidth: 260, padding: 12 }}>
			<TabPanel
				className="gcb-color-field-tabs"
				activeClass="is-active"
				tabs={[
					{ name: 'color', title: __('Color', 'gcblite'), className: 'tab-color' },
					{ name: 'gradient', title: __('Gradient', 'gcblite'), className: 'tab-gradient' },
				]}
			>
				{(tab) => (
					<>
						{tab.name === 'color' && palette}
						{tab.name === 'gradient' && (
							<>
								<GradientPicker
									value={gradientValue || undefined}
									onChange={(next) => onGradientChange(next || '')}
									gradients={gradients || []}
									clearable
									disableCustomGradients={disableCustomGradients}
									__experimentalIsRenderedInSidebar
								/>
								{gradientValue && (
									<Button
										variant="secondary"
										onClick={() => onGradientChange('')}
										style={{ marginTop: 10 }}
									>
										{__('Reset Gradient', 'gcblite')}
									</Button>
								)}
							</>
						)}
					</>
				)}
			</TabPanel>
		</div>
	);
}

/**
 * The trigger swatch — large white tile with a colour swatch on the left,
 * the resolved value (or label) on the right. Same "popout" pattern as the
 * image / post-object controls.
 */
function ColorTrigger({ label, colorValue, gradientValue, onToggle, isOpen }) {
	const hasValue = !!(colorValue || gradientValue);
	const swatchBackground = gradientValue || colorValue || 'transparent';
	const isCheckered = !hasValue;

	return (
		<Button
			onClick={onToggle}
			aria-expanded={isOpen}
			aria-label={label}
			className="gcb-modal-toggle-button gcb-color-trigger"
		>
			<HStack spacing={3}>
				<span
					aria-hidden
					className={isCheckered ? 'gcb-color-trigger__swatch is-empty' : 'gcb-color-trigger__swatch'}
					style={{
						width: 24,
						height: 24,
						borderRadius: '100%',
						background: swatchBackground,
						flexShrink: 0,
						border: '1px solid #ddd',
						display: 'inline-block',
					}}
				/>
				<span style={{ flex: 1, textAlign: 'left', fontSize: 13, color: '#1e1e1e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
					{hasValue ? (gradientValue ? __('Gradient', 'gcblite') : colorValue) : __('Select a color', 'gcblite')}
				</span>
			</HStack>
		</Button>
	);
}

function ColorFieldImpl({
	label = __('Color', 'gcblite'),
	colorValue,
	gradientValue,
	onColorChange,
	onGradientChange,
	colors,
	gradients,
	enableAlpha = true,
	disableCustomColors = false,
	disableCustomGradients = false,
	showGradients = true,
	className = '',
	help,
}) {
	const themeColors = useSetting('color.palette');
	const themeGradients = useSetting('color.gradients');

	// Always end up with arrays — `useSetting('color.gradients')` returns
	// undefined on themes that don't declare any gradients, and feeding that
	// to <GradientPicker> crashes on `.orientation`.
	const finalColors = (colors && colors.length ? colors : (themeColors || []));
	const finalGradients = (gradients && gradients.length ? gradients : (themeGradients || []));

	return (
		<BaseControl
			label={label}
			help={help}
			className={`gcb-color-control components-base-control ${className}`.trim()}
			__nextHasNoMarginBottom
		>
			<PopoverOrModal
				modalTitle={label}
				dropdownProps={{ popoverProps: { placement: 'left-start' } }}
				renderToggle={({ isOpen, onToggle }) => (
					<ColorTrigger
						label={label}
						colorValue={colorValue}
						gradientValue={gradientValue}
						onToggle={onToggle}
						isOpen={isOpen}
					/>
				)}
				renderContent={() => (
					<ColorPanel
						colorValue={colorValue}
						gradientValue={gradientValue}
						onColorChange={onColorChange}
						onGradientChange={onGradientChange}
						colors={finalColors}
						gradients={finalGradients}
						enableAlpha={enableAlpha}
						disableCustomColors={disableCustomColors}
						disableCustomGradients={disableCustomGradients}
						showGradients={showGradients}
					/>
				)}
			/>
		</BaseControl>
	);
}

/**
 * Adapter for the registry contract.
 *
 * The control stores a single string value — either a colour (e.g. `#ff0000`,
 * `var(--wp--preset--color--primary)`) or a gradient (e.g. `linear-gradient(...)`).
 * When the user picks one, the other is cleared. This matches the WP attribute
 * type `string` that the loader generates for `color` controls.
 *
 * For separate color + gradient attributes on the same block, declare two
 * controls (one with `showGradients: false`, one purely gradient — coming in v0.2).
 */
export default function ColorField({ control, value, onChange }) {
	const stringValue = typeof value === 'string' ? value : '';
	const isGradient = stringValue.includes('gradient(');
	const colorValue = isGradient ? '' : stringValue;
	const gradientValue = isGradient ? stringValue : '';

	const handleColor = (next) => onChange(next || '');
	const handleGradient = (next) => onChange(next || '');

	return (
		<ColorFieldImpl
			label={control.label}
			help={control.helpText}
			colorValue={colorValue}
			gradientValue={gradientValue}
			onColorChange={handleColor}
			onGradientChange={handleGradient}
			showGradients={control.showGradients !== false}
			enableAlpha={control.enableAlpha !== false}
			disableCustomColors={control.disableCustomColors === true}
			disableCustomGradients={control.disableCustomGradients === true}
		/>
	);
}
