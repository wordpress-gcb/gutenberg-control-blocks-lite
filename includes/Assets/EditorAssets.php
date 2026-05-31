<?php
/**
 * Enqueue the controls JS bundle and pass registered block configs to the editor.
 *
 * @package GCBLite\Assets
 */

namespace GCBLite\Assets;

use GCBLite\Blocks\BlockLoader;
use GCBLite\Tokens\TokenParser;
use GCBLite\Integrations\GoogleMapsKey;

if (!defined('ABSPATH')) {
    exit;
}

class EditorAssets {

    public static function init() {
        // Register the script EARLY (before block.json registration runs at init priority 10),
        // so blocks can declare `editorScript: gcb-lite` and have WP find the handle.
        add_action('init', [__CLASS__, 'register'], 1);
        // Bind localised data AFTER blocks have registered (BlockLoader runs at priority 5).
        // Ties data to the registered handle so it's printed inline regardless of who
        // ultimately enqueues the script (us via enqueue_block_editor_assets, or WP via
        // block-asset auto-loading from block.json's editorScript).
        add_action('init', [__CLASS__, 'localize'], 20);
        // Editor JS goes on the surrounding admin chrome (outside the iframe).
        add_action('enqueue_block_editor_assets', [__CLASS__, 'enqueue']);
        // Editor CSS goes via enqueue_block_assets so it reaches inside the
        // WP 5.9+ iframed editor canvas (where the [class*="wp-block-gcb-"]
        // elements actually live). Gated on is_admin() so the public side
        // doesn't get editor-only display:contents rules.
        add_action('enqueue_block_assets', [__CLASS__, 'enqueue_editor_css_in_iframe']);
        // The component server publishes its CSS bundle at a stable URL.
        // Same hook for the same reason as above.
        add_action('enqueue_block_assets', [__CLASS__, 'enqueue_component_server_styles']);
    }

    public static function localize() {
        if (!wp_script_is('gcb-lite', 'registered')) {
            return;
        }
        $google_maps_api_key = GoogleMapsKey::get();
        wp_localize_script('gcb-lite', 'gcbLite', [
            'blocks'     => self::collect_block_configs(),
            'tokens'     => self::theme_json_tokens(),
            'palette'    => self::palette_data(),
            'googleMaps' => [
                'apiKey'    => $google_maps_api_key,
                'hasApiKey' => $google_maps_api_key !== '',
            ],
            // Author-facing attribute name for click-to-focus-Inspector.
            // Source of truth is gcb_focus_field_attribute_name(), which
            // applies the gcblite_focus_field_attribute filter against
            // the plugin default. Whatever the site returns is what
            // both the editor's click handler reads AND what gcb_focus()
            // emits in render.php — single hook, one value everywhere.
            'focusFieldAttribute' => gcb_focus_field_attribute_name(),
            // Headless frontend URL + provenance. Drives the FrontendUrlBar
            // strip at the top of the editor — Storybook-style "this is
            // where your content is coming from" badge.
            'frontend' => self::frontend_descriptor(),
        ]);
    }

    /**
     * Resolve the headless frontend URL alongside its provenance so the
     * editor strip can show "constant in wp-config.php" vs a Settings-page
     * override vs unconfigured. Empty URL string means PHP-rendered (no
     * headless), which the bar surfaces as a distinct state.
     */
    private static function frontend_descriptor() {
        $url    = \GCBLite\Frontend\Url::get();
        $source = self::frontend_source();
        return [
            'url'      => $url,
            'source'   => $source, // 'constant' | 'filter' | 'option' | 'none'
            'isHeadless' => $url !== '',
            'siteUrl'  => home_url(), // shown as the WP-PHP fallback origin
            'settingsUrl' => admin_url('admin.php?page=gcb-lite-settings'),
        ];
    }

    private static function frontend_source() {
        if (defined('GCBLITE_COMPONENT_SERVER_URL') && is_string(GCBLITE_COMPONENT_SERVER_URL) && GCBLITE_COMPONENT_SERVER_URL !== '') {
            return 'constant';
        }
        $filtered = apply_filters('gcblite_frontend_url', null);
        if (is_string($filtered) && $filtered !== '') return 'filter';
        $opt = get_option(\GCBLite\Frontend\Url::OPTION_NAME, '');
        if (is_string($opt) && $opt !== '') return 'option';
        return 'none';
    }

    public static function register() {
        $build = GCBLITE_PLUGIN_DIR . 'build/index.js';
        $asset = GCBLITE_PLUGIN_DIR . 'build/index.asset.php';

        if (!file_exists($build) || !file_exists($asset)) {
            return;
        }

        $asset_data = require $asset;

        wp_register_script(
            'gcb-lite',
            GCBLITE_PLUGIN_URL . 'build/index.js',
            $asset_data['dependencies'],
            $asset_data['version'],
            false
        );

        $css_file = GCBLITE_PLUGIN_DIR . 'build/index.css';
        if (file_exists($css_file)) {
            wp_register_style(
                'gcb-lite-editor',
                GCBLITE_PLUGIN_URL . 'build/index.css',
                [],
                filemtime($css_file)
            );
        }
    }

