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

/**
 * Render the registered post-fields for a post as an ACF-style
 * label/value stack. Defaults to the current post in The Loop.
 *
 *     <?php gcblite_render_post_fields(); ?>
 *
 * @param int|null $post_id  Specific post ID, or null for current.
 */
if (!function_exists('gcblite_render_post_fields')) {
    function gcblite_render_post_fields($post_id = null) {
        \GCBLite\PostFields\Renderer::render($post_id);
    }
}
