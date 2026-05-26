<?php
/**
 * Shared admin-bundle enqueuer for the post-fields React app.
 *
 * Every surface that mounts `.gcblite-post-fields-root` (post-meta box,
 * options page, taxonomy term edit, user profile, …) needs the SAME
 * three things:
 *   - wp.media   — backs MediaUpload / MediaUploadCheck for image, file,
 *                  gallery controls
 *   - wp.editor  — backs TinyMCE for the wysiwyg control
 *   - build/post-fields.{js,css} — the actual React Inspector bundle
 *
 * Centralising the wp_enqueue_* calls here means a new surface just
 * decides WHEN to enqueue (i.e. which admin hook it cares about) and
 * delegates the WHAT to this class. If the bundle filename or its CSS
 * dependencies change in future, we only edit one place.
 *
 * @package GCBLite\PostFields
 */

namespace GCBLite\PostFields;

if (!defined('ABSPATH')) {
    exit;
}

class AssetEnqueuer {

    /**
     * Load the post-fields JS + CSS bundle plus its WP runtime deps.
     *
     * Idempotent — wp_enqueue_script with the same handle is a no-op,
     * so multiple surfaces enqueuing on the same screen is safe.
     *
     * Returns false if the build artifacts aren't present (a CI
     * misconfiguration; callers don't need to act on it, the missing
     * bundle just means the controls won't render).
     */
    public static function enqueue() {
        wp_enqueue_media();
        if (function_exists('wp_enqueue_editor')) {
            wp_enqueue_editor();
        }

        $build = GCBLITE_PLUGIN_DIR . 'build/post-fields.js';
        $asset = GCBLITE_PLUGIN_DIR . 'build/post-fields.asset.php';
        if (!file_exists($build) || !file_exists($asset)) {
            return false;
        }
        $info = include $asset;

        wp_enqueue_script(
            'gcblite-post-fields',
            GCBLITE_PLUGIN_URL . 'build/post-fields.js',
            $info['dependencies'],
            $info['version'],
            true
        );

        $css = GCBLITE_PLUGIN_DIR . 'build/post-fields.css';
        if (file_exists($css)) {
            wp_enqueue_style(
                'gcblite-post-fields',
                GCBLITE_PLUGIN_URL . 'build/post-fields.css',
                ['wp-components'],
                $info['version']
            );
        }
        return true;
    }
}
