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
        add_action('init', [__CLASS__, 'register_map_assets']);
    }

    /**
     * The gcb/map block's assets: its style + the front-end view script,
     * plus the public Google Maps JS API (gated on a configured key). The
     * map renders a REAL interactive map by default — view.js does
     * new google.maps.Map, styled by a Cloud Map ID. Registered by handle
     * (block.json names them in "style"/"viewScript") so the block only
     * loads them when it's actually on the page.
     *
     * loading=async + callback=gcbMapInit is Google's required async
     * bootstrap; view.js defines gcbMapInit as the global the loader calls.
     * Styling is a Cloud Map ID (view.js passes mapId) — Google's forward
     * path, replacing the deprecated JSON styles array (the two are
     * mutually exclusive). Classic google.maps.Marker still works with a
     * mapId (vector map), so no marker library is required.
     */
    public static function register_map_assets() {
        wp_register_style(
            'gcblite-map',
            GCBLITE_PLUGIN_URL . 'blocks/map/style.css',
            [],
            GCBLITE_VERSION
        );

        // view.js defines the gcbMapInit callback, so it must load BEFORE
        // the Google loader fires that callback → the Maps API depends on
        // view.js (not the reverse). block.json's viewScript is
        // gcblite-map-view; the Maps API rides along as its dependency's
        // dependency being flipped, so we make the Maps handle depend on
        // view and enqueue Maps from the block too.
        wp_register_script(
            'gcblite-map-view',
            GCBLITE_PLUGIN_URL . 'blocks/map/view.js',
            [],
            GCBLITE_VERSION,
            true
        );

        if (class_exists('\GCBLite\Integrations\GoogleMapsKey')) {
            $key = \GCBLite\Integrations\GoogleMapsKey::get();
            if ($key !== '') {
                wp_register_script(
                    'gcblite-google-maps',
                    'https://maps.googleapis.com/maps/api/js?key=' . esc_attr($key)
                        . '&loading=async&callback=gcbMapInit',
                    [ 'gcblite-map-view' ],
                    null,
                    true
                );
                // The block only names gcblite-map-view as its viewScript;
                // pull the Maps loader in alongside it whenever the view
                // script is enqueued (i.e. the block is on the page).
                add_action('wp_enqueue_scripts', function () {
                    if (wp_script_is('gcblite-map-view', 'enqueued')) {
                        wp_enqueue_script('gcblite-google-maps');
                    }
                }, 20);
            }
        }
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
