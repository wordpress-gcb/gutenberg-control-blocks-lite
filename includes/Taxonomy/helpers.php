<?php
/**
 * Theme-facing helpers for the Taxonomy registrar.
 *
 *   gcblite_register_taxonomy_fields('category', ['controls' => [...]]);
 *   $values = gcblite_get_term_fields('category', $term_id);
 *
 * Same control schema as gcblite_register_post_fields — same control
 * types, same validation, same conditional logic. Stored in wp_termmeta
 * via the standard WP get_term_meta / update_term_meta APIs, so existing
 * theme code that reads term meta keeps working.
 *
 * @package GCBLite\Taxonomy
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('gcblite_register_taxonomy_fields')) {
    function gcblite_register_taxonomy_fields($taxonomy, array $config) {
        \GCBLite\Taxonomy\Registrar::register($taxonomy, $config);
    }
}

if (!function_exists('gcblite_get_term_fields')) {
    /**
     * Convenience wrapper around get_term_meta that fills declared
     * defaults for missing keys, matching the REST shape.
     */
    function gcblite_get_term_fields($taxonomy, $term_id) {
        $registry = \GCBLite\Taxonomy\Registrar::get_registered();
        $config = $registry[$taxonomy] ?? null;
        if (!$config) return [];

        $values = [];
        foreach ($config['controls'] as $control) {
            $key = $control['attributeKey'] ?? null;
            if (!is_string($key) || $key === '') continue;
            if (in_array($control['type'] ?? '', ['group', 'panel', 'tools-panel'], true)) continue;

            $stored = get_term_meta((int) $term_id, $key, true);
            if ($stored === '' && array_key_exists('default', $control)) {
                $values[$key] = $control['default'];
            } else {
                $values[$key] = $stored;
            }
        }
        return $values;
    }
}
