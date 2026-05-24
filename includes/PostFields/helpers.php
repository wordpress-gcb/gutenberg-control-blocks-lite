<?php
/**
 * Global helpers for the post-fields feature. Kept outside the namespace
 * so theme authors can call them directly from functions.php:
 *
 *   gcblite_register_post_fields('project', ['controls' => [...]]);
 *
 * @package GCBLite\PostFields
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('gcblite_register_post_fields')) {
    function gcblite_register_post_fields($post_type, array $config) {
        \GCBLite\PostFields\Registrar::register($post_type, $config);
    }
}
