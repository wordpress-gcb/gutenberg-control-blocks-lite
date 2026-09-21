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

    /* ------------------------------------------------------------------ *
     *  ASKING FOR IT
     *
     *  Mark, 2026-09-21: "just get gcb to ask you for a key and ask you if
     *  it wants to help setting one up."
     *
     *  Everything above answers "what is the key?". Nothing asked for one.
     *  A `google-map` field with no key degrades to a coordinates box and a
     *  line of small print on a settings page nobody had a reason to open,
     *  so the control looked half-built when it was only unconfigured.
     * ------------------------------------------------------------------ */

    /** Where a key is made. */
    public static function console_url() {
        return 'https://console.cloud.google.com/google/maps-apis/credentials';
    }

    /**
     * Should we be asking for a key right now?
     *
     * Only when a map field is actually in use. A site with no map field is
     * not missing anything, and a notice it cannot act on is noise that
     * teaches people to dismiss our notices.
     *
     * @param bool $mapFieldInUse whether any registered field is a google-map
     */
    public static function needs_key($mapFieldInUse) {
        return (bool) $mapFieldInUse && ! self::is_configured();
    }

    /**
     * How to get one, in the order you do it.
     *
     * Deliberately the STEPS and not just a link: the two failure modes are
     * a key with the wrong APIs enabled (the control loads and silently does
     * nothing) and an unrestricted key on a live site (scraped and billed
     * within days). Both are one sentence to prevent and painful to debug.
     *
     * @return string[]
     */
    public static function setup_steps() {
        return array(
            __('Open the Google Cloud Console and pick a project (or make one).', 'gcblite'),
            __('Enable two APIs on it: Maps JavaScript API, and Places API.', 'gcblite'),
            __('Under Credentials, create an API key and copy it.', 'gcblite'),
            __('Restrict the key to your site\'s domains and to those two APIs — an unrestricted key can be used by anyone who finds it, and billed to you.', 'gcblite'),
            __('Paste it into GCB Lite → Settings, or define GCBLITE_GOOGLE_MAPS_API_KEY in wp-config.php so it never touches the database.', 'gcblite'),
        );
    }

    /**
     * Is any registered post-type field a map? The question needs_key() is
     * really asking, answered from the live registry so it costs nothing.
     */
    public static function map_field_registered() {
        if (! class_exists('\\GCBLite\\PostFields\\Registrar')
            || ! method_exists('\\GCBLite\\PostFields\\Registrar', 'get_registered')) {
            return false;
        }
        foreach ((array) \GCBLite\PostFields\Registrar::get_registered() as $config) {
            foreach ((array) ($config['controls'] ?? array()) as $c) {
                if (($c['type'] ?? '') === 'google-map') {
                    return true;
                }
            }
        }
        return false;
    }
}
