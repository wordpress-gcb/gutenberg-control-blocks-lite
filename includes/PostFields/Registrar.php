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
        // REST-side validation for sidebar CPTs (which save via REST and
        // therefore bypass save_post's $_POST nonce gate). Hooked on
        // rest_api_init so we can register one filter per CPT.
        add_action('rest_api_init',  [__CLASS__, 'register_rest_validators']);
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
        global $post;
        foreach (self::$registry as $post_type => $config) {
            // CPTs with a block-editor body get their fields in the
            // editor's Inspector sidebar instead of a classic meta-box.
            // The author then has fields right next to the canvas they're
            // composing — same model as @wordpress/editor's built-in
            // panels. Field-only CPTs stay on the meta-box surface,
            // since they have no editor for a sidebar to attach to.
            if (self::renders_in_sidebar($post_type, $config)) {
                continue;
            }

            // displayWhen rules: skip metabox registration when the rules
            // don't match the current post. add_meta_boxes fires per
            // post-edit screen, so $post is reliable here.
            if (!empty($config['displayWhen']) && $post) {
                $ctx = \GCBLite\StructuredFields\RuleEngine::context_for_post($post);
                if (!\GCBLite\StructuredFields\RuleEngine::matches($config, $ctx)) {
                    continue;
                }
            }

            add_meta_box(
                self::META_BOX_ID,
                __('Fields', 'gcblite'),
                [__CLASS__, 'render_meta_box'],
                $post_type,
                'normal',
                'high'
            );

            // Hide WP's built-in "Custom Fields" panel for any CPT that
            // has registered typed fields. The native panel shows raw
            // meta_key / meta_value rows for every key we own, which
            // (a) duplicates the typed UI confusingly and (b) lets an
            // author break our shapes by editing the raw row. Themes
            // that *want* the native panel back can pass
            //   'show_native_custom_fields' => true
            // when registering.
            if (empty($config['show_native_custom_fields'])) {
                remove_meta_box('postcustom', $post_type, 'normal');
            }
        }
    }

    /**
     * NOTE on sidebar saves: when a CPT uses the sidebar surface,
     * persistence happens through REST (the block editor's standard
     * save dispatches editPost → core/editor → wp/v2/{type}). Our
     * save_post handler still fires but its $_POST nonce-check won't
     * pass for REST saves, so server-side validation in save_post is
     * effectively a no-op for sidebar CPTs. In-editor validation still
     * runs via ValidationContext; full server-side parity would need
     * a rest_pre_insert_{type} filter — flagged for a follow-up.
     *
     * Decide where to render this CPT's fields. Three surfaces:
     *
     *   - 'sidebar': PluginDocumentSettingPanel in the Page/Post tab of
     *     Gutenberg's right sidebar (modern, native, recommended for
     *     CPTs with an editor body).
     *   - 'metabox': classic add_meta_box panel below the editor
     *     (wider, better for image/repeater editing).
     *   - 'auto' (default): sidebar when the CPT supports `editor`,
     *     metabox otherwise. Authors get the modern UX automatically.
     *
     * Authors pass `'surface' => 'sidebar' | 'metabox' | 'auto'` on the
     * config. Legacy `'force_metabox' => true` and `'has_body' => true`
     * remain honoured for back-compat.
     */
    private static function renders_in_sidebar($post_type, array $config) {
        // Legacy escape hatch — older configs use this.
        if (!empty($config['force_metabox'])) return false;

        $surface = $config['surface'] ?? 'auto';
        if ($surface === 'metabox') return false;
        if ($surface === 'sidebar') {
            return post_type_supports($post_type, 'editor');
        }

        // 'auto'. Modern default: sidebar when there's an editor to
        // attach to. Falls back to legacy 'has_body' for configs that
        // were written against the previous flag.
        if (!post_type_supports($post_type, 'editor')) return false;
        if (isset($config['has_body'])) return !empty($config['has_body']);
        return true;
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

            $value = Sanitizer::sanitize_one($control, $submitted[$key] ?? null);
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

    /**
     * For every sidebar-rendering CPT, hook rest_pre_insert_{type} so
     * meta submitted through the block editor's REST save runs the same
     * validation our save_post handler runs for classic meta-box saves.
     *
     * Why this is needed: sidebar CPTs (has_body=true) save through
     * /wp/v2/{type}, which bypasses save_post's $_POST nonce check.
     * Without this filter, server-side validation is effectively
     * advisory on those screens — the editor's red-ring lint is all
     * that stops a broken save.
     *
     * Skip meta-box CPTs: save_post already covers them and double-
     * validating would surface duplicate errors.
     */
    public static function register_rest_validators() {
        foreach (self::$registry as $post_type => $config) {
            if (!self::renders_in_sidebar($post_type, $config)) {
                continue;
            }
            add_filter("rest_pre_insert_{$post_type}", [__CLASS__, 'rest_validate'], 10, 2);
        }
    }

    /**
     * Validate the incoming REST payload's `meta` against the CPT's
     * field config. Returns the unchanged $prepared_post on success or
     * a WP_Error that aborts the save with a 400.
     *
     * Validation rules:
     *   - Merges submitted meta with already-stored values so a PATCH
     *     that only updates one field still has the full picture for
     *     conditional-logic checks.
     *   - Skips fields hidden by conditional logic.
     *   - Sanitises repeater values before validation so junk keys
     *     don't trip required checks.
     */
    public static function rest_validate($prepared_post, $request) {
        $post_type = isset($prepared_post->post_type)
            ? $prepared_post->post_type
            : (string) $request['type'];
        $config = self::$registry[$post_type] ?? null;
        if (!$config) {
            return $prepared_post;
        }

        $incoming = $request->get_param('meta');
        if (!is_array($incoming)) {
            $incoming = [];
        }

        // Merge with stored values on edits so conditional logic that
        // refers to a sibling field can see the persisted value when
        // only one field is being patched.
        $merged = [];
        $existing_id = isset($prepared_post->ID) ? (int) $prepared_post->ID : 0;
        foreach ($config['controls'] as $control) {
            $key = $control['attributeKey'] ?? null;
            if (!is_string($key) || $key === '') continue;
            if (in_array($control['type'] ?? '', ['group', 'panel', 'tools-panel'], true)) continue;

            if (array_key_exists($key, $incoming)) {
                $merged[$key] = Sanitizer::sanitize_one($control, $incoming[$key]);
            } elseif ($existing_id > 0) {
                $merged[$key] = get_post_meta($existing_id, $key, true);
            }
        }

        $is_visible = static fn($control) => Conditional::should_render($control, $merged);
        $validation = Validator::validate_all($config['controls'], $merged, $is_visible);
        if ($validation['ok']) {
            return $prepared_post;
        }

        // Build a single-line WP_Error summary so the editor's save-failure
        // toast carries useful information. Field-level errors live in
        // additional_data so a client can read them programmatically.
        $first_key     = array_key_first($validation['errors']);
        $first_message = $validation['errors'][$first_key];
        return new \WP_Error(
            'gcblite_validation_failed',
            $first_message,
            [
                'status' => 400,
                'fields' => $validation['errors'],
            ]
        );
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
        $config = self::$registry[$screen->post_type];

        // displayWhen rules: don't enqueue bundles on screens where the
        // rules block the panel from rendering. Saves a download +
        // prevents the sidebar panel from briefly flashing in.
        global $post;
        if (!empty($config['displayWhen']) && $post) {
            $ctx = \GCBLite\StructuredFields\RuleEngine::context_for_post($post);
            if (!\GCBLite\StructuredFields\RuleEngine::matches($config, $ctx)) {
                return;
            }
        }

        if (self::renders_in_sidebar($screen->post_type, $config)) {
            self::enqueue_sidebar_bundle($screen->post_type, $config);
        } else {
            AssetEnqueuer::enqueue();
        }
    }

    /**
     * Enqueue the block-editor sidebar bundle and pass it the CPT's
     * field config via wp_add_inline_script. The bundle reads
     * window.gcbLiteSidebar and registers a PluginDocumentSettingPanel.
     *
     * Unlike the meta-box bundle, the sidebar bundle depends on
     * @wordpress/edit-post / @wordpress/plugins so we can't share the
     * same compiled output. It's a small separate entry that imports
     * the same control library.
     */
    private static function enqueue_sidebar_bundle($post_type, array $config) {
        // wp.media still needed: image/gallery/file controls open the
        // media library from the sidebar.
        wp_enqueue_media();

        $build = GCBLITE_PLUGIN_DIR . 'build/sidebar-fields.js';
        $asset = GCBLITE_PLUGIN_DIR . 'build/sidebar-fields.asset.php';
        if (!file_exists($build) || !file_exists($asset)) {
            return;
        }
        $info = include $asset;

        wp_enqueue_script(
            'gcblite-sidebar-fields',
            GCBLITE_PLUGIN_URL . 'build/sidebar-fields.js',
            $info['dependencies'],
            $info['version'],
            true
        );

        $css = GCBLITE_PLUGIN_DIR . 'build/sidebar-fields.css';
        if (file_exists($css)) {
            wp_enqueue_style(
                'gcblite-sidebar-fields',
                GCBLITE_PLUGIN_URL . 'build/sidebar-fields.css',
                ['wp-components'],
                $info['version']
            );
        }

        wp_add_inline_script(
            'gcblite-sidebar-fields',
            'window.gcbLiteSidebar = ' . wp_json_encode([
                'postType' => $post_type,
                'config'   => $config,
                'panelTitle' => $config['panel_title'] ?? __('Fields', 'gcblite'),
            ]) . ';',
            'before'
        );
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
