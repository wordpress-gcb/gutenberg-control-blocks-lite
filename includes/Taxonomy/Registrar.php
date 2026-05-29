<?php
/**
 * Taxonomy term-meta typed fields.
 *
 * Same `controls` config shape as PostFields\Registrar — register once
 * against a taxonomy slug, get a panel on the term edit screen
 * rendering those controls, values saved to wp_termmeta.
 *
 * Public entry point in includes/Taxonomy/helpers.php as
 * `gcblite_register_taxonomy_fields($taxonomy, $config)`. Themes call
 * it the same way they call `gcblite_register_post_fields`.
 *
 *   gcblite_register_taxonomy_fields('category', [
 *       'controls' => [
 *           ['type' => 'image', 'attributeKey' => 'cover', 'label' => 'Cover'],
 *           ['type' => 'color', 'attributeKey' => 'accent', 'label' => 'Accent'],
 *       ],
 *   ]);
 *
 * Stored: one row in wp_termmeta per control:
 *   meta_key   = attributeKey
 *   meta_value = (serialised PHP value)
 *
 * (Same shape as wp_postmeta to keep get_term_meta / update_term_meta
 * working naturally for downstream theme code.)
 *
 * REST exposure: GET /wp-json/gcblite/v1/terms/{taxonomy}/{term_id}/fields
 * returns the resolved values (defaults filled in for missing keys).
 * Public read — term meta isn't sensitive by default; if you put
 * secrets in a taxonomy field, don't.
 *
 * Note: WP only fires `{taxonomy}_edit_form` on EXISTING terms. The
 * Add-New-Term screen uses `{taxonomy}_add_form_fields`. We deliberately
 * skip add-form support for now: the React Inspector can't reliably
 * render before the term has an id (image controls need a media
 * library context tied to the term, conditional logic can read from
 * other meta, etc.). Authors add a term first, then fill the fields.
 *
 * @package GCBLite\Taxonomy
 */

namespace GCBLite\Taxonomy;

use GCBLite\PostFields\AssetEnqueuer;
use GCBLite\PostFields\Conditional;
use GCBLite\PostFields\Sanitizer;
use GCBLite\PostFields\Validator;

if (!defined('ABSPATH')) {
    exit;
}

class Registrar {

    /** @var array<string, array> taxonomy slug → config */
    private static $registry = [];

    private const NONCE_ACTION = 'gcblite_taxonomy_fields_save';
    private const NONCE_NAME   = 'gcblite_taxonomy_fields_nonce';
    private const SUBMIT_FIELD = 'gcblite_taxonomy_fields_values';

    public static function init() {
        add_action('admin_enqueue_scripts', [__CLASS__, 'enqueue']);
        add_action('rest_api_init',         [__CLASS__, 'register_rest_routes']);
        // Edit-form hooks + save hooks are registered lazily as taxonomies
        // are register()'d so each fires only for the taxonomies we care
        // about (avoids the cost of running on every edit-tags screen).
    }

    public static function register($taxonomy, array $config) {
        if (!is_string($taxonomy) || $taxonomy === '') {
            return;
        }
        if (!isset($config['controls']) || !is_array($config['controls'])) {
            return;
        }
        self::$registry[$taxonomy] = $config;

        // Hook into the term edit form for this specific taxonomy.
        add_action("{$taxonomy}_edit_form",      [__CLASS__, 'render_panel'], 10, 2);
        add_action("edited_{$taxonomy}",         [__CLASS__, 'save'],         10, 2);
        // Edited via REST (e.g. block editor's category sidebar) doesn't
        // fire {$taxonomy}_edit_form, but our values come from the same
        // SUBMIT_FIELD POST so the REST path is irrelevant here. If a
        // future feature needs REST-side save, hook 'updated_term_meta'.

        // Register the meta so it's REST-exposed on the taxonomy by
        // default (consumers can also use our dedicated /fields route).
        foreach ($config['controls'] as $control) {
            $key  = $control['attributeKey'] ?? null;
            $type = $control['type'] ?? '';
            if (!is_string($key) || $key === '' || in_array($type, ['group', 'panel', 'tools-panel'], true)) {
                continue;
            }
            register_term_meta($taxonomy, $key, [
                'type'         => self::wp_meta_type_for_control($type),
                'single'       => true,
                'show_in_rest' => true,
            ]);
        }
    }

    public static function get_registered() {
        return self::$registry;
    }

    /**
     * Render the React mount-point at the bottom of the term edit form.
     * WP passes the WP_Term and taxonomy slug; we read prior values from
     * term-meta to seed the React app's initial state.
     */
    public static function render_panel($term, $taxonomy) {
        $config = self::$registry[$taxonomy] ?? null;
        if (!$config) return;
        if (!current_user_can('edit_term', $term->term_id)) return;

        // displayWhen rules — skip if they don't pass for this term.
        if (!empty($config['displayWhen'])) {
            $ctx = \GCBLite\StructuredFields\RuleEngine::context_for_term($term, $taxonomy);
            if (!\GCBLite\StructuredFields\RuleEngine::matches($config, $ctx)) {
                return;
            }
        }

        $values = self::collect_current_values($term->term_id, $config['controls']);

        wp_nonce_field(self::NONCE_ACTION, self::NONCE_NAME);
        ?>
        <h2 class="gcblite-taxonomy-fields-title"><?php esc_html_e('Fields', 'gcblite'); ?></h2>
        <div
            class="gcblite-post-fields-root"
            data-config="<?php echo esc_attr(wp_json_encode($config)); ?>"
            data-values="<?php echo esc_attr(wp_json_encode((object) $values)); ?>"
        ></div>
        <input
            type="hidden"
            name="<?php echo esc_attr(self::SUBMIT_FIELD); ?>"
            class="gcblite-post-fields-submit"
            value="<?php echo esc_attr(wp_json_encode((object) $values)); ?>"
        />
        <?php
    }

