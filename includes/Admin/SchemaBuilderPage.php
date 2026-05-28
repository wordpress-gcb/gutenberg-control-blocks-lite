<?php
/**
 * GCB Lite → Schema Builder admin pages.
 *
 * Top-level "GCB Lite" menu with two submenu pages:
 *   - Blocks            (block.fields.json editor)
 *   - Structured fields (post-/taxonomy-/user-/options-field schemas)
 *
 * Both pages mount the same React bundle (build/builder.js). The page
 * tells the React app which view to render via a data-view attribute on
 * the mount node.
 *
 * @package GCBLite\Admin
 */

namespace GCBLite\Admin;

use GCBLite\Docs\ControlDocs;

if (!defined('ABSPATH')) {
    exit;
}

class SchemaBuilderPage {

    const MENU_SLUG            = 'gcblite-schema-builder';
    const BLOCKS_SLUG          = 'gcblite-schema-builder';            // same as parent → "Blocks" is the default
    const STRUCTURED_SLUG      = 'gcblite-structured-fields';

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'register_pages']);
        add_action('admin_enqueue_scripts', [__CLASS__, 'enqueue_assets']);
    }

    public static function register_pages() {
        add_menu_page(
            __('GCB Lite', 'gcblite'),
            __('GCB Lite', 'gcblite'),
            // Same cap the REST write endpoints check. Users with only
            // edit_posts see neither — keeps the menu out of their way.
            'edit_themes',
            self::BLOCKS_SLUG,
            [__CLASS__, 'render_blocks_page'],
            'dashicons-screenoptions',
            58
        );

        // Submenu #1 — repeats the parent slug so the same callback fires.
        // WP convention: this entry shows the menu title as the parent.
        add_submenu_page(
            self::BLOCKS_SLUG,
            __('GCB Lite — Blocks', 'gcblite'),
            __('Blocks', 'gcblite'),
            'edit_themes',
            self::BLOCKS_SLUG,
            [__CLASS__, 'render_blocks_page']
        );

        add_submenu_page(
            self::BLOCKS_SLUG,
            __('GCB Lite — Structured fields', 'gcblite'),
            __('Structured fields', 'gcblite'),
            'edit_themes',
            self::STRUCTURED_SLUG,
            [__CLASS__, 'render_structured_page']
        );
    }

    public static function render_blocks_page() {
        self::render_mount('blocks');
    }

    public static function render_structured_page() {
        self::render_mount('structured-fields');
    }

    private static function render_mount($view) {
        echo '<div class="wrap" style="padding: 0;">';
        printf(
            '<div id="gcblite-schema-builder-root" data-view="%s" data-state="loading">',
            esc_attr($view)
        );
        echo '<div style="padding: 60px 24px; text-align: center; color: #525260;">';
        echo '<p>' . esc_html__('Loading schema builder…', 'gcblite') . '</p>';
        echo '</div>';
        echo '</div>';
        echo '</div>';
    }

    /**
     * Enqueue the bundle on both Schema Builder pages. The hook suffix
     * differs per submenu — `toplevel_page_{slug}` for the parent and
     * `{parent}_page_{child}` for siblings. Match either.
     */
    public static function enqueue_assets($hook) {
        $expected = [
            'toplevel_page_' . self::BLOCKS_SLUG,
            // Submenu hook: WP derives the parent's menu title-as-slug at
            // runtime. Easier just to match by suffix.
        ];
        $is_ours = in_array($hook, $expected, true)
            || (is_string($hook) && substr($hook, -strlen(self::STRUCTURED_SLUG)) === self::STRUCTURED_SLUG);
        if (!$is_ours) return;

        $asset_file = GCBLITE_PLUGIN_DIR . 'build/builder.asset.php';
        $asset = file_exists($asset_file) ? include $asset_file : [
            'dependencies' => [],
            'version'      => filemtime(GCBLITE_PLUGIN_DIR . 'build/builder.js'),
        ];

        wp_enqueue_script(
            'gcblite-builder',
            GCBLITE_PLUGIN_URL . 'build/builder.js',
            $asset['dependencies'],
            $asset['version'],
            true
        );

        $css = GCBLITE_PLUGIN_DIR . 'build/builder.css';
        if (file_exists($css)) {
            wp_enqueue_style(
                'gcblite-builder',
                GCBLITE_PLUGIN_URL . 'build/builder.css',
                [],
                filemtime($css)
            );
        }

        wp_localize_script('gcblite-builder', 'gcbLiteBuilder', [
            'restUrl'      => esc_url_raw(rest_url('gcblite/v1/builder/')),
            'restNonce'    => wp_create_nonce('wp_rest'),
            'schemaUrl'    => esc_url_raw(GCBLITE_PLUGIN_URL . 'schemas/gcb.schema.json'),
            'controlTypes' => ControlDocs::list_types(),
            'capabilities' => [
                'canWrite' => current_user_can('edit_themes'),
            ],
        ]);
    }
}
