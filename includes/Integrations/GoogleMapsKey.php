<?php
/**
 * Single source of truth for the Google Maps JavaScript API key.
 *
 * Resolution order (first match wins):
 *   1. GCBLITE_GOOGLE_MAPS_API_KEY constant in wp-config.php.
 *      Filesystem-locked — site admins can pin the key here and ignore
 *      any UI override. Recommended for production: the key never lives
 *      in the database, never crosses an admin-screen permission boundary.
 *   2. `gcblite_google_maps_api_key` PHP filter. Useful for env-specific
 *      overrides in code (e.g. mu-plugins that branch on WP_ENV, or a
 *      vault integration).
 *      For backward-compatibility we also accept the legacy
 *      `gcb_google_maps_api_key` filter (old GCB plugin prefix) — any
 *      existing hooks keep working, but new integrations should use the
 *      `gcblite_` filter.
 *   3. The `gcblite_google_maps_api_key` option (set via
 *      Settings → GCB Lite). What the UI writes; available to admins
 *      with manage_options.
 *
 * Returns an empty string when nothing is configured. Callers must treat
 * that as "no Google Maps available" and gracefully degrade (e.g. the
 * google-map control falls back to a plain coordinates input rather than
 * loading the Maps JS SDK with no key).
 *
 * @package GCBLite\Integrations
 */

namespace GCBLite\Integrations;

if (!defined('ABSPATH')) {
    exit;
}

class GoogleMapsKey {

    const OPTION_NAME = 'gcblite_google_maps_api_key';

    /**
     * Resolved Google Maps API key. Empty string = unconfigured.
     */
    public static function get() {
        if (defined('GCBLITE_GOOGLE_MAPS_API_KEY') && is_string(GCBLITE_GOOGLE_MAPS_API_KEY)) {
            return self::sanitize(GCBLITE_GOOGLE_MAPS_API_KEY);
        }

        // New canonical filter first.
        $filtered = apply_filters('gcblite_google_maps_api_key', null);
        if (is_string($filtered) && $filtered !== '') {
            return self::sanitize($filtered);
        }

        // Legacy filter — kept for back-compat with any third-party hooks
        // written against the old GCB plugin. The empty-string default
        // matters here: existing call-sites in EditorAssets pass '' as
        // the second arg, so we don't want to short-circuit on the empty
        // default.
        $legacy = apply_filters('gcb_google_maps_api_key', '');
        if (is_string($legacy) && $legacy !== '') {
            return self::sanitize($legacy);
        }

        $option = get_option(self::OPTION_NAME, '');
        return is_string($option) ? self::sanitize($option) : '';
    }

    public static function is_configured() {
        return self::get() !== '';
    }

    /**
     * Whether the resolved value comes from code (constant or filter)
     * rather than the option. Settings UI uses this to lock the field.
     */
    public static function is_overridden() {
        return defined('GCBLITE_GOOGLE_MAPS_API_KEY')
            || has_filter('gcblite_google_maps_api_key')
            || has_filter('gcb_google_maps_api_key');
    }

    /**
     * API keys are opaque alphanumeric tokens — strip whitespace and any
     * stray characters that shouldn't appear in one. Don't try to validate
     * the format strictly: Google has rotated key shapes before, and a
     * "your key looks wrong" rejection in our UI would be worse than a
     * 403 from the Maps SDK.
     */
    public static function sanitize($key) {
        $key = trim((string) $key);
        if ($key === '') return '';
        // Allow alphanumerics, dash, underscore — covers every Google
        // API key format we've seen.
        return preg_replace('/[^A-Za-z0-9_\-]/', '', $key);
    }
}
