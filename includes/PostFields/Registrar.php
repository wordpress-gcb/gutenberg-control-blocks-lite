<?php
/**
 * Attach gcb-lite typed-field controls to a custom post type's edit screen.
 *
 * Usage from a theme (e.g. in functions.php after register_post_type):
 *
 *   gcblite_register_post_fields('project', [
 *       'controls' => [
 *           ['type' => 'text',  'attributeKey' => 'subtitle', 'label' => 'Subtitle'],
 *           ['type' => 'image', 'attributeKey' => 'cover',    'label' => 'Cover image'],
 *           ['type' => 'url',   'attributeKey' => 'live_url', 'label' => 'Live URL'],
 *       ],
 *   ]);
 *
 * What this gives you:
 *   - A meta-box on the post edit screen rendering the same control library
 *     the block Inspector uses (PHP-served container + React-rendered UI).
 *   - Each field saved to post-meta on save_post.
 *   - Each field exposed as `meta.{key}` on the REST endpoint for that CPT,
 *     so a headless frontend can read it via /wp/v2/{cpt}.
 *   - REST `meta` is registered with the field's WP attribute type so the
 *     response is properly typed (string vs object vs array).
 *
 * Scope notes:
 *   - We deliberately use a classic add_meta_box rather than a block-editor
 *     sidebar panel. CPT field data is editorial (the post IS the record),
 *     not block-level — meta-boxes match that mental model and avoid the
 *     complexity of registering a custom store + sidebar plugin for every CPT.
 *   - Structural controls (group / panel / tools-panel) work the same way
 *     they do in the block Inspector — the JS renderer reuses the existing
 *     bucketing logic.
 *
 * @package GCBLite\PostFields
 */

namespace GCBLite\PostFields;

if (!defined('ABSPATH')) {
    exit;
}

class Registrar {

    /**
     * Registered configs keyed by post type.
     * @var array<string, array{controls: array}>
     */
    private static $registry = [];

    private const META_BOX_ID    = 'gcblite-post-fields';
    private const NONCE_ACTION   = 'gcblite_post_fields_save';
    private const NONCE_NAME     = 'gcblite_post_fields_nonce';
    private const SUBMIT_FIELD   = 'gcblite_post_fields_values';

    public static function init() {
        add_action('add_meta_boxes', [__CLASS__, 'add_meta_boxes']);
        add_action('save_post',      [__CLASS__, 'save_post'], 10, 2);
        add_action('init',           [__CLASS__, 'register_post_meta_for_all'], 20);
        add_action('admin_enqueue_scripts', [__CLASS__, 'enqueue']);
    }

    /**
     * Public registration API. Call from theme code after register_post_type.
     *
     * @param string $post_type
     * @param array  $config Must contain 'controls' (same shape as block.fields.json).
     */
    public static function register($post_type, array $config) {
        if (!isset($config['controls']) || !is_array($config['controls'])) {
            return;
        }
        self::$registry[$post_type] = $config;
    }

    public static function get_registered() {
        return self::$registry;
    }

    public static function add_meta_boxes() {
        foreach (self::$registry as $post_type => $config) {
            add_meta_box(
                self::META_BOX_ID,
                __('Fields', 'gcblite'),
                [__CLASS__, 'render_meta_box'],
                $post_type,
                'normal',
                'high'
            );
        }
    }

    public static function render_meta_box($post) {
        $post_type = $post->post_type;
        $config    = self::$registry[$post_type] ?? null;
        if (!$config) {
            return;
        }

        $values = self::collect_current_values($post->ID, $config['controls']);

        wp_nonce_field(self::NONCE_ACTION, self::NONCE_NAME);

        printf(
            '<div class="gcblite-post-fields-root" data-config="%s" data-values="%s"></div>',
            esc_attr(wp_json_encode($config)),
            esc_attr(wp_json_encode((object) $values))
        );

        // Hidden field the React app writes back into on every change.
        // save_post reads from this on submit.
        printf(
            '<input type="hidden" name="%s" class="gcblite-post-fields-submit" value="%s" />',
            esc_attr(self::SUBMIT_FIELD),
            esc_attr(wp_json_encode((object) $values))
        );
    }

    public static function save_post($post_id, $post) {
        if (!isset($_POST[self::NONCE_NAME])) {
            return;
        }
        if (!wp_verify_nonce(sanitize_key($_POST[self::NONCE_NAME]), self::NONCE_ACTION)) {
            return;
        }
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }
        if (!current_user_can('edit_post', $post_id)) {
            return;
        }

