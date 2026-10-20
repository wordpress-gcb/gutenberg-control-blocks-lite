<?php
/**
 * User profile typed fields — wp_usermeta surface.
 *
 * Same `controls` config shape as PostFields\Registrar. Public entry
 * point in includes/User/helpers.php as `gcblite_register_user_fields($config)`.
 * Themes call it once; the fields appear on every user's profile page,
 * stored to wp_usermeta keyed by user ID.
 *
 *   gcblite_register_user_fields([
 *       'page_title' => 'Profile extras',
 *       'controls' => [
 *           ['type' => 'image',    'attributeKey' => 'avatar_alt', 'label' => 'Custom avatar'],
 *           ['type' => 'url',      'attributeKey' => 'website',    'label' => 'Personal site'],
 *           ['type' => 'textarea', 'attributeKey' => 'extended_bio', 'label' => 'Long bio'],
 *       ],
 *   ]);
 *
 * Unlike post-fields / options / taxonomy fields, user-meta is
 * privacy-relevant. The REST route is auth-gated: only the user
 * themself (or an editor with edit_users) can read every field for a
 * given user. Anyone else gets the fields marked `"public": true` and
 * nothing more (2026-10-20: public member profiles and member reviews
 * on marketplace sites):
 *
 *   ['type' => 'text', 'attributeKey' => 'role_title', 'label' => 'Role', 'public' => true],
 *
 * @package GCBLite\User
 */

namespace GCBLite\User;

use GCBLite\PostFields\AssetEnqueuer;
use GCBLite\PostFields\Conditional;
use GCBLite\PostFields\Sanitizer;
use GCBLite\PostFields\Validator;

if (!defined('ABSPATH')) {
    exit;
}

class Registrar {

    /** @var array|null single config (user-meta is one global surface) */
    private static $config = null;

    private const NONCE_ACTION = 'gcblite_user_fields_save';
    private const NONCE_NAME   = 'gcblite_user_fields_nonce';
    private const SUBMIT_FIELD = 'gcblite_user_fields_values';

    public static function init() {
        add_action('admin_enqueue_scripts',    [__CLASS__, 'enqueue']);
        add_action('show_user_profile',        [__CLASS__, 'render_panel']);
        add_action('edit_user_profile',        [__CLASS__, 'render_panel']);
        add_action('personal_options_update',  [__CLASS__, 'save']);
        add_action('edit_user_profile_update', [__CLASS__, 'save']);
        add_action('rest_api_init',            [__CLASS__, 'register_rest_routes']);
    }

    public static function register(array $config) {
        if (!isset($config['controls']) || !is_array($config['controls'])) {
            return;
        }
        $config = array_merge([
            'page_title' => __('Custom fields', 'gcblite'),
        ], $config);
        self::$config = $config;

        // Register each control as user-meta so WordPress knows its
        // type. Not shown in REST (2026-10-20): core prints registered
        // meta in the users endpoint's `view` context, which anyone
        // can read for a user with published posts, and core has no
        // read check per meta key; so every field went out to anyone.
        // Our /fields route is the one way to read them over REST: all
        // of them for the user or an editor, the public ones for
        // everyone else.
        foreach ($config['controls'] as $control) {
            $key  = $control['attributeKey'] ?? null;
            $type = $control['type'] ?? '';
            if (!is_string($key) || $key === '' || in_array($type, ['group', 'panel', 'tools-panel'], true)) {
                continue;
            }
            register_meta('user', $key, [
                'type'         => self::wp_meta_type_for_control($type),
                'single'       => true,
                'show_in_rest' => false,
            ]);
        }
    }

    public static function get_config() {
        return self::$config;
    }

    /**
     * Every field's value for a user, declared defaults filled in.
     * The server's read (gcblite_get_user_fields).
     */
    public static function get_values($user_id) {
        if (!self::$config) return [];
        return self::collect_current_values((int) $user_id, self::$config['controls']);
    }

    /**
     * The values anyone may read: get_values() for the controls marked
     * `"public": true`, and no other. The opposite way round from an
     * options page's `"private"`: a person's fields stay theirs unless
     * the theme says a field is for show (gcblite_get_public_user_fields).
     */
    public static function public_values($user_id) {
        if (!self::$config) return [];
        $public = array_values(array_filter(
            self::$config['controls'],
            static fn($control) => !empty($control['public'])
        ));
        return self::collect_current_values((int) $user_id, $public);
    }

    /**
     * May the current visitor read every field of this user? The user
     * themself, or someone with edit_users.
     */
    public static function can_read_all($user_id) {
        if (get_current_user_id() === (int) $user_id) return true;
        return current_user_can('edit_users');
    }

