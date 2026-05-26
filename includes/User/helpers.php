<?php
/**
 * Theme-facing helpers for the User registrar.
 *
 *   gcblite_register_user_fields([
 *       'controls' => [
 *           ['type' => 'url',     'attributeKey' => 'website', 'label' => 'Personal site'],
 *           ['type' => 'textarea','attributeKey' => 'extended_bio', 'label' => 'Long bio'],
 *       ],
 *   ]);
 *
 *   $values = gcblite_get_user_fields($user_id);
 *
 * Same control schema as the post / options / taxonomy registrars.
 * Stored to wp_usermeta keyed by user ID; reads use the standard
 * get_user_meta API.
 *
 * @package GCBLite\User
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('gcblite_register_user_fields')) {
    function gcblite_register_user_fields(array $config) {
        \GCBLite\User\Registrar::register($config);
    }
}

if (!function_exists('gcblite_get_user_fields')) {
    function gcblite_get_user_fields($user_id) {
        $config = \GCBLite\User\Registrar::get_config();
        if (!$config) return [];

        $values = [];
        foreach ($config['controls'] as $control) {
            $key = $control['attributeKey'] ?? null;
            if (!is_string($key) || $key === '') continue;
            if (in_array($control['type'] ?? '', ['group', 'panel', 'tools-panel'], true)) continue;

            $stored = get_user_meta((int) $user_id, $key, true);
            if ($stored === '' && array_key_exists('default', $control)) {
                $values[$key] = $control['default'];
            } else {
                $values[$key] = $stored;
            }
        }
        return $values;
    }
}
