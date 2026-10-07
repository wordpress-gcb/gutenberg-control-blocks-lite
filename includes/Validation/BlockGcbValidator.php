<?php
/**
 * Validates the `gcb` extension inside a `block.json`.
 *
 * Hand-rolled rather than running a full JSON Schema validator — the schema
 * is ours, the rules are stable, and the structured per-field errors we
 * return are what the editor UI / scaffold CLI consume.
 *
 * @package GCBLite\Validation
 */

namespace GCBLite\Validation;

if (!defined('ABSPATH')) {
    exit;
}

class BlockGcbValidator {

    private const BUILTIN_CONTROL_TYPES = [
        // Text family
        'text', 'textarea', 'number', 'email', 'url', 'code',
        // `heading` is the documented alias of `heading-level` (see
        // schemas/controls/heading-level.md). Aliases are accepted here the
        // same way `textarea`, `checkbox-group` and `toggle-group` are.
        'richtext', 'heading-level', 'heading',
        // Choice family
        'select', 'radio', 'checkbox', 'checkbox-group',
        'toggle', 'toggle-group', 'button-group',
        // Numeric / visual
        'range', 'color', 'date', 'datetime', 'size', 'spacing', 'point', 'pin-map', 'background', 'layout',
        // Display-only
        'message', 'wysiwyg', 'oembed',
        // Media
        'image', 'gallery', 'file', 'icon',
        // Reference
        'post-object', 'taxonomy', 'user', 'page-link', 'relationship',
        // Other
        'google-map',
        // `repeater` is allowed here so block.fields.json can declare an
        // array-shaped attribute for nested items, but it does NOT have a
        // file in src/controls/. The editor doesn't render `repeater` as
        // an Inspector field — instead, the React component emits a
        // <repeater> marker tag in its rendered HTML, and parse-preview.js
        // swaps that for a real InnerBlocks UI. See AGENTS.md "Repeater"
        // section.
        'repeater',
        // `query-loop` declares a paginated server-side WP_Query (post type +
        // taxonomy filters + order + per-page). Like `repeater`, it has no
        // file in src/controls/ — its config lives in block.fields.json and is
        // read at render time by GCBLite\Blocks\Queries\QueryLoop. Stored as an
        // object attribute (set attributeType: object on the control).
        'query-loop',
        // Structural — render as parent panels, produce no attribute.
        'group', 'panel', 'tools-panel',
    ];

    /**
     * Control types that are structural (render an Inspector panel header,
     * never produce an attribute, and can be the target of a parentPanelId).
     */
    public const STRUCTURAL_TYPES = ['group', 'panel', 'tools-panel'];

    private const VALID_ATTRIBUTE_TYPES = ['string', 'number', 'boolean', 'object', 'array', 'integer'];

    /** "Unknown control type `x`" — with the nearest real type when one is close, and how to add your own. */
    private static function unknown_type_message($type, array $known) {
        $best = '';
        $best_d = PHP_INT_MAX;
        foreach ($known as $candidate) {
            $d = levenshtein($type, $candidate);
            if ($d < $best_d) {
                $best_d = $d;
                $best = $candidate;
            }
        }
        $hint = ($best !== '' && $best_d <= max(2, (int) floor(strlen($type) / 3))) ? " Did you mean `{$best}`?" : '';
        return "Unknown control type `{$type}`.{$hint} Use a built-in type or register your own with gcblite_register_control_type().";
    }

    /** The field types GCB ships (docs-backed; ControlVocabularyDerivedTest keeps the two equal). */
    public static function builtin_types() {
        return self::BUILTIN_CONTROL_TYPES;
    }

    /**
     * Every field type this install knows: the built-ins, plus any registered
     * through gcblite_register_control_type() / the gcblite_control_types filter.
     *
     * @return string[]
     */
    public static function known_types() {
        $registered = class_exists(\GCBLite\Fields\ControlTypes::class)
            ? array_keys(\GCBLite\Fields\ControlTypes::all())
            : [];
        return array_values(array_unique(array_merge(self::BUILTIN_CONTROL_TYPES, $registered)));
    }