    /**
     * Render the React mount-point on the user profile screen.
     * Fires on both show_user_profile (own profile) and
     * edit_user_profile (admin editing another user).
     */
    public static function render_panel($user) {
        if (!self::$config) return;
        if (!current_user_can('edit_user', $user->ID)) return;

        // displayWhen rules — skip when they don't pass for this user.
        if (!empty(self::$config['displayWhen'])) {
            $ctx = \GCBLite\StructuredFields\RuleEngine::context_for_user($user->ID);
            if (!\GCBLite\StructuredFields\RuleEngine::matches(self::$config, $ctx)) {
                return;
            }
        }

        $values = self::collect_current_values($user->ID, self::$config['controls']);

        wp_nonce_field(self::NONCE_ACTION, self::NONCE_NAME);
        ?>
        <h2><?php echo esc_html(self::$config['page_title']); ?></h2>
        <div class="gcblite-user-fields-wrap">
            <div
                class="gcblite-post-fields-root"
                data-config="<?php echo esc_attr(wp_json_encode(self::$config)); ?>"
                data-values="<?php echo esc_attr(wp_json_encode((object) $values)); ?>"
            ></div>
            <input
                type="hidden"
                name="<?php echo esc_attr(self::SUBMIT_FIELD); ?>"
                class="gcblite-post-fields-submit"
                value="<?php echo esc_attr(wp_json_encode((object) $values)); ?>"
            />
        </div>
        <?php
    }

    public static function save($user_id) {
        if (!self::$config) return;
        if (!isset($_POST[self::NONCE_NAME])) return;
        if (!wp_verify_nonce(sanitize_key($_POST[self::NONCE_NAME]), self::NONCE_ACTION)) return;
        if (!current_user_can('edit_user', $user_id)) return;

        $raw = isset($_POST[self::SUBMIT_FIELD]) ? wp_unslash($_POST[self::SUBMIT_FIELD]) : '';
        $submitted = json_decode((string) $raw, true);
        if (!is_array($submitted)) {
            $submitted = [];
        }

        foreach (self::$config['controls'] as $control) {
            $key = $control['attributeKey'] ?? null;
            if (!is_string($key) || $key === '') continue;
            if (in_array($control['type'] ?? '', ['group', 'panel', 'tools-panel'], true)) continue;

            $value = Sanitizer::sanitize_one($control, $submitted[$key] ?? null);
            update_user_meta($user_id, $key, $value);
        }

        // Server-side validation — surface failures as an admin notice
        // via transient. User profile screens don't have a draft state,
        // so we persist regardless and let validation be informational.
        $is_visible = static fn($control) => Conditional::should_render($control, $submitted);
        $validation = Validator::validate_all(self::$config['controls'], $submitted, $is_visible);
        if (!$validation['ok']) {
            set_transient(
                'gcblite_user_fields_errors_' . $user_id,
                $validation['errors'],
                MINUTE_IN_SECONDS
            );
        }
    }

    /**
     * GET /wp-json/gcblite/v1/users/{user_id}/fields
     *
     * Returns the resolved values for that user with declared defaults
     * filled in: every field to the user themself or someone with
     * edit_users (can_read_all), the public ones (public_values) to
     * anyone else, an empty object when none is public. Public read
     * since 2026-10-20; the gate moved from permission_callback into
     * which values come back.
     */
    public static function register_rest_routes() {
        register_rest_route('gcblite/v1', '/users/(?P<user_id>\\d+)/fields', [
            'methods'  => 'GET',
            'permission_callback' => '__return_true',
            'callback' => static function ($req) {
                if (!self::$config) {
                    return new \WP_Error('not_registered', 'No user fields registered', ['status' => 404]);
                }
                $user_id = (int) $req->get_param('user_id');
                $user = get_userdata($user_id);
                if (!$user) {
                    return new \WP_Error('not_found', 'User not found', ['status' => 404]);
                }
                return (object) (self::can_read_all($user_id)
                    ? self::get_values($user_id)
                    : self::public_values($user_id));
            },
        ]);
    }

    public static function enqueue($hook) {
        // Only on the profile screens.
        if (!in_array($hook, ['profile.php', 'user-edit.php'], true)) return;
        if (!self::$config) return;
        AssetEnqueuer::enqueue();
    }

    private static function collect_current_values($user_id, array $controls) {
        $values = [];
        foreach ($controls as $control) {
            $key = $control['attributeKey'] ?? null;
            if (!is_string($key) || $key === '') continue;
            if (in_array($control['type'] ?? '', ['group', 'panel', 'tools-panel'], true)) continue;

            $stored = get_user_meta($user_id, $key, true);
            if ($stored === '' && array_key_exists('default', $control)) {
                $values[$key] = $control['default'];
            } else {
                $values[$key] = $stored;
            }
        }
        return $values;
    }

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
