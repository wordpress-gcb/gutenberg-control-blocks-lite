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
 * themself (or an editor with edit_users) can read /fields for a given
 * user.
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

        // Register each control as user-meta so it's REST-exposed on
        // the user object. Headless frontends can read meta via
        // /wp/v2/users/me?context=edit without hitting our dedicated
        // /fields route.
        foreach ($config['controls'] as $control) {
            $key  = $control['attributeKey'] ?? null;
            $type = $control['type'] ?? '';
            if (!is_string($key) || $key === '' || in_array($type, ['group', 'panel', 'tools-panel'], true)) {
                continue;
            }
            register_meta('user', $key, [
                'type'         => self::wp_meta_type_for_control($type),
                'single'       => true,
                'show_in_rest' => true,
            ]);
        }
    }

    public static function get_config() {
        return self::$config;
    }

    /**
     * Render the React mount-point on the user profile screen.
     * Fires on both show_user_profile (own profile) and
     * edit_user_profile (admin editing another user).
     */
    public static function render_panel($user) {
        if (!self::$config) return;
        if (!current_user_can('edit_user', $user->ID)) return;

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
     * Auth-gated: caller must be the user themself or hold edit_users.
     * Returns the resolved values for that user with declared defaults
     * filled in.
     */
    public static function register_rest_routes() {
        register_rest_route('gcblite/v1', '/users/(?P<user_id>\\d+)/fields', [
            'methods'  => 'GET',
            'permission_callback' => static function ($req) {
                $user_id = (int) $req->get_param('user_id');
                $current = get_current_user_id();
                if ($current === $user_id) return true;
                return current_user_can('edit_users');
            },
            'callback' => static function ($req) {
                if (!self::$config) {
                    return new \WP_Error('not_registered', 'No user fields registered', ['status' => 404]);
                }
                $user_id = (int) $req->get_param('user_id');
                $user = get_userdata($user_id);
                if (!$user) {
                    return new \WP_Error('not_found', 'User not found', ['status' => 404]);
                }
                return self::collect_current_values($user_id, self::$config['controls']);
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