    public static function enqueue() {
        if (!wp_script_is('gcb-lite', 'registered')) {
            return;
        }

        wp_enqueue_script('gcb-lite');
        // Editor CSS is NOT enqueued here on purpose — it goes via
        // enqueue_editor_css_in_iframe() on the enqueue_block_assets
        // hook, which is the only hook that reaches inside the WP 5.9+
        // iframed editor canvas. Many of the rules in build/index.css
        // (display:contents on wp-block-gcb-* inner blocks, etc.) only
        // make sense inside that iframe where the elements actually live.

        // Google Maps loads its own external script at editor enqueue time
        // when a key is configured (via wp-config constant, filter, or the
        // Settings page — see GoogleMapsKey for resolution order).
        $google_maps_api_key = GoogleMapsKey::get();
        if ($google_maps_api_key !== '') {
            wp_enqueue_script(
                'google-maps-api',
                'https://maps.googleapis.com/maps/api/js?key=' . esc_attr($google_maps_api_key) . '&libraries=places&loading=async&callback=Function.prototype',
                [],
                null,
                true
            );
        }
    }

    /**
     * Plugin's own editor CSS — load it inside the editor iframe (not on the
     * surrounding admin chrome), gated on is_admin() so the public site
     * doesn't get editor-only rules.
     *
     * Uses the same `enqueue_block_assets` hook as the component-server
     * stylesheets for the same reason: that's the only hook whose output
     * lands inside the WP 5.9+ iframed editor canvas, where our
     * `[class*="wp-block-gcb-"]` selectors actually have something to
     * match against.
     */
    public static function enqueue_editor_css_in_iframe() {
        if (!is_admin()) {
            return;
        }
        if (wp_style_is('gcb-lite-editor', 'registered')) {
            wp_enqueue_style('gcb-lite-editor');
        }
    }

    /**
     * Pull the component server's CSS bundles into the editor iframe and the
     * public frontend — but only when a React frontend has actually been
     * configured. Without a configured URL we no-op rather than enqueueing
     * from a hardcoded default (used to default to localhost:3001, which
     * broke hosted installs whose admins watched wp-admin fetch from a URL
     * that didn't exist for them).
     *
     * IMPORTANT: this fires on `enqueue_block_assets`, which is the only hook
     * that lands inside the WP 5.9+ editor canvas iframe. The more obvious
     * `enqueue_block_editor_assets` enqueues styles on the *surrounding* admin
     * page (outside the iframe), where our selectors targeting
     * `.editor-styles-wrapper` would never apply.
     *
     * Two stylesheets:
     *   - styles.css: ships everywhere (editor iframe + public frontend).
     *   - editor.css: editor-only overrides (force-open Radix accordions,
     *     etc). Gated on is_admin() so the public frontend never gets it.
     *
     * Both URLs are stable redirects — Next's per-build fingerprinting on
     * the redirect target handles cache busting.
     */
    public static function enqueue_component_server_styles() {
        $base = \GCBLite\Frontend\Url::get();
        if ($base === '') {
            return;
        }
        $base = trailingslashit($base);

        wp_enqueue_style(
            'gcblite-component-server',
            $base . 'wordpress/styles.css',
            [],
            null
        );

        if (is_admin()) {
            wp_enqueue_style(
                'gcblite-component-server-editor',
                $base . 'wordpress/editor.css',
                ['gcblite-component-server'],
                null
            );
        }
    }

    /**
     * Per-block configs the editor JS uses to render the Inspector controls.
     */
    private static function collect_block_configs() {
        $out = [];
        foreach (self::all_block_names() as $name) {
            $cfg = BlockLoader::get_block_config($name);
            if ($cfg) {
                $out[$name] = [
                    'controls' => $cfg['fields']['controls'] ?? [],
                ];
            }
        }
        return $out;
    }

    private static function all_block_names() {
        $registry = \WP_Block_Type_Registry::get_instance();
        $names = [];
        foreach ($registry->get_all_registered() as $name => $type) {
            if (strpos($name, 'gcb/') === 0) {
                $names[] = $name;
            }
        }
        return $names;
    }

    /**
     * Resolved theme.json tokens — passed to the editor under window.gcbLite.tokens.
     * Shape matches the original GCB token tree: { '{category}': { label, children: { '{group}': { label, tokens[] } } } }
     */
    private static function theme_json_tokens() {
        return TokenParser::tokens_for_editor();
    }

    /**
     * Flat palette and spacing arrays for controls that want direct access
     * (e.g. ColorPalette wants [{name, color, slug}]). Tokens tree is the
     * canonical source; these are convenience views.
     */
    private static function palette_data() {
        if (!function_exists('wp_get_global_settings')) {
            return ['colors' => [], 'spacingSizes' => []];
        }
        $settings = wp_get_global_settings();
        return [
            'colors' => $settings['color']['palette']['theme']
                ?? $settings['color']['palette']['default']
                ?? [],
            'spacingSizes' => $settings['spacing']['spacingSizes']['theme']
                ?? $settings['spacing']['spacingSizes']['default']
                ?? [],
        ];
    }
}
