<?php
/**
 * Shared-secret between WordPress and the configured React frontend.
 *
 * Sent on every outbound /wordpress/render/* call so the frontend can
 * reject requests that didn't come from a paired WP install. Closes two
 * gaps that the unauthenticated render pipeline otherwise leaves open:
 *
 *   1. Without auth, anyone on the public internet can hit your
 *      frontend's /wordpress/render/{slug} route directly with
 *      arbitrary attrs. That's a denial-of-service surface even though
 *      no information leaks — they can burn your render compute.
 *   2. Without auth, an attacker who finds your WP plugin's
 *      /gcblite/v1/render-batch endpoint can make YOUR WP origin POST
 *      to YOUR frontend with whatever attrs they like. Outbound-request
 *      amplification.
 *
 * Both go away if the frontend rejects calls whose
 * x-gcblite-render-secret header doesn't match its own RENDER_SECRET
 * env var.
 *
 * Resolution order (first match wins) — mirrors Frontend\Url:
 *   1. GCBLITE_RENDER_SECRET constant (wp-config.php). Production
 *      should pin here.
 *   2. `gcblite_render_secret` PHP filter. mu-plugin / env-branching.
 *   3. `gcblite_render_secret` option (Settings → GCB Lite).
 *
 * Empty string = no secret configured. Behaviour when empty is
 * caller's choice — RenderAPI sends no header, the frontend can be
 * configured (via its own env) to allow or reject the unauthenticated
 * case.
 *
 * @package GCBLite\Frontend
 */

namespace GCBLite\Frontend;

if (!defined('ABSPATH')) {
    exit;
}

class Secret {

    const OPTION_NAME = 'gcblite_render_secret';
    const HEADER_NAME = 'x-gcblite-render-secret';

    public static function get() {
        if (defined('GCBLITE_RENDER_SECRET') && is_string(GCBLITE_RENDER_SECRET) && GCBLITE_RENDER_SECRET !== '') {
            return GCBLITE_RENDER_SECRET;
        }
        $filtered = apply_filters('gcblite_render_secret', null);
        if (is_string($filtered) && $filtered !== '') {
            return $filtered;
        }
        $option = get_option(self::OPTION_NAME, '');
        return is_string($option) ? $option : '';
    }

    public static function is_configured(): bool {
        return self::get() !== '';
    }

    /**
     * Build the HTTP header array for an outbound render call. Returns
     * an empty array when no secret is configured — wp_remote_get is
     * happy with [] and the frontend can reject (or not) on its own
     * env-driven policy.
     */
    public static function outbound_headers(): array {
        $secret = self::get();
        if ($secret === '') return [];
        return [self::HEADER_NAME => $secret];
    }

    public static function sanitize($value): string {
        return is_string($value) ? trim($value) : '';
    }
}
