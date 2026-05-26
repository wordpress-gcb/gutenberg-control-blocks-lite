<?php
/**
 * Options-page typed fields.
 *
 * Same `controls` config shape as PostFields\Registrar — register once,
 * get an admin page rendering those controls, values saved to wp_options.
 *
 * Public entry-point lives in includes/Options/helpers.php as
 * `gcblite_register_options_fields($slug, $config)`. Themes call it the
 * same way they call `gcblite_register_post_fields`.
 *
 *   gcblite_register_options_fields('site_settings', [
 *       'page_title'  => 'Site settings',          // <title> + heading
 *       'menu_title'  => 'Site settings',          // sidebar entry
 *       'capability'  => 'manage_options',         // default
 *       'parent'      => null,                      // top-level menu (default)
 *                                                   // OR 'options-general.php' / 'themes.php' / etc.
 *       'icon'        => 'dashicons-admin-generic', // top-level only
 *       'position'    => null,                     // menu position
 *       'controls'    => [ ...gcblite controls... ],
 *   ]);
 *
 * Stored under a single option per slug, JSON-encoded:
 *   option_name  = "gcblite_options_{slug}"
 *   option_value = { attributeKey: value, ... }
 *
 * Reads via REST at /wp-json/gcblite/v1/options/{slug} so headless
 * frontends can pull options the same way they pull post meta.
 *
 * @package GCBLite\Options
 */

namespace GCBLite\Options;

use GCBLite\PostFields\Conditional;
use GCBLite\PostFields\Sanitizer;
use GCBLite\PostFields\Validator;

if (!defined('ABSPATH')) {
    exit;
}

class Registrar {

    /** @var array<string, array> slug → config */
    private static $registry = [];

    private const NONCE_ACTION = 'gcblite_options_save';
    private const NONCE_NAME   = 'gcblite_options_nonce';
    private const SUBMIT_FIELD = 'gcblite_options_values';

    public static function init() {
        add_action('admin_menu',          [__CLASS__, 'add_menu_pages']);
        add_action('admin_post_gcblite_save_options', [__CLASS__, 'handle_save']);
        add_action('admin_enqueue_scripts', [__CLASS__, 'enqueue']);
        add_action('rest_api_init',       [__CLASS__, 'register_rest_routes']);
    }

    /**
     * Theme/plugin entry-point. Registers a page; the menu entry,
     * render handler, save handler, and REST route get wired
     * automatically on init.
     */
    public static function register($slug, array $config) {
        if (!is_string($slug) || $slug === '') {
            return;
        }
        if (!isset($config['controls']) || !is_array($config['controls'])) {
            return;
        }
        // Sensible defaults so callers only need to specify the title +
        // controls in the common case.
        $config = array_merge([
            'page_title' => ucwords(str_replace(['_', '-'], ' ', $slug)),
            'menu_title' => ucwords(str_replace(['_', '-'], ' ', $slug)),
            'capability' => 'manage_options',
            'parent'     => null,
            'icon'       => 'dashicons-admin-generic',
            'position'   => null,
        ], $config);

        self::$registry[$slug] = $config;
    }

    public static function get_registered() {
        return self::$registry;
    }

    /**
     * Add menu entry per registered page. Two cases:
     *  - 'parent' null → top-level menu (add_menu_page)
     *  - 'parent' set → submenu under that page (add_submenu_page)
     */
    public static function add_menu_pages() {
        foreach (self::$registry as $slug => $config) {
            $menu_slug = self::menu_slug($slug);
            $render    = function () use ($slug) { self::render_page($slug); };

            if (empty($config['parent'])) {
                add_menu_page(
                    $config['page_title'],
                    $config['menu_title'],
                    $config['capability'],
                    $menu_slug,
                    $render,
                    $config['icon'],
                    $config['position']
                );
            } else {
                add_submenu_page(
                    $config['parent'],
                    $config['page_title'],
                    $config['menu_title'],
                    $config['capability'],
                    $menu_slug,
                    $render
                );
            }
        }
    }

    /**
     * Render the admin page for one registered options slug.
     *
     * Emits the same `.gcblite-post-fields-root` element the post-meta
     * box uses. The same React bundle mounts on either, so options
     * pages and CPT fields share one Inspector codebase.
     */
    public static function render_page($slug) {
        $config = self::$registry[$slug] ?? null;
        if (!$config) return;
        if (!current_user_can($config['capability'])) return;

        $values = self::get_values($slug);

        // Saved-success notice.
        if (isset($_GET['updated']) && $_GET['updated'] === '1') {
            echo '<div class="notice notice-success is-dismissible"><p>'
                . esc_html__('Settings saved.', 'gcblite')
                . '</p></div>';
        }
        ?>
        <div class="wrap">
            <h1><?php echo esc_html($config['page_title']); ?></h1>
            <form action="<?php echo esc_url(admin_url('admin-post.php')); ?>" method="post">
                <input type="hidden" name="action" value="gcblite_save_options" />
                <input type="hidden" name="gcblite_options_slug" value="<?php echo esc_attr($slug); ?>" />
                <?php wp_nonce_field(self::NONCE_ACTION, self::NONCE_NAME); ?>

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

                <?php submit_button(__('Save settings', 'gcblite')); ?>
            </form>
        </div>
        <?php
    }

