<?php
/**
 * Settings → GCB Lite admin page.
 *
 * One option: gcblite_frontend_url. The URL of the React frontend (Next.js,
 * Astro, etc.) the plugin SSR-fetches block HTML from. Leaving it blank
 * disables every React-rendering code path — the plugin still works for
 * blocks that have a render.php.
 *
 * Precedence is documented inline so admins reading the help text know
 * that a wp-config constant overrides the field below.
 *
 * @package GCBLite\Admin
 */

namespace GCBLite\Admin;

use GCBLite\Frontend\Url;
use GCBLite\Integrations\GoogleMapsKey;

if (!defined('ABSPATH')) {
    exit;
}

class Settings {

    const PAGE_SLUG    = 'gcblite';
    const OPTION_GROUP = 'gcblite_settings';

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'register_page']);
        add_action('admin_init', [__CLASS__, 'register_setting']);
    }

    public static function register_page() {
        add_options_page(
            __('GCB Lite', 'gcblite'),
            __('GCB Lite', 'gcblite'),
            'manage_options',
            self::PAGE_SLUG,
            [__CLASS__, 'render_page']
        );
    }

    public static function register_setting() {
        register_setting(self::OPTION_GROUP, Url::OPTION_NAME, [
            'type'              => 'string',
            'sanitize_callback' => [Url::class, 'sanitize'],
            'default'           => '',
            'show_in_rest'      => false,
        ]);

        register_setting(self::OPTION_GROUP, GoogleMapsKey::OPTION_NAME, [
            'type'              => 'string',
            'sanitize_callback' => [GoogleMapsKey::class, 'sanitize'],
            'default'           => '',
            // Keep API keys out of the REST API. Admins-only via wp-admin.
            'show_in_rest'      => false,
        ]);

        register_setting(self::OPTION_GROUP, 'gcblite_disable_render_cache', [
            'type'              => 'boolean',
            'sanitize_callback' => static function ($v) { return !empty($v); },
            'default'           => false,
            'show_in_rest'      => false,
        ]);

        // Shared secret for outbound render calls. The frontend's
        // /wordpress/render/* route checks for the x-gcblite-render-secret
        // header (matching its RENDER_SECRET env). Without this, the
        // frontend has no way to refuse direct hits from anyone who
        // discovers the URL. See Frontend\Secret for the resolution
        // order; the field below feeds the option tier.
        register_setting(self::OPTION_GROUP, \GCBLite\Frontend\Secret::OPTION_NAME, [
            'type'              => 'string',
            'sanitize_callback' => [\GCBLite\Frontend\Secret::class, 'sanitize'],
            'default'           => '',
            'show_in_rest'      => false,
        ]);

        // Cache revalidation — POST to the frontend's /api/revalidate on
        // save_post so the headless page cache updates immediately
        // instead of after the 30s revalidate window. Off by default; the
        // toggle below is what flips it on, the URL + secret only do
        // anything when it's on.
        register_setting(self::OPTION_GROUP, 'gcblite_revalidate_enabled', [
            'type'              => 'boolean',
            'sanitize_callback' => static function ($v) { return !empty($v); },
            'default'           => false,
            'show_in_rest'      => false,
        ]);

        register_setting(self::OPTION_GROUP, 'gcblite_revalidate_url', [
            'type'              => 'string',
            'sanitize_callback' => static function ($v) {
                $v = is_string($v) ? trim($v) : '';
                return $v === '' ? '' : esc_url_raw($v);
            },
            'default'           => '',
            'show_in_rest'      => false,
        ]);

        register_setting(self::OPTION_GROUP, 'gcblite_revalidate_secret', [
            'type'              => 'string',
            'sanitize_callback' => static function ($v) {
                return is_string($v) ? trim($v) : '';
            },
            'default'           => '',
            'show_in_rest'      => false,
        ]);

        add_settings_section(
            'gcblite_frontend',
            __('React frontend', 'gcblite'),
            [__CLASS__, 'render_section_intro'],
            self::PAGE_SLUG
        );

        add_settings_field(
            'gcblite_frontend_url',
            __('Frontend URL', 'gcblite'),
            [__CLASS__, 'render_url_field'],
            self::PAGE_SLUG,
            'gcblite_frontend'
        );

        add_settings_field(
            'gcblite_render_secret',
            __('Render auth secret', 'gcblite'),
            [__CLASS__, 'render_secret_field'],
            self::PAGE_SLUG,
            'gcblite_frontend'
        );

        add_settings_field(
            'gcblite_disable_render_cache',
            __('Disable render cache', 'gcblite'),
            [__CLASS__, 'render_disable_cache_field'],
            self::PAGE_SLUG,
            'gcblite_frontend'
        );

        add_settings_field(
            'gcblite_revalidate_enabled',
            __('On-save revalidation', 'gcblite'),
            [__CLASS__, 'render_revalidate_fields'],
            self::PAGE_SLUG,
            'gcblite_frontend'
        );

        add_settings_section(
            'gcblite_integrations',
            __('Integrations', 'gcblite'),
            [__CLASS__, 'render_integrations_intro'],
            self::PAGE_SLUG
        );

        add_settings_field(
            'gcblite_google_maps_api_key',
            __('Google Maps API key', 'gcblite'),
            [__CLASS__, 'render_google_maps_key_field'],
            self::PAGE_SLUG,
            'gcblite_integrations'
        );
    }

    public static function render_integrations_intro() {
        echo '<p>' . esc_html__(
            'Third-party API keys used by certain controls. Leave blank to disable those controls (e.g. the google-map field falls back to a plain coordinates input).',
            'gcblite'
        ) . '</p>';
    }

    public static function render_google_maps_key_field() {
        $stored        = get_option(GoogleMapsKey::OPTION_NAME, '');
        $resolved      = GoogleMapsKey::get();
        $is_overridden = GoogleMapsKey::is_overridden();
        ?>
        <input
            type="text"
            id="gcblite_google_maps_api_key"
            name="<?php echo esc_attr(GoogleMapsKey::OPTION_NAME); ?>"
            value="<?php echo esc_attr($stored); ?>"
            class="regular-text code"
            placeholder="AIzaSy..."
            autocomplete="off"
            <?php disabled($is_overridden); ?>
        />
        <p class="description">
            <?php
            printf(
                wp_kses(
                    /* translators: %s = link to Google Cloud Console docs */
                    __('Required by the google-map control. Create one in the %s with Maps JavaScript API + Places API enabled, then restrict it to your domain.', 'gcblite'),
                    ['a' => ['href' => [], 'target' => [], 'rel' => []]]
                ),
                '<a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener noreferrer">Google Cloud Console</a>'
            );
            ?>
        </p>
        <?php if ($is_overridden) : ?>
            <p class="description" style="color:#b32d2e;">
                <strong><?php esc_html_e('Overridden in code.', 'gcblite'); ?></strong>
                <?php
                $masked = $resolved !== '' ? str_repeat('•', max(0, strlen($resolved) - 4)) . substr($resolved, -4) : '(empty)';
                printf(
                    /* translators: %s = masked key showing only last 4 chars */
                    esc_html__('A wp-config constant or filter is in use, so this field is read-only. Currently resolved: %s', 'gcblite'),
                    '<code>' . esc_html($masked) . '</code>'
                );
                ?>
            </p>
        <?php endif; ?>
        <p class="description">
            <?php esc_html_e('Resolution order: GCBLITE_GOOGLE_MAPS_API_KEY constant in wp-config.php → gcblite_google_maps_api_key filter → this field. Putting the key in wp-config.php is recommended so it never lives in the database.', 'gcblite'); ?>
        </p>
        <?php
    }

    public static function render_section_intro() {
        echo '<p>' . esc_html__(
            "Where the plugin should fetch React-rendered block HTML from. " .
            "Required only for blocks that don't have a render.php in your theme — " .
            "PHP-rendered blocks work without any setting here.",
            'gcblite'
        ) . '</p>';
    }

    public static function render_url_field() {
        $stored        = get_option(Url::OPTION_NAME, '');
        $resolved      = Url::get();
        $is_overridden = defined('GCBLITE_COMPONENT_SERVER_URL') || has_filter('gcblite_frontend_url');
        ?>
        <input
            type="url"
            id="gcblite_frontend_url"
            name="<?php echo esc_attr(Url::OPTION_NAME); ?>"
            value="<?php echo esc_attr($stored); ?>"
            class="regular-text code"
            placeholder="https://your-frontend.example.com"
            <?php disabled($is_overridden); ?>
        />
        <p class="description">
            <?php esc_html_e('e.g. https://gcb-next-starter.vercel.app — the URL the plugin will server-to-server fetch from. No trailing slash.', 'gcblite'); ?>
        </p>
        <?php if ($is_overridden) : ?>
            <p class="description" style="color:#b32d2e;">
                <strong><?php esc_html_e('Overridden in code.', 'gcblite'); ?></strong>
                <?php
                printf(
                    /* translators: %s = the URL currently in use */
                    esc_html__('A wp-config constant or filter is in use, so this field is read-only. Currently resolved: %s', 'gcblite'),
                    '<code>' . esc_html($resolved ?: '(empty)') . '</code>'
                );
                ?>
            </p>
        <?php endif; ?>
        <p class="description">
            <?php esc_html_e('Resolution order: GCBLITE_COMPONENT_SERVER_URL constant in wp-config.php → gcblite_frontend_url filter → this field.', 'gcblite'); ?>
        </p>
        <?php
    }

    public static function render_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            <form action="options.php" method="post">
                <?php
                settings_fields(self::OPTION_GROUP);
                do_settings_sections(self::PAGE_SLUG);
                submit_button();
                ?>
            </form>
        </div>
        <?php
    }

    /**
     * Render the "Disable render cache" checkbox.
     *
     * Reads gcblite_disable_render_cache. RenderAPI::cache_disabled()
     * also honours WP_DEBUG and ?gcblite_no_cache=1; this is the
     * site-wide permanent toggle for environments that want to bypass
     * cache without running WP_DEBUG (e.g. staging where you're
     * actively iterating on the component server).
     */
    public static function render_secret_field() {
        $stored        = (string) get_option(\GCBLite\Frontend\Secret::OPTION_NAME, '');
        $is_overridden = defined('GCBLITE_RENDER_SECRET') || has_filter('gcblite_render_secret');
        $resolved      = \GCBLite\Frontend\Secret::get();
        $masked        = $resolved !== ''
            ? str_repeat('•', max(0, strlen($resolved) - 4)) . substr($resolved, -4)
            : '';
        ?>
        <input
            type="text"
            id="gcblite_render_secret"
            name="<?php echo esc_attr(\GCBLite\Frontend\Secret::OPTION_NAME); ?>"
            value="<?php echo esc_attr($stored); ?>"
            class="regular-text code"
            placeholder="paste-a-random-string-here"
            autocomplete="off"
            <?php disabled($is_overridden); ?>
        />
        <button
            type="button"
            class="button"
            <?php disabled($is_overridden); ?>
            onclick="(function(){var f=document.getElementById('gcblite_render_secret');var a=new Uint8Array(20);window.crypto.getRandomValues(a);f.value=Array.from(a).map(function(b){return b.toString(16).padStart(2,'0');}).join('');})()"
        ><?php esc_html_e('Generate', 'gcblite'); ?></button>
        <p class="description">
            <?php esc_html_e('Sent as x-gcblite-render-secret on every outbound /wordpress/render/* call. The frontend must set RENDER_SECRET in its env to the same value and refuse calls without (or with a mismatched) header. Without this, anyone on the public internet who finds the frontend URL can hit /wordpress/render/* directly and burn your render compute.', 'gcblite'); ?>
            <br />
            <?php esc_html_e('Resolution order: GCBLITE_RENDER_SECRET constant in wp-config.php → gcblite_render_secret filter → this field. Click Generate for a fresh value; save and copy to the frontend.', 'gcblite'); ?>
        </p>
        <?php if ($is_overridden) : ?>
            <p class="description" style="color:#b32d2e;">
                <strong><?php esc_html_e('Overridden in code.', 'gcblite'); ?></strong>
                <?php printf(esc_html__('Currently resolved: %s', 'gcblite'), '<code>' . esc_html($masked) . '</code>'); ?>
            </p>
        <?php endif; ?>
        <?php
    }

    public static function render_disable_cache_field() {
        $stored = (bool) get_option('gcblite_disable_render_cache', false);
        $wp_debug_on = defined('WP_DEBUG') && WP_DEBUG;
        ?>
        <label>
            <input
                type="checkbox"
                name="gcblite_disable_render_cache"
                value="1"
                <?php checked($stored); ?>
                <?php disabled($wp_debug_on); ?>
            />
            <?php esc_html_e('Bypass the component-server render cache on every request.', 'gcblite'); ?>
        </label>
        <p class="description">
            <?php if ($wp_debug_on) : ?>
                <strong><?php esc_html_e('WP_DEBUG is on — cache is already disabled at the constant level.', 'gcblite'); ?></strong><br />
            <?php endif; ?>
            <?php esc_html_e('Cache disabling has three triggers (any one bypasses): WP_DEBUG constant, ?gcblite_no_cache=1 on the URL (admins only, per-request), and this checkbox (site-wide).', 'gcblite'); ?>
            <?php esc_html_e('The save_post hook still writes to the cache regardless — this only affects READS.', 'gcblite'); ?>
        </p>
        <?php
    }

    /**
     * Three controls in one field row: master toggle, URL, secret.
     * Off by default. The toggle is what gates the POST — leaving the
     * URL or secret blank gives a stable "off" state without throwing
     * during save.
     */
    public static function render_revalidate_fields() {
        $enabled = (bool) get_option('gcblite_revalidate_enabled', false);
        $url     = (string) get_option('gcblite_revalidate_url', '');
        $secret  = (string) get_option('gcblite_revalidate_secret', '');
        $secret_display = $secret !== ''
            ? str_repeat('•', max(0, strlen($secret) - 4)) . substr($secret, -4)
            : '';
        ?>
        <fieldset>
            <label style="display:block;margin-bottom:8px;">
                <input
                    type="checkbox"
                    name="gcblite_revalidate_enabled"
                    value="1"
                    <?php checked($enabled); ?>
                />
                <?php esc_html_e('POST to the frontend on every save_post to bust its page cache.', 'gcblite'); ?>
            </label>
            <p class="description" style="margin-top:0;">
                <?php esc_html_e('When on: every published-post save fires a fire-and-forget HTTP request to the URL below with the affected paths. The frontend\'s /api/revalidate route drops its cached server output so authors see edits within ~1 second instead of waiting for the 30s revalidate window.', 'gcblite'); ?>
            </p>

            <table class="form-table" style="margin-top:12px;" role="presentation">
                <tr>
                    <th scope="row" style="padding-left:0;width:140px;">
                        <label for="gcblite_revalidate_url"><?php esc_html_e('Endpoint', 'gcblite'); ?></label>
                    </th>
                    <td style="padding-left:0;">
                        <input
                            type="url"
                            id="gcblite_revalidate_url"
                            name="gcblite_revalidate_url"
                            value="<?php echo esc_attr($url); ?>"
                            class="regular-text code"
                            placeholder="http://localhost:3001/api/revalidate"
                            autocomplete="off"
                        />
                        <p class="description">
                            <?php esc_html_e('Where to POST. Usually the frontend root + /api/revalidate.', 'gcblite'); ?>
                        </p>
                    </td>
                </tr>
                <tr>
                    <th scope="row" style="padding-left:0;">
                        <label for="gcblite_revalidate_secret"><?php esc_html_e('Shared secret', 'gcblite'); ?></label>
                    </th>
                    <td style="padding-left:0;">
                        <input
                            type="text"
                            id="gcblite_revalidate_secret"
                            name="gcblite_revalidate_secret"
                            value="<?php echo esc_attr($secret); ?>"
                            class="regular-text code"
                            placeholder="<?php echo esc_attr($secret_display ?: 'paste-a-random-string-here'); ?>"
                            autocomplete="off"
                        />
                        <button
                            type="button"
                            class="button"
                            onclick="(function(){var f=document.getElementById('gcblite_revalidate_secret');var a=new Uint8Array(20);window.crypto.getRandomValues(a);f.value=Array.from(a).map(function(b){return b.toString(16).padStart(2,'0');}).join('');})()"
                        ><?php esc_html_e('Generate', 'gcblite'); ?></button>
                        <p class="description">
                            <?php esc_html_e('Must match REVALIDATE_SECRET in the frontend\'s .env.local (and on Vercel, the same env var on the project). Sent as the x-gcblite-revalidate-secret header on every POST. Click Generate for a fresh value; save and copy it to the frontend.', 'gcblite'); ?>
                        </p>
                    </td>
                </tr>
            </table>
        </fieldset>
        <?php
    }
}