    /**
     * Validate a gcb config.
     *
     * @param array $config Decoded gcb config (with `block_name` injected).
     * @return array{ok: bool, errors: array<int, array{path: string, message: string}>}
     */
    public static function validate($config) {
        $errors = [];

        if (!is_array($config)) {
            return ['ok' => false, 'errors' => [['path' => '', 'message' => 'block.fields.json must be an object.']]];
        }

        // block.fields.json is identified by its location (block dir); no
        // need for `block_name` or `block_type` keys inside it.

        if (isset($config['controls'])) {
            if (!is_array($config['controls'])) {
                $errors[] = ['path' => 'controls', 'message' => '`controls` must be an array.'];
            } else {
                $seen_ids = [];
                $group_ids = [];
                $known = array_merge(self::known_types(), self::STRUCTURAL_TYPES);
                foreach ($config['controls'] as $control) {
                    if (is_array($control) && in_array($control['type'] ?? null, self::STRUCTURAL_TYPES, true) && !empty($control['id'])) {
                        $group_ids[$control['id']] = true;
                    }
                }
                foreach ($config['controls'] as $i => $control) {
                    self::validate_control($control, "controls[{$i}]", $seen_ids, $group_ids, $errors, $known);
                }
            }
        }

        if (array_key_exists('allowed_blocks', $config)) {
            $allowed = $config['allowed_blocks'];
            if ($allowed !== null && !is_array($allowed)) {
                $errors[] = ['path' => 'allowed_blocks', 'message' => '`allowed_blocks` must be `null` or an array of block names.'];
            } elseif (is_array($allowed)) {
                foreach ($allowed as $j => $b) {
                    if (!is_string($b)) {
                        $errors[] = ['path' => "allowed_blocks[{$j}]", 'message' => 'Each entry must be a string.'];
                    }
                }
            }
        }

        return ['ok' => empty($errors), 'errors' => $errors];
    }

    private static function validate_control($control, $path, array &$seen_ids, array $group_ids, array &$errors, array $known = []) {
        if (!is_array($control)) {
            $errors[] = ['path' => $path, 'message' => 'Control must be an object.'];
            return;
        }

        foreach (['id', 'type', 'label'] as $required) {
            if (empty($control[$required]) || !is_string($control[$required])) {
                $errors[] = ['path' => "{$path}.{$required}", 'message' => "`{$required}` is required and must be a non-empty string."];
            }
        }

        $id   = $control['id']   ?? null;
        $type = $control['type'] ?? null;

        if (is_string($id) && $id !== '') {
            if (isset($seen_ids[$id])) {
                $errors[] = ['path' => "{$path}.id", 'message' => "Duplicate control id `{$id}`."];
            }
            $seen_ids[$id] = true;
        }

        // UNKNOWN TYPES ARE REFUSED (2026-10-07). A type has to be a built-in or one
        // registered through ControlTypes (known_types()). An unknown one used to pass
        // and save its value as a string, with no sidebar control — the silent version
        // of a typo, or of a seed naming a field type that doesn't exist (the hotspots
        // runs in docs/hotspot-field.md). The message names the nearest real type.
        if (is_string($type) && $type !== '' && $known && !in_array($type, $known, true)) {
            $errors[] = ['path' => "{$path}.type", 'message' => self::unknown_type_message($type, $known)];
        }
        // A repeater's row fields are field types too.
        if (isset($control['fields']) && is_array($control['fields']) && $known) {
            foreach ($control['fields'] as $k => $field) {
                $ft = is_array($field) ? ($field['type'] ?? null) : null;
                if (is_string($ft) && $ft !== '' && !in_array($ft, $known, true)) {
                    $errors[] = ['path' => "{$path}.fields[{$k}].type", 'message' => self::unknown_type_message($ft, $known)];
                }
            }
        }

        if (!in_array($type, self::STRUCTURAL_TYPES, true)) {
            $attr_key = $control['attributeKey'] ?? null;
            if (!is_string($attr_key) || $attr_key === '') {
                $errors[] = ['path' => "{$path}.attributeKey", 'message' => '`attributeKey` is required for non-group controls.'];
            } elseif (!preg_match('/^[a-zA-Z][a-zA-Z0-9_]*$/', $attr_key)) {
                $errors[] = ['path' => "{$path}.attributeKey", 'message' => '`attributeKey` must start with a letter and contain only letters, digits, and underscores.'];
            }
        }

        if (isset($control['attributeType']) && !in_array($control['attributeType'], self::VALID_ATTRIBUTE_TYPES, true)) {
            $errors[] = ['path' => "{$path}.attributeType", 'message' => '`attributeType` must be one of: ' . implode(', ', self::VALID_ATTRIBUTE_TYPES) . '.'];
        }

        if (!empty($control['parentPanelId']) && !isset($group_ids[$control['parentPanelId']])) {
            $errors[] = ['path' => "{$path}.parentPanelId", 'message' => "`parentPanelId` references unknown control `{$control['parentPanelId']}`. Must match a structural control's `id` (group / panel / tools-panel)."];
        }

        if (isset($control['options'])) {
            if (!is_array($control['options'])) {
                $errors[] = ['path' => "{$path}.options", 'message' => '`options` must be an array.'];
            } else {
                foreach ($control['options'] as $k => $opt) {
                    if (!is_array($opt) || !array_key_exists('label', $opt) || !array_key_exists('value', $opt)) {
                        $errors[] = ['path' => "{$path}.options[{$k}]", 'message' => 'Each option must be `{label, value}`.'];
                    }
                }
            }
        }
    }
}
