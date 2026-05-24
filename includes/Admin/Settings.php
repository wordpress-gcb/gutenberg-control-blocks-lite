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
}
