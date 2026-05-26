/**
 * HeadingLevel — compound input: a text field for the heading content
 * and an inline dropdown for the semantic level. Visually mirrors WP's
 * UnitControl (the "10 px" combo): input on the left, suffix selector
 * on the right, single 40px-tall row.
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
 * Config:
 *   levels        ['h1','h2','h3','h4','h5','h6','p','div','span'] (default)
 *                 — set to your own subset to restrict choice.
 *   default       { text, level }  — initial value when the attribute is empty
 *   placeholder   string  — placeholder for the text input
 *
 * Accessibility: `div` and `span` are non-semantic; the helper text turns
 * red when one is selected so authors see the trade-off before shipping.
 *
 * Implementation note: uses WP's @experimental `InputControl` primitive
 * directly — that's the same component UnitControl is built on top of.
 * It exposes a `suffix` slot for exactly this "input + dropdown" pattern
 * and handles the input height / focus ring / 40px-row layout properly
 * so we don't have to hand-roll the class names.
 */

import { __ } from '@wordpress/i18n';
import {
	__experimentalInputControl as InputControl,
	Notice,
} from '@wordpress/components';

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

	const levelSelect = (
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
	);

	return (
		<div className="components-base-control gcb-heading-level-control">
			<div className="components-base-control__field">
				<InputControl
					label={control.label}
					value={text}
					placeholder={control.placeholder || __('Heading text', 'gcblite')}
					onChange={(next) => update({ text: next ?? '' })}
					suffix={levelSelect}
					__next40pxDefaultSize
				/>

				{isNonSemantic && (
					<Notice
						status="warning"
						isDismissible={false}
						className="gcb-heading-level-control__warning"
					>
						{__(
							'Non-heading elements are skipped by screen-reader heading navigation. Prefer H1–H6 for content titles.',
							'gcblite',
						)}
					</Notice>
				)}
			</div>
			{control.helpText && (
				<p className="components-base-control__help">{control.helpText}</p>
			)}
		</div>
	);
}