    public static function save($term_id, $tt_id) {
        if (!isset($_POST[self::NONCE_NAME])) {
            return;
        }
        if (!wp_verify_nonce(sanitize_key($_POST[self::NONCE_NAME]), self::NONCE_ACTION)) {
            return;
        }
        if (!current_user_can('edit_term', $term_id)) {
            return;
        }

        $term = get_term($term_id);
        if (!$term || is_wp_error($term)) {
            return;
        }
        $config = self::$registry[$term->taxonomy] ?? null;
        if (!$config) {
            return;
        }

        $raw = isset($_POST[self::SUBMIT_FIELD]) ? wp_unslash($_POST[self::SUBMIT_FIELD]) : '';
        $submitted = json_decode((string) $raw, true);
        if (!is_array($submitted)) {
            $submitted = [];
        }

        // Persist first — author input is sacred even if validation later
        // fails. Validation surfaces as an admin notice; we don't have a
        // draft state for terms so there's nowhere to demote to.
        foreach ($config['controls'] as $control) {
            $key = $control['attributeKey'] ?? null;
            if (!is_string($key) || $key === '') continue;
            if (in_array($control['type'] ?? '', ['group', 'panel', 'tools-panel'], true)) continue;

            $value = Sanitizer::sanitize_one($control, $submitted[$key] ?? null);
            update_term_meta($term_id, $key, $value);
        }

        // Server-side validation. Same mirror logic as PostFields.
        $is_visible = static fn($control) => Conditional::should_render($control, $submitted);
        $validation = Validator::validate_all($config['controls'], $submitted, $is_visible);
        if (!$validation['ok']) {
            set_transient(
                'gcblite_taxonomy_fields_errors_' . $term_id,
                $validation['errors'],
                MINUTE_IN_SECONDS
            );
        }
    }

    /**
     * GET /wp-json/gcblite/v1/terms/{taxonomy}/{term_id}/fields
     *
     * Headless-friendly read: returns the resolved values for the term,
     * with declared defaults filling any missing keys.
     */
    public static function register_rest_routes() {
        register_rest_route('gcblite/v1', '/terms/(?P<taxonomy>[a-zA-Z0-9_-]+)/(?P<term_id>\\d+)/fields', [
            'methods'             => 'GET',
            'permission_callback' => '__return_true',
            'callback'            => static function ($req) {
                $taxonomy = $req->get_param('taxonomy');
                $term_id  = (int) $req->get_param('term_id');
                if (!isset(self::$registry[$taxonomy])) {
                    return new \WP_Error('not_found', 'Taxonomy not registered', ['status' => 404]);
                }
                $term = get_term($term_id, $taxonomy);
                if (!$term || is_wp_error($term)) {
                    return new \WP_Error('not_found', 'Term not found', ['status' => 404]);
                }
                return self::collect_current_values($term_id, self::$registry[$taxonomy]['controls']);
            },
        ]);
    }

    public static function enqueue($hook) {
        // Only on the term-edit screen for a registered taxonomy.
        if ($hook !== 'term.php') return;
        $screen = function_exists('get_current_screen') ? get_current_screen() : null;
        if (!$screen || !isset(self::$registry[$screen->taxonomy])) return;
        AssetEnqueuer::enqueue();
    }

    private static function collect_current_values($term_id, array $controls) {
        $values = [];
        foreach ($controls as $control) {
            $key = $control['attributeKey'] ?? null;
            if (!is_string($key) || $key === '') continue;
            if (in_array($control['type'] ?? '', ['group', 'panel', 'tools-panel'], true)) continue;

            $stored = get_term_meta($term_id, $key, true);
            if ($stored === '' && array_key_exists('default', $control)) {
                $values[$key] = $control['default'];
            } else {
                $values[$key] = $stored;
            }
        }
        return $values;
    }

    /**
     * Map gcb-lite control type → WP register_term_meta `type`. Anything
     * non-scalar (image, gallery, repeater, post-object, …) gets stored
     * as 'object' so WP doesn't serialise it through string coercion.
     */
    private static function wp_meta_type_for_control($type) {
        switch ($type) {
            case 'text':
            case 'textarea':
            case 'email':
            case 'code':
            case 'select':
            case 'radio':
            case 'date':
            case 'datetime':
            case 'color':
            case 'icon':
            case 'wysiwyg':
            case 'richtext':
                return 'string';
            case 'number':
            case 'range':
                return 'number';
            case 'checkbox':
            case 'toggle':
                return 'boolean';
            default:
                return 'object';
        }
    }
}
