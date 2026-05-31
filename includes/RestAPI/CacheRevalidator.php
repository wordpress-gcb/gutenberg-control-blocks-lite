<?php
/**
 * Cache revalidator — pings the headless frontend to bust its page
 * cache when a post is saved.
 *
 * Why this exists: the headless Next.js frontend caches WP REST
 * responses (revalidate: 30) so it doesn't hammer WordPress on every
 * page view. The 30-second window is too long for active authoring —
 * authors edit, hit save, refresh the public page, and see stale
 * content for up to half a minute.
 *
 * This hook closes that loop: when a post is saved, we POST the
 * affected paths to the configured /api/revalidate endpoint on the
 * frontend. The frontend's route calls `revalidatePath()` for each,
 * dropping the cached server-component output immediately.
 *
 * Config — three ways, in priority order:
 *
 *   1. Constants in wp-config.php (production / pinned deploys):
 *        define('GCBLITE_REVALIDATE_URL',     '...');
 *        define('GCBLITE_REVALIDATE_SECRET',  '...');
 *        define('GCBLITE_REVALIDATE_ENABLED', true);
 *
 *   2. Settings screen (Settings → GCB Lite → On-save revalidation):
 *        URL, shared secret, master toggle.
 *
 *   3. None of the above → silent no-op. The class is harmless when
 *      unconfigured.
 *
 * The master toggle is what gates whether we POST at all. Even with a
 * URL + secret saved, leaving the toggle off keeps every save inert —
 * useful when temporarily disabling without losing the config.
 *
 * @package GCBLite\RestAPI
 */

namespace GCBLite\RestAPI;

if (!defined('ABSPATH')) {
    exit;
}

class CacheRevalidator {

    /**
     * Per-request dedup. Same idea as CacheWarmer::$last_warmed_content
     * — autosaves can fire several times per save in quick succession,
     * no point re-POSTing the same path each time.
     */
    private static $last_revalidated = [];

    public static function init() {
        // Priority 30: after CacheWarmer (20) so the plugin's own
        // transient cache is warm before we tell the frontend to
        // refetch — keeps the frontend's first post-revalidation
        // fetch from racing the warm.
        add_action('save_post', [__CLASS__, 'on_save'], 30, 2);
    }

    /**
     * Compute the paths that need revalidating for this post and POST
     * them to the frontend's revalidate endpoint.
     *
     * For a page: revalidates `/` if it's the front page (slug 'home'
     * or matches the WP front-page option), AND the page's own slug
     * path (e.g. `/about`).
     *
     * For a post: revalidates `/` (assumed to list posts), plus the
     * post's permalink path.
     *
     * Filters:
     *   - `gcblite_revalidate_paths` — return the array of paths to
     *     revalidate. Sites with custom URL structures can plug in.
     */
    public static function on_save($post_id, $post) {
        if (wp_is_post_revision($post_id)) {
            return;
        }
        if (!$post || $post->post_status !== 'publish') {
            // Drafts / autosaves don't affect what the public sees.
            return;
        }

        if (!self::is_enabled()) {
            return;
        }

        $url    = self::endpoint_url();
        $secret = self::secret();
        if ($url === '' || $secret === '') {
            return;
        }

        $paths = self::paths_for_post($post);
        $paths = apply_filters('gcblite_revalidate_paths', $paths, $post);
        if (empty($paths)) {
            return;
        }

        // Dedup within one request lifetime.
        $key = $post_id . ':' . md5(implode('|', $paths));
        if (isset(self::$last_revalidated[$key])) {
            return;
        }
        self::$last_revalidated[$key] = true;

        wp_remote_post($url, [
            'timeout'  => 5,
            'blocking' => false, // fire-and-forget; we don't block the save
            'headers'  => [
                'Content-Type'                    => 'application/json',
                'x-gcblite-revalidate-secret'     => $secret,
            ],
            'body'     => wp_json_encode([
                'paths' => array_values($paths),
            ]),
        ]);
    }

    /**
     * Map a post to the paths the frontend should revalidate.
     *
     * Always includes the post's own permalink path. Includes `/` when
     * the post is the configured front page OR when it's a published
     * post (which a homepage post list would surface).
     */
    private static function paths_for_post(\WP_Post $post): array {
        $paths = ['/'];

        // The post's own permalink path. parse_url strips the scheme +
        // host so /about/ on gcblitewp.test becomes just /about/.
        $permalink = get_permalink($post);
        if (is_string($permalink) && $permalink !== '') {
            $path = parse_url($permalink, PHP_URL_PATH);
            if (is_string($path) && $path !== '' && $path !== '/') {
                $paths[] = $path;
            }
        }

        return array_unique($paths);
    }

    /**
     * Master toggle. Constant wins; otherwise read the option.
     */
    private static function is_enabled(): bool {
        if (defined('GCBLITE_REVALIDATE_ENABLED')) {
            return (bool) GCBLITE_REVALIDATE_ENABLED;
        }
        return (bool) get_option('gcblite_revalidate_enabled', false);
    }

    private static function endpoint_url(): string {
        if (defined('GCBLITE_REVALIDATE_URL') && is_string(GCBLITE_REVALIDATE_URL) && GCBLITE_REVALIDATE_URL !== '') {
            return GCBLITE_REVALIDATE_URL;
        }
        $opt = get_option('gcblite_revalidate_url', '');
        return is_string($opt) ? $opt : '';
    }

    private static function secret(): string {
        if (defined('GCBLITE_REVALIDATE_SECRET') && is_string(GCBLITE_REVALIDATE_SECRET) && GCBLITE_REVALIDATE_SECRET !== '') {
            return GCBLITE_REVALIDATE_SECRET;
        }
        $opt = get_option('gcblite_revalidate_secret', '');
        return is_string($opt) ? $opt : '';
    }
}
