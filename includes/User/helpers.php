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
 *   $shown  = gcblite_get_public_user_fields($user_id); // only `'public' => true` controls
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
        return \GCBLite\User\Registrar::get_values($user_id);
    }
}

// Only the fields marked `"public": true` — what a public profile may
// print for any visitor (2026-10-20).
if (!function_exists('gcblite_get_public_user_fields')) {
    function gcblite_get_public_user_fields($user_id) {
        return \GCBLite\User\Registrar::public_values($user_id);
    }
}