    /**
     * Handle the form POST. Saves values to a single option per slug,
     * then redirects back to the page with ?updated=1.
     */
    public static function handle_save() {
        $slug = isset($_POST['gcblite_options_slug'])
            ? sanitize_key(wp_unslash($_POST['gcblite_options_slug']))
            : '';
        $config = self::$registry[$slug] ?? null;
        if (!$config) {
            wp_die('Unknown options slug.');
        }
        if (!current_user_can($config['capability'])) {
            wp_die('Insufficient permissions.');
        }
        if (!isset($_POST[self::NONCE_NAME]) ||
            !wp_verify_nonce(sanitize_key($_POST[self::NONCE_NAME]), self::NONCE_ACTION)) {
            wp_die('Invalid nonce.');
        }

        $raw = isset($_POST[self::SUBMIT_FIELD])
            ? wp_unslash($_POST[self::SUBMIT_FIELD])
            : '';
        $submitted = json_decode((string) $raw, true);
        if (!is_array($submitted)) {
            $submitted = [];
        }

        // Validate server-side (mirrors the client-side check).
        $is_visible = static fn($control) => Conditional::should_render($control, $submitted);
        $validation = Validator::validate_all($config['controls'], $submitted, $is_visible);

        if (!$validation['ok']) {
            // Stash for the next page render. Options pages aren't draftable,
            // so we just reject the save entirely on validation failure.
            set_transient(
                'gcblite_options_errors_' . $slug,
                $validation['errors'],
                MINUTE_IN_SECONDS
            );
            wp_safe_redirect(add_query_arg('error', '1', wp_get_referer()));
            exit;
        }

        // Persist. One option per slug, JSON-shaped { attributeKey: value, ... }.
        $clean = [];
        foreach ($config['controls'] as $control) {
            $key = $control['attributeKey'] ?? null;
            if (!is_string($key) || $key === '') continue;
            if (in_array($control['type'] ?? '', ['group', 'panel', 'tools-panel'], true)) continue;

            $clean[$key] = Sanitizer::sanitize_one($control, $submitted[$key] ?? null);
        }
        update_option('gcblite_options_' . $slug, $clean);

        wp_safe_redirect(add_query_arg('updated', '1', wp_get_referer()));
        exit;
    }

    /**
     * Public read API. Use from PHP themes/plugins. The matching REST
     * route below exposes the same data to headless frontends.
     */
    public static function get_values($slug) {
        $stored = get_option('gcblite_options_' . $slug, []);
        if (!is_array($stored)) $stored = [];

        $config = self::$registry[$slug] ?? null;
        if (!$config) return $stored;

        // Fill in declared defaults for any missing keys, so callers
        // don't need to defensively handle every field on every read.
        foreach ($config['controls'] as $control) {
            $key = $control['attributeKey'] ?? null;
            if (!is_string($key) || $key === '') continue;
            if (!array_key_exists($key, $stored) && array_key_exists('default', $control)) {
                $stored[$key] = $control['default'];
            }
        }
        return $stored;
    }

    /**
     * GET /wp-json/gcblite/v1/options/{slug}
     *
     * Returns the resolved values (stored values + declared defaults
     * for any missing keys). Public read — capability check at register
     * time would unhelpfully gate frontends. If you've got secrets in
     * an options page, don't expose them via the REST API.
     */
    public static function register_rest_routes() {
        register_rest_route('gcblite/v1', '/options/(?P<slug>[a-zA-Z0-9_-]+)', [
            'methods'  => 'GET',
            'permission_callback' => '__return_true',
            'callback' => static function ($req) {
                $slug = $req->get_param('slug');
                if (!isset(self::$registry[$slug])) {
                    return new \WP_Error('not_found', 'Options page not registered', ['status' => 404]);
                }
                return self::get_values($slug);
            },
        ]);
    }

    /**
     * Enqueue the post-fields JS bundle on registered options pages so
     * the React Inspector mounts on .gcblite-post-fields-root.
     *
     * Uses the same bundle the post-meta box uses; the React entry
     * doesn't care whether it's mounted on a CPT edit screen or our
     * options page — it reads config + values from data-* attrs and
     * writes back to the hidden submit field.
     */
    public static function enqueue($hook) {
        if (!self::is_options_page_hook($hook)) {
            return;
        }
        wp_enqueue_media();
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

    /**
     * Is the current admin page hook one of our registered options pages?
     * WP doesn't give us a single clean check — we have to match the hook
     * suffix against the menu slugs we own.
     */
    private static function is_options_page_hook($hook) {
        foreach (self::$registry as $slug => $config) {
            $menu_slug = self::menu_slug($slug);
            // Hooks: 'toplevel_page_{menu_slug}' for add_menu_page;
            // '{parent_base}_page_{menu_slug}' for add_submenu_page.
            if (
                $hook === 'toplevel_page_' . $menu_slug ||
                str_ends_with($hook, '_page_' . $menu_slug)
            ) {
                return true;
            }
        }
        return false;
    }

    private static function menu_slug($slug) {
        return 'gcblite-options-' . $slug;
    }
}