        $config = self::$registry[$post->post_type] ?? null;
        if (!$config) {
            return;
        }

        $raw = isset($_POST[self::SUBMIT_FIELD]) ? wp_unslash($_POST[self::SUBMIT_FIELD]) : '';
        $submitted = json_decode((string) $raw, true);
        if (!is_array($submitted)) {
            $submitted = [];
        }

        foreach ($config['controls'] as $control) {
            $key = $control['attributeKey'] ?? null;
            if (!is_string($key) || $key === '') continue;
            if (in_array($control['type'] ?? '', ['group', 'panel', 'tools-panel'], true)) continue;

            $value = $submitted[$key] ?? null;
            update_post_meta($post_id, $key, $value);
        }
    }

    /**
     * Expose each registered field as REST `meta` for its post type so a
     * headless frontend can read it via /wp/v2/{cpt}?_fields=id,title,meta.
     */
    public static function register_post_meta_for_all() {
        foreach (self::$registry as $post_type => $config) {
            foreach ($config['controls'] as $control) {
                $key = $control['attributeKey'] ?? null;
                if (!is_string($key) || $key === '') continue;
                if (in_array($control['type'] ?? '', ['group', 'panel', 'tools-panel'], true)) continue;

                register_post_meta($post_type, $key, [
                    'type'         => self::rest_type_for($control),
                    'single'       => true,
                    'show_in_rest' => self::show_in_rest_for($control),
                    'auth_callback' => function () { return current_user_can('edit_posts'); },
                ]);
            }
        }
    }

    public static function enqueue($hook) {
        // Only on post edit / new-post screens for a registered CPT.
        if (!in_array($hook, ['post.php', 'post-new.php'], true)) {
            return;
        }
        $screen = function_exists('get_current_screen') ? get_current_screen() : null;
        if (!$screen || !isset(self::$registry[$screen->post_type])) {
            return;
        }

        $build = GCBLITE_PLUGIN_DIR . 'build/post-fields.js';
        $asset = GCBLITE_PLUGIN_DIR . 'build/post-fields.asset.php';
        if (!file_exists($build) || !file_exists($asset)) {
            return;
        }
        $info = include $asset;

        wp_enqueue_script(
            'gcblite-post-fields',
            GCBLITE_PLUGIN_URL . 'build/post-fields.js',
            $info['dependencies'],
            $info['version'],
            true
        );

        // The control library uses the same CSS as the block editor bundle.
        $css = GCBLITE_PLUGIN_DIR . 'build/post-fields.css';
        if (file_exists($css)) {
            wp_enqueue_style(
                'gcblite-post-fields',
                GCBLITE_PLUGIN_URL . 'build/post-fields.css',
                ['wp-components'],
                $info['version']
            );
        }
    }

    private static function collect_current_values($post_id, array $controls) {
        $values = [];
        foreach ($controls as $control) {
            $key = $control['attributeKey'] ?? null;
            if (!is_string($key) || $key === '') continue;
            $stored = get_post_meta($post_id, $key, true);
            if ($stored === '' || $stored === null) {
                $values[$key] = $control['default'] ?? null;
            } else {
                $values[$key] = $stored;
            }
        }
        return $values;
    }

    /**
     * Mirror BlockLoader::default_attribute_type so post-meta REST type
     * matches the block-attribute type for the same control.
     */
    private static function rest_type_for(array $control) {
        $explicit = $control['attributeType'] ?? null;
        if (is_string($explicit) && $explicit !== '') {
            // REST schema doesn't accept 'array' alone; map to object when
            // object-shaped, otherwise let WP handle.
            return $explicit === 'array' ? 'array' : $explicit;
        }
        switch ($control['type'] ?? '') {
            case 'checkbox':
            case 'toggle':
                return 'boolean';
            case 'number':
            case 'range':
                return 'number';
            case 'image':
            case 'gallery':
            case 'file':
            case 'oembed':
            case 'color':
            case 'date':
            case 'datetime':
            case 'icon':
            case 'page-link':
            case 'post-object':
            case 'relationship':
            case 'google-map':
            case 'checkbox-group':
            case 'button-group':
                return 'object';
            default:
                return 'string';
        }
    }

    private static function show_in_rest_for(array $control) {
        $type = self::rest_type_for($control);
        if ($type !== 'object' && $type !== 'array') {
            return true;
        }
        // Object/array meta needs an explicit schema for show_in_rest. We
        // accept any-shape since the typed-field UI controls the writes.
        return [
            'schema' => [
                'type'                 => $type,
                'additionalProperties' => true,
            ],
        ];
    }
}
