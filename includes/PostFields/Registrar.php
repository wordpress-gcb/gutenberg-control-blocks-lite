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
        // Strip 'editor' support from field-only CPTs. Priority 100 so we
        // run after the theme's register_post_type. The theme can opt back
        // in by passing 'has_body' => true to gcblite_register_post_fields.
        add_action('init',           [__CLASS__, 'remove_editor_from_field_only_cpts'], 100);
        add_action('admin_enqueue_scripts', [__CLASS__, 'enqueue']);
        add_action('admin_notices',         [__CLASS__, 'render_validation_notice']);
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

    /**
     * Record-style CPTs (testimonial, brand, project metadata) don't want a
     * block-editor body — they ARE the record. The editor adds visual noise
     * and the block-editor sidebar pushes our meta-box into the cramped
     * "advanced" accordion. Default to no body; theme opts in via
     * 'has_body' => true if it wants both fields AND a content body.
     */
    public static function remove_editor_from_field_only_cpts() {
        foreach (self::$registry as $post_type => $config) {
            if (!empty($config['has_body'])) {
                continue;
            }
            remove_post_type_support($post_type, 'editor');
        }
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

        // Save fields first so the user doesn't lose their input even when
        // validation fails. Validation only decides whether the post is
        // allowed to go public — invalid fields stay drafted, not lost.
        foreach ($config['controls'] as $control) {
            $key = $control['attributeKey'] ?? null;
            if (!is_string($key) || $key === '') continue;
            if (in_array($control['type'] ?? '', ['group', 'panel', 'tools-panel'], true)) continue;

            $value = $submitted[$key] ?? null;
            update_post_meta($post_id, $key, $value);
        }

        // Server-side validation. Mirror of the client-side check —
        // ensures even a client with JS disabled or hostile can't bypass.
        // Skip fields hidden by conditional logic.
        $is_visible = fn($control) => Conditional::should_render($control, $submitted);
        $validation = Validator::validate_all($config['controls'], $submitted, $is_visible);

        if (!$validation['ok']) {
            // Stash the errors against the post id so admin_notices can
            // surface them after the redirect.
            set_transient(
                'gcblite_post_fields_errors_' . $post_id,
                $validation['errors'],
                MINUTE_IN_SECONDS
            );

            // If the user tried to publish, demote to draft so an
            // incomplete record can't go live. Don't touch posts that were
            // already a draft / pending / etc.
            if ($post->post_status === 'publish' || $post->post_status === 'future') {
                remove_action('save_post', [__CLASS__, 'save_post'], 10);
                wp_update_post([
                    'ID'          => $post_id,
                    'post_status' => 'draft',
                ]);
                add_action('save_post', [__CLASS__, 'save_post'], 10, 2);
            }
        }
    }

    /**
     * Render the validation-error admin notice after a save_post that
     * failed validation. Transient is keyed by post id so it only shows
     * to the user who triggered the save, on the post they were editing.
     */
    public static function render_validation_notice() {
        $screen = function_exists('get_current_screen') ? get_current_screen() : null;
        if (!$screen || !in_array($screen->base, ['post'], true)) return;

        global $post;
        if (!$post) return;

        $errors = get_transient('gcblite_post_fields_errors_' . $post->ID);
        if (!$errors || !is_array($errors)) return;

        delete_transient('gcblite_post_fields_errors_' . $post->ID);

        $config = self::$registry[$post->post_type] ?? null;
        if (!$config) return;

        // Look up human labels for each errored key.
        $label_lookup = [];
        foreach ($config['controls'] as $control) {
            if (!empty($control['attributeKey'])) {
                $label_lookup[$control['attributeKey']] = $control['label'] ?? $control['attributeKey'];
            }
        }

        echo '<div class="notice notice-error"><p><strong>'
            . esc_html__('The post couldn\'t be published because some fields need attention:', 'gcblite')
            . '</strong></p><ul style="list-style:disc;margin-left:20px;">';
        foreach ($errors as $key => $message) {
            $label = $label_lookup[$key] ?? $key;
            echo '<li><strong>' . esc_html($label) . ':</strong> ' . esc_html($message) . '</li>';
        }
        echo '</ul><p>'
            . esc_html__('We\'ve saved your changes as a draft.', 'gcblite')
            . '</p></div>';
    }

    /**
     * Expose each registered field as REST `meta` for its post type so a
     * headless frontend can read it via /wp/v2/{cpt}?_fields=id,title,meta.
     *
     * Also enables 'custom-fields' support on the post type. Without that,
     * WP core suppresses the `meta` key from REST responses entirely — even
     * for fields registered with show_in_rest. Themes seldom add it to
     * their supports array, so we add it here so meta actually appears.
     */
    public static function register_post_meta_for_all() {
        foreach (self::$registry as $post_type => $config) {
            add_post_type_support($post_type, 'custom-fields');
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

        // wp.media is what backs MediaUpload / MediaUploadCheck. When the
        // block editor is enabled on a screen WP enqueues it automatically;
        // because we strip 'editor' support from field-only CPTs (so the
        // editor doesn't crowd the meta-box), that auto-enqueue stops
        // happening — and MediaUpload silently renders nothing. Load it
        // ourselves whenever a registered field-only screen is showing.
        wp_enqueue_media();

        // wp.editor.initialize backs the wysiwyg control (TinyMCE). Same
        // story as wp_enqueue_media — without 'editor' post-type support
        // WP doesn't auto-load it, so the wysiwyg field would be a plain
        // textarea fallback.
        if (function_exists('wp_enqueue_editor')) {
            wp_enqueue_editor();
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
            case 'heading-level':
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
