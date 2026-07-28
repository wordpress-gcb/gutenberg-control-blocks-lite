<?php
namespace GCBLite\Blocks;

/**
 * Assets + icon collection for the blocks the plugin ships itself
 * ("the kit" — the blocks/ directory at the plugin root, scanned by
 * BlockLoader alongside the theme's).
 *
 * Also owns the site's custom icon collection: WP 7.1's Icons API
 * (wp_register_icon_collection / wp_register_icon) lets plugins add
 * collections beside core's. We register a "gcb" collection and fill it
 * from the gcblite_custom_icons filter, so custom/brand icons flow into
 * every icon picker and every server-side render with no extra
 * plumbing. Feature-detected — on WP 7.0 the collection quietly doesn't
 * exist and core icons still work.
 */
class KitBlocks {

    public static function init() {
        add_action('init', [__CLASS__, 'register_styles']);
        add_action('init', [__CLASS__, 'register_icon_collection']);
    }

    /**
     * Kit block styles are registered by handle (named in each block.json
     * "style") rather than file: — the plugin dir is often a symlink in
     * dev, and WP mis-derives file: URLs for paths outside the real
     * WP_PLUGIN_DIR. GCBLITE_PLUGIN_URL always resolves correctly.
     */
    public static function register_styles() {
        wp_register_style(
            'gcblite-icon-list',
            GCBLITE_PLUGIN_URL . 'blocks/icon-list/style.css',
            [],
            GCBLITE_VERSION
        );
    }

    /**
     * The "gcb" icon collection — custom/brand icons beside core's.
     */
    public static function register_icon_collection() {
        if (!function_exists('wp_register_icon_collection')) {
            return; // WP < 7.1 — registry closed to third parties.
        }

        /**
         * Custom icons for the site's gcb collection.
         *
         * @param array $icons name => { label: string, content: svg string }
         */
        $icons = apply_filters('gcblite_custom_icons', []);
        if (empty($icons) || !is_array($icons)) {
            return; // No empty collection cluttering the picker.
        }

        wp_register_icon_collection('gcb', [
            'label'       => __('Site icons', 'gcblite'),
            'description' => __('Custom icons added through GCB.', 'gcblite'),
        ]);

        foreach ($icons as $name => $args) {
            if (!is_string($name) || !is_array($args) || empty($args['content'])) {
                continue;
            }
            wp_register_icon('gcb/' . $name, [
                'label'   => (string) ($args['label'] ?? $name),
                'content' => (string) $args['content'],
            ]);
        }
    }
}
