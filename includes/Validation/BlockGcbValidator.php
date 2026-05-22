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
        // Choice family
        'select', 'radio', 'checkbox', 'checkbox-group',
        'toggle', 'toggle-group', 'button-group',
        // Numeric / visual
        'range', 'color', 'date', 'datetime', 'size', 'spacing',
        // Display-only
        'message', 'wysiwyg', 'oembed',
        // Media
        'image', 'gallery', 'file', 'icon',
        // Reference
        'post-object', 'taxonomy', 'user', 'page-link', 'relationship',
        // Other
        'google-map', 'repeater',
        // Structural — render as parent panels, produce no attribute.
        'group', 'panel', 'tools-panel',
    ];

    /**
     * Control types that are structural (render an Inspector panel header,
     * never produce an attribute, and can be the target of a parentPanelId).
     */
    public const STRUCTURAL_TYPES = ['group', 'panel', 'tools-panel'];

    private const VALID_ATTRIBUTE_TYPES = ['string', 'number', 'boolean', 'object', 'array', 'integer'];

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
                foreach ($config['controls'] as $control) {
                    if (is_array($control) && in_array($control['type'] ?? null, self::STRUCTURAL_TYPES, true) && !empty($control['id'])) {
                        $group_ids[$control['id']] = true;
                    }
                }
                foreach ($config['controls'] as $i => $control) {
                    self::validate_control($control, "controls[{$i}]", $seen_ids, $group_ids, $errors);
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

    private static function validate_control($control, $path, array &$seen_ids, array $group_ids, array &$errors) {
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

        // Type may be a built-in or a custom registered type. Don't hard-reject custom names.
        // Future: add a runtime registry and check known names only.

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
