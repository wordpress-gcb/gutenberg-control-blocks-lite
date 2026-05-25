/**
 * HeadingLevel — compound input: a text field for the heading content
 * and a unit-style dropdown for the semantic level.
 *
 * Stored shape:
 *   { text: 'Section title', level: 'h2' }
 *
 * React frontend usage:
 *   const { text, level } = heading || {};
 *   if (!text) return null;
 *   const Tag = level || 'h2';
 *   return <Tag className="...">{text}</Tag>;
 *
 * UI mirrors WP's UnitControl: input on the left, level selector inset
 * as a suffix on the right (same component family as size + spacing).
 *
 * Config:
 *   levels        ['h1','h2','h3','h4','h5','h6','p','div','span'] (default)
 *                 — set to your own subset to restrict choice.
 *   default       { text, level }  — initial value when the attribute is empty
 *   placeholder   string  — placeholder for the text input
 *
 * Accessibility: `div` and `span` are non-semantic; the helper text turns
 * red when one is selected so authors see the trade-off before shipping.
 */

import { __ } from '@wordpress/i18n';
import { BaseControl, Notice } from '@wordpress/components';

const ALL_LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span'];
const HEADING_LEVELS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

function resolveLevels(control) {
	if (Array.isArray(control.levels) && control.levels.length > 0) {
		return control.levels.filter((l) => ALL_LEVELS.includes(l));
	}
	return ALL_LEVELS;
}

export default function HeadingLevelField({ control, value, onChange }) {
	const levels = resolveLevels(control);
	const heading = value && typeof value === 'object' ? value : {};
	const text  = heading.text  ?? control.default?.text  ?? '';
	const level = heading.level ?? control.default?.level ?? levels[0] ?? 'h2';
	const isNonSemantic = !HEADING_LEVELS.has(level);

	const update = (patch) => onChange({ text, level, ...patch });

	return (
		<BaseControl
			label={control.label}
			help={control.helpText}
			className="gcb-heading-level-control components-base-control"
			__nextHasNoMarginBottom
		>
			{/*
			 * Manually build a UnitControl-shaped composite — using WP's
			 * UnitControl directly would constrain us to numeric values
			 * (its parser strips letters). Same class names so our
			 * meta-box CSS for .components-input-control inputs still
			 * targets us.
			 */}
			<div className="components-input-control">
				<div className="components-input-control__container">
					<input
						type="text"
						className="components-input-control__input"
						value={text}
						placeholder={control.placeholder || __('Heading text', 'gcblite')}
						onChange={(e) => update({ text: e.target.value })}
					/>
					<span className="components-input-control__suffix">
						<select
							className="components-unit-control__select"
							aria-label={__('Heading level', 'gcblite')}
							value={level}
							onChange={(e) => update({ level: e.target.value })}
						>
							{levels.map((lvl) => (
								<option key={lvl} value={lvl}>{lvl.toUpperCase()}</option>
							))}
						</select>
					</span>
				</div>
			</div>

			{isNonSemantic && (
				<Notice status="warning" isDismissible={false} className="gcb-heading-level-control__warning">
					{__(
						'Non-heading elements are skipped by screen-reader heading navigation. Prefer H1–H6 for content titles.',
						'gcblite',
					)}
				</Notice>
			)}
		</BaseControl>
	);
}
