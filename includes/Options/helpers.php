<?php
/**
 * Theme-facing helpers for the Options registrar.
 *
 *   gcblite_register_options_fields('site_settings', ['controls' => [...]]);
 *   $values = gcblite_get_options('site_settings');
 *
 * Same control schema as gcblite_register_post_fields — same 30+ control
 * types, same validation, same conditional logic. Stored in wp_options
 * instead of wp_postmeta. Exposed via REST at
 * /wp-json/gcblite/v1/options/{slug} so headless frontends can read.
 *
 * @package GCBLite\Options
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('gcblite_register_options_fields')) {
    function gcblite_register_options_fields($slug, array $config) {
        \GCBLite\Options\Registrar::register($slug, $config);
    }
}

if (!function_exists('gcblite_get_options')) {
    function gcblite_get_options($slug) {
        return \GCBLite\Options\Registrar::get_values($slug);
    }
}
