<?php
/**
 * Single source of truth for the React frontend's URL.
 *
 * Resolution order (first match wins):
 *   1. GCBLITE_COMPONENT_SERVER_URL constant in wp-config.php.
 *      Filesystem-locked — site admins can pin the URL here and ignore
 *      any UI override. Security-conscious deployments should use this.
 *   2. `gcblite_frontend_url` PHP filter. Useful for env-specific overrides
 *      in code (e.g. mu-plugins that branch on WP_ENV).
 *   3. The `gcblite_frontend_url` option (set via Settings → GCB Lite).
 *      What the UI writes; available to admins with manage_options.
 *
 * Returns an empty string when nothing is configured. Callers must treat
 * that as "no React frontend" and skip the relevant feature (e.g. stop
 * enqueueing the editor stylesheets) rather than falling back to a
 * hardcoded default like localhost:3001 — that hardcoded fallback used
 * to bite hosted installs where wp-admin tried to fetch from localhost.
 *
 * @package GCBLite\Frontend
 */

namespace GCBLite\Frontend;

if (!defined('ABSPATH')) {
    exit;
}

class Url {

    const OPTION_NAME = 'gcblite_frontend_url';

    /**
     * Resolved frontend URL. Empty string = unconfigured.
     */
    public static function get() {
        if (defined('GCBLITE_COMPONENT_SERVER_URL') && is_string(GCBLITE_COMPONENT_SERVER_URL)) {
            return self::sanitize(GCBLITE_COMPONENT_SERVER_URL);
        }
        $filtered = apply_filters('gcblite_frontend_url', null);
        if (is_string($filtered) && $filtered !== '') {
            return self::sanitize($filtered);
        }
        $option = get_option(self::OPTION_NAME, '');
        return is_string($option) ? self::sanitize($option) : '';
    }

    /**
     * Whether the frontend is configured at all. Callers gate features on this.
     */
    public static function is_configured() {
        return self::get() !== '';
    }

    /**
     * Normalise the stored / configured URL. Strip trailing slash so callers
     * can safely append paths like "/wordpress/render/..." without doubling up.
     */
    public static function sanitize($url) {
        $url = trim((string) $url);
        if ($url === '') return '';
        // esc_url_raw rejects javascript:, mailto:, anything not http(s).
        $url = esc_url_raw($url);
        return rtrim($url, '/');
    }
}
