#!/usr/bin/env node
/**
 * Generate schemas/gcb.schema.json from the per-control markdown
 * frontmatter in schemas/controls/{type}.md.
 *
 * Why a generator: the schema needs per-control conditional branches
 * — when `type: image`, valid additional keys are `enableFocalPoint`,
 * `enableSizeOptions`, etc.; when `type: color`, they're
 * `showGradients`, `gradientAttributeKey`. Hand-maintaining 32 of
 * those is the kind of duplication this plugin specifically refuses
 * to do. Source of truth: the control's .md file. Run:
 *
 *   node tools/build-schema.mjs
 *
 * Hand-edited bits — the outer shape, the universal control
 * properties, the type enum — live in the SCHEMA_BASE constant below
 * and survive each regen. Only the per-control branches under
 * `$defs.control.allOf` get rewritten.
 *
 * No dependencies. The minimal YAML subset we parse matches what
 * includes/Docs/ControlDocs.php expects, so authors of .md files
 * have one consistent format to follow.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, '..');
const CONTROLS_DIR = path.join(PLUGIN_ROOT, 'schemas', 'controls');
const OUT_PATH = path.join(PLUGIN_ROOT, 'schemas', 'gcb.schema.json');

// ---------------------------------------------------------------------
// YAML frontmatter parser — supports the subset our .md files use.
// Same shape ControlDocs.php parses, intentionally.
// ---------------------------------------------------------------------

function parseFrontmatter(raw) {
	const m = raw.match(/^---\s*\r?\n([\s\S]+?)\r?\n---\s*\r?\n/);
	if (!m) return {};
	return parseYaml(m[1]);
}

function parseYaml(body) {
	const lines = body.split(/\r?\n/);
	const result = {};
	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		if (line.trim() === '' || line.trimStart().startsWith('#')) { i++; continue; }

		const top = line.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
		if (!top) { i++; continue; }
		const key = top[1];
		const val = top[2];

		// Block scalar (| or >) — collect indented body lines.
		if (val === '|' || val === '>') {
			const collected = [];
			i++;
			while (i < lines.length && (lines[i].trim() === '' || /^\s{2,}/.test(lines[i]))) {
				collected.push(lines[i].replace(/^\s{0,2}/, ''));
				i++;
			}
			const joined = collected.join('\n');
			result[key] = val === '>'
				? joined.replace(/\s+/g, ' ').trim()
				: joined.replace(/\n+$/, '');
			continue;
		}

		// Empty value → list or list-of-objects on next lines.
		if (val === '') {
			i++;
			// Object list?
			if (i < lines.length && /^\s+-\s+\w+\s*:/.test(lines[i])) {
				const [items, next] = parseObjectList(lines, i);
				result[key] = items;
				i = next;
				continue;
			}
			// String list?
			if (i < lines.length && /^\s+-\s+/.test(lines[i])) {
				const [items, next] = parseStringList(lines, i);
				result[key] = items;
				i = next;
				continue;
			}
			result[key] = '';
			continue;
		}

		// Inline empty array.
		if (/^\[\s*\]$/.test(val)) {
			result[key] = [];
			i++;
			continue;
		}

		result[key] = unquote(val);
		i++;
	}
	return result;
}

function parseStringList(lines, start) {
	const items = [];
	let i = start;
	while (i < lines.length) {
		const m = lines[i].match(/^\s+-\s+(.+?)\s*$/);
		if (!m) break;
		items.push(unquote(m[1]));
		i++;
	}
	return [items, i];
}

function parseObjectList(lines, start) {
	const items = [];
	let current = null;
	let baseIndent = null;
	let contIndent = null;
	let i = start;

	while (i < lines.length) {
		const line = lines[i];
		const dash = line.match(/^(\s+)-\s+(\w+)\s*:\s*(.*)$/);
		if (dash) {
			if (baseIndent === null) {
				baseIndent = dash[1].length;
				contIndent = baseIndent + 2;
			}
			if (dash[1].length !== baseIndent) break;
			if (current !== null) items.push(current);
			current = { [dash[2]]: unquote(dash[3]) };
			i++;
			continue;
		}
		const cont = line.match(/^(\s+)(\w+)\s*:\s*(.*)$/);
		if (current && cont && cont[1].length === contIndent) {
			const v = cont[3];
			if (v === '|' || v === '>') {
				const collected = [];
				i++;
				const bodyIndent = contIndent + 2;
				const indentRe = new RegExp(`^\\s{${bodyIndent},}`);
				const stripRe  = new RegExp(`^\\s{0,${bodyIndent}}`);
				while (i < lines.length && (lines[i].trim() === '' || indentRe.test(lines[i]))) {
					collected.push(lines[i].replace(stripRe, ''));
					i++;
				}
				const joined = collected.join('\n');
				current[cont[2]] = v === '>'
					? joined.replace(/\s+/g, ' ').trim()
					: joined.replace(/\n+$/, '');
				continue;
			}
			current[cont[2]] = unquote(v);
			i++;
			continue;
		}
		break;
	}
	if (current !== null) items.push(current);
	return [items, i];
}

function unquote(val) {
	val = val.trim();
	if (val === '')      return '';
	if (val === 'true')  return true;
	if (val === 'false') return false;
	if (val === 'null')  return null;
	const first = val[0];
	const last  = val[val.length - 1];
	if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
		return val.slice(1, -1);
	}
	// Plain numbers
	if (/^-?\d+$/.test(val))         return parseInt(val, 10);
	if (/^-?\d+\.\d+$/.test(val))    return parseFloat(val);
	return val;
}

// ---------------------------------------------------------------------
// Map our docs' loose "type" strings (e.g. "boolean", "string (regex)",
// "string[]") to JSON-Schema-compatible types. Anything we don't
// recognise becomes `undefined` — Monaco will still allow the key but
// stop type-checking the value, which is the right failure mode.
// ---------------------------------------------------------------------

function toJsonSchemaType(label) {
	if (!label) return undefined;
	const norm = String(label).toLowerCase().trim();
	if (norm.startsWith('boolean')) return 'boolean';
	if (norm.startsWith('number'))  return 'number';
	if (norm.startsWith('integer')) return 'integer';
	if (norm.startsWith('string'))  return 'string';
	if (norm.startsWith('array'))   return 'array';
	if (norm.startsWith('object'))  return 'object';
	return undefined;
}

// ---------------------------------------------------------------------
// Read every controls/{type}.md, return a map of {type|alias: configOptions[]}.
// Aliases (textarea → text.md, heading-level → heading.md, etc.) get
// their own entries so the schema's `if: type === alias` branches work.
// ---------------------------------------------------------------------

function loadControls() {
	const files = fs.readdirSync(CONTROLS_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md');
	const byType = {};
	for (const file of files) {
		const raw = fs.readFileSync(path.join(CONTROLS_DIR, file), 'utf8');
		const fm = parseFrontmatter(raw);
		const primary = file.replace(/\.md$/, '');
		const opts = Array.isArray(fm.configOptions) ? fm.configOptions : [];
		byType[primary] = opts;
		const aliases = Array.isArray(fm.aliases) ? fm.aliases : [];
		for (const alias of aliases) {
			byType[alias] = opts;
		}
	}
	return byType;
}

// ---------------------------------------------------------------------
// Schema base — the hand-written outer shape. Per-control branches
// get spliced in as the value of `$defs.control.allOf` further down.
// ---------------------------------------------------------------------

const SCHEMA_BASE = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	$id: 'https://github.com/wordpress-gcb/gutenberg-control-blocks-lite/schemas/gcb.schema.json',
	title: 'GCB Lite block.fields.json',
	description: 'Schema for block.fields.json — the sibling of block.json that declares Inspector controls. The plugin auto-generates WP block attributes from these controls.\n\nPer-control config keys are generated from schemas/controls/{type}.md via tools/build-schema.mjs — do not hand-edit the `allOf` branches under $defs.control.',
	type: 'object',
	properties: {
		controls: {
			type: 'array',
			description: 'Inspector controls. Each non-structural control becomes a block attribute.',
			items: { $ref: '#/$defs/control' },
		},
		allowed_blocks: {
			description: "Block names allowed inside this block's <InnerBlocks/>. `null` = allow all.",
			oneOf: [
				{ type: 'null' },
				{ type: 'array', items: { type: 'string' } },
			],
		},
	},
	$defs: {
		control: {
			type: 'object',
			required: ['id', 'type', 'label'],
			// `additionalProperties` deliberately omitted (= allow). The
			// per-control branches below DO list known config keys so
			// authors get autocomplete; an unknown key just bypasses
			// type-checking rather than erroring.
			properties: {
				id: {
					type: 'string',
					description: 'Unique within the block. Used to wire `parentPanelId` references.',
				},
				type: {
					type: 'string',
					enum: [], // filled in below from the .md set
					description: 'Control type. `group` / `panel` / `tools-panel` are structural (render Inspector panel headers, produce no attribute). `repeater` is a special marker that maps to inner-blocks rather than an Inspector field. All other types map to an Inspector field with a typed attribute.',
				},
				label: { type: 'string' },
				attributeKey: {
					type: 'string',
					pattern: '^[a-zA-Z][a-zA-Z0-9_]*$',
					description: 'Required for non-group controls. Becomes the WP block attribute name.',
				},
				attributeType: {
					type: 'string',
					enum: ['string', 'number', 'boolean', 'object', 'array', 'integer'],
				},
				default: { description: 'Default value matching `attributeType`.' },
				options: {
					type: 'array',
					description: 'Choices for select / radio. Each is `{label, value}`.',
					items: {
						type: 'object',
						required: ['label', 'value'],
						properties: {
							label: { type: 'string' },
							value: {},
						},
					},
				},
				controlsGroup: {
					type: 'string',
					description: 'Inspector tab. Conventionally `settings` or `styles`.',
				},
				parentPanelId: {
					type: 'string',
					description: 'Nests this control under a `group`-type control with this `id`.',
				},
				helpText:    { type: 'string' },
				placeholder: { type: 'string' },
				validation: {
					type: 'object',
					description: 'Author-side validation rules. Enforced client- and server-side.',
					properties: {
						required:  { type: 'boolean' },
						minLength: { type: 'integer', minimum: 0 },
						maxLength: { type: 'integer', minimum: 0 },
						min:       { type: 'number' },
						max:       { type: 'number' },
						pattern:   { type: 'string' },
					},
				},
				conditionalLogic: {
					type: 'object',
					description: 'Show this control only when another control matches a value. Shape: { field, operator, value }.',
				},
			},
			// `allOf` populated below — one if/then per known control type.
			allOf: [],
		},
	},
};

// ---------------------------------------------------------------------
// Structural / virtual types that aren't documented in controls/*.md
// but still need to appear in the `type` enum. Without them Monaco
// would underline a `"type": "group"` as invalid.
// ---------------------------------------------------------------------

const STRUCTURAL_TYPES = ['group', 'panel', 'tools-panel', 'repeater'];

function buildSchema() {
	const controls = loadControls();
	const allTypes = [...new Set([...Object.keys(controls), ...STRUCTURAL_TYPES])].sort();

	const schema = JSON.parse(JSON.stringify(SCHEMA_BASE));
	schema.$defs.control.properties.type.enum = allTypes;

	// One if/then branch per type with config options. Authors of new
	// controls get autocomplete the moment they add a .md file — no
	// schema edits required.
	for (const type of Object.keys(controls).sort()) {
		const opts = controls[type];
		if (!opts || opts.length === 0) continue;

		const branchProps = {};
		for (const opt of opts) {
			if (!opt || !opt.name) continue;
			const jsonType = toJsonSchemaType(opt.type);
			const entry = {
				description: opt.description || '',
			};
			if (jsonType) entry.type = jsonType;
			if (opt.default !== undefined) entry.default = opt.default;
			branchProps[opt.name] = entry;
		}

		schema.$defs.control.allOf.push({
			if: { properties: { type: { const: type } } },
			then: { properties: branchProps },
		});
	}

	return schema;
}

const built = buildSchema();
fs.writeFileSync(OUT_PATH, JSON.stringify(built, null, '\t') + '\n');

const branchCount = built.$defs.control.allOf.length;
const typeCount   = built.$defs.control.properties.type.enum.length;
console.log(`✓ schemas/gcb.schema.json regenerated`);
console.log(`  ${typeCount} type values in enum`);
console.log(`  ${branchCount} per-control config branches`);
