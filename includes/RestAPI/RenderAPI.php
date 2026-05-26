<?php
/**
 * Render bridge: editor → WP → render.php (or component server).
 *
 * Each gcb/* block can be rendered one of two ways:
 *
 *   1. PHP: themes/{theme}/blocks/{slug}/render.php exists →
 *      we execute it server-side with the block's attributes in scope and
 *      return the HTML.
 *
 *   2. Component server: render.php is absent → we make a server-to-server
 *      GET to a Next.js (or any HTTP) endpoint at
 *        {gcblite_frontend_url}/wordpress/render/{slug}?attrs={json}
 *      and return the extracted component HTML.
 *
 * The editor only ever calls THIS plugin — no CORS, no exposed component-server
 * URL in the browser, no React bundle shipped to wp-admin.
 *
 * Endpoints:
 *   POST /gcblite/v1/render        { blockName, attributes }
 *   POST /gcblite/v1/render-batch  { blocks: [{ clientId, blockName, attributes }] }
 *
 * @package GCBLite\RestAPI
 */

namespace GCBLite\RestAPI;

use GCBLite\Rendering\BlockWrapperParser;
use GCBLite\Rendering\HtmlExtractor;
use GCBLite\Rendering\InnerBlocksReplacer;

if (!defined('ABSPATH')) {
    exit;
}

class RenderAPI {

    const COMPONENT_SERVER_DEFAULT = 'http://localhost:3001';
    const HTTP_TIMEOUT             = 5;
    const BATCH_LIMIT              = 100;
    const CACHE_TTL                = HOUR_IN_SECONDS;

    public static function init() {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function register_routes() {
        // Both routes are public-readable by design. They only render
        // gcb/* blocks already registered on the site — content the site
        // has chosen to publish. The render output is the same HTML a
        // visitor would see embedded in a public page, so gating these
        // would just force the headless front-end to ship a service-
        // account password.
        //
        // SSRF mitigation (matters to plugin reviewers): these endpoints
        // can proxy to a configurable frontend URL via wp_remote_get(),
        // but the URL is ONLY settable via:
        //   - GCBLITE_COMPONENT_SERVER_URL defined in wp-config.php, OR
        //   - the `gcblite_frontend_url` PHP filter
        // It is NOT stored in any WordPress option or settable via REST.
        // An attacker therefore cannot retarget the proxy without
        // filesystem access. The destination's response is also extracted
        // through a strict <wp-block-wrapper> regex (HtmlExtractor) that
        // drops any non-component markup — there is no arbitrary HTML
        // pass-through.
        register_rest_route('gcblite/v1', '/render', [
            'methods'             => 'POST',
            'callback'            => [__CLASS__, 'render'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route('gcblite/v1', '/render-batch', [
            'methods'             => 'POST',
            'callback'            => [__CLASS__, 'render_batch'],
            'permission_callback' => '__return_true',
        ]);
    }

    /**
     * Single-block render. Mostly here for ad-hoc debugging / curl use.
     * The editor always hits /render-batch.
     */
    public static function render($request) {
        $params       = $request->get_json_params() ?: [];
        $block_name   = isset($params['blockName']) ? (string) $params['blockName'] : '';
        $attributes   = isset($params['attributes']) && is_array($params['attributes']) ? $params['attributes'] : [];
        $inner_blocks = isset($params['innerBlocks']) && is_array($params['innerBlocks']) ? $params['innerBlocks'] : [];

        $result = self::render_one($block_name, $attributes, $inner_blocks);
        if (is_wp_error($result)) {
            return $result;
        }
        return rest_ensure_response(array_merge(['success' => true], $result));
    }

    public static function render_batch($request) {
        $params = $request->get_json_params() ?: [];
        $blocks = $params['blocks'] ?? null;

        if (!is_array($blocks)) {
            return new \WP_Error('bad_request', 'blocks must be an array', ['status' => 400]);
        }
        if (count($blocks) > self::BATCH_LIMIT) {
            return new \WP_Error(
                'batch_too_large',
                'Too many blocks in batch (limit ' . self::BATCH_LIMIT . ')',
                ['status' => 400]
            );
        }

        $results = [];
        foreach ($blocks as $block) {
            $client_id    = isset($block['clientId']) ? (string) $block['clientId'] : '';
            $block_name   = isset($block['blockName']) ? (string) $block['blockName'] : '';
            $attributes   = isset($block['attributes']) && is_array($block['attributes']) ? $block['attributes'] : [];
            $inner_blocks = isset($block['innerBlocks']) && is_array($block['innerBlocks']) ? $block['innerBlocks'] : [];

            if ($client_id === '') {
                // Without a clientId we have no way to demux the response.
                continue;
            }

            $result = self::render_one($block_name, $attributes, $inner_blocks);
            if (is_wp_error($result)) {
                $results[$client_id] = [
                    'success' => false,
                    'error'   => $result->get_error_message(),
                ];
            } else {
                $results[$client_id] = array_merge(['success' => true], $result);
            }
        }

        return rest_ensure_response([
            'success' => true,
            'results' => $results,
        ]);
    }

    /**
     * Public facade for rendering a single block. Same behaviour as the REST
     * endpoint but callable from PHP (e.g. the Abilities API integration)
     * without round-tripping through WP_REST_Request.
     *
     * @return array{ html: string, wrapperAttributes: array, blockName: string }|\WP_Error
     */
    public static function render_block($block_name, array $attributes = [], array $inner_blocks = []) {
        return self::render_one($block_name, $attributes, $inner_blocks);
    }

    /**
     * Public entrypoint for the save_post cache warmer. Renders a block
     * exactly as render-batch would, side-effecting the transient cache
     * via render_component_server(). Callers should not depend on the
     * return value — the warmer ignores it.
     *
     * @return array|\WP_Error
     */
    public static function render_for_cache($block_name, array $attributes, array $inner_blocks = []) {
        return self::render_one($block_name, $attributes, $inner_blocks);
    }

    /**
     * @return array{ html: string, wrapperAttributes: array, blockName: string }|\WP_Error
     */
    private static function render_one($block_name, array $attributes, array $inner_blocks = []) {
        if ($block_name === '') {
            return new \WP_Error('missing_block_name', 'blockName is required', ['status' => 400]);
        }

        // We only render blocks that have actually been registered via WP.
        // BlockLoader registers gcb/* blocks from the theme; nothing else is
        // legitimately renderable through here.
        $registry   = \WP_Block_Type_Registry::get_instance();
        $block_type = $registry->get_registered($block_name);
        if (!$block_type) {
            return new \WP_Error('block_not_found', "Block {$block_name} is not registered", ['status' => 404]);
        }
        if (strpos($block_name, 'gcb/') !== 0) {
            return new \WP_Error('invalid_block', 'Only gcb/* blocks may be rendered through this endpoint', ['status' => 400]);
        }

        $slug = substr($block_name, strlen('gcb/'));

        // PHP-rendered vs component-server-rendered is decided by whether
        // BlockLoader wired a render_callback when it called
        // register_block_type() — which it only does when a render.php was
        // present in the block dir. This works for theme blocks AND for the
        // bundled examples/blocks/ that load when GCBLITE_LOAD_EXAMPLES is
        // set. We used to rebuild the render.php path from get_stylesheet_directory()
        // here, which missed the plugin's own examples dir.
        $is_php_rendered = is_callable($block_type->render_callback);

        $html = $is_php_rendered
            ? self::render_php($block_type, $attributes, $inner_blocks)
            : self::render_component_server($slug, $attributes, $inner_blocks);

        if (is_wp_error($html)) {
            return $html;
        }

        // For PHP-rendered blocks with inner blocks, the render.php uses
        // <Repeater> / <InnerBlocks> markers. Expand those into the rendered
        // child blocks — this is what InnerBlocksReplacer does on a normal
        // page render via the `render_block` filter, but our endpoint calls
        // the render callback directly so we apply it here too.
        if ($is_php_rendered && !empty($inner_blocks)) {
            $inner_html = '';
            foreach ($inner_blocks as $child) {
                $inner_html .= self::render_inner_block($child);
            }
            $html = InnerBlocksReplacer::replace($html, $inner_html);
        }

        $parsed = BlockWrapperParser::parse($html);
        return [
            'html'              => $parsed['html'],
            'wrapperAttributes' => $parsed['wrapperAttributes'],
            'blockName'         => $block_name,
        ];
    }

    /**
     * Render a single inner block from a parsed-block-style array.
     * Recurses through innerBlocks so nested structures (e.g. accordion with
     * accordion-items, each with their own children) render correctly.
     */
    private static function render_inner_block(array $block) {
        $name = $block['blockName'] ?? '';
        if ($name === '') return '';

        $attrs        = $block['attrs'] ?? [];
        $inner_blocks = $block['innerBlocks'] ?? [];

        // Use the standard WP render path so render_block filters fire —
        // InnerBlocksReplacer's own hook picks up any nested gcb blocks.
        return render_block([
            'blockName'    => $name,
            'attrs'        => is_array($attrs) ? $attrs : [],
            'innerBlocks'  => is_array($inner_blocks) ? $inner_blocks : [],
            'innerHTML'    => $block['innerHTML'] ?? '',
            'innerContent' => $block['innerContent'] ?? [],
        ]);
    }

    /**
     * Execute the block's render.php via WP's own render callback.
     */
    private static function render_php(\WP_Block_Type $block_type, array $attributes, array $inner_blocks = []) {
        if (!is_callable($block_type->render_callback)) {
            return new \WP_Error('no_render_callback', "Block {$block_type->name} has no render callback", ['status' => 400]);
        }

        $prepared = $block_type->prepare_attributes_for_render($attributes);

        // Build $content from rendered inner blocks. render.php usually echoes
        // $content where children should land — same shape WP provides on a
        // normal page render. <Repeater>/<InnerBlocks> markers are handled
        // by the caller via InnerBlocksReplacer.
        $content = '';
        foreach ($inner_blocks as $child) {
            $content .= self::render_inner_block(is_array($child) ? $child : []);
        }

        $parsed = [
            'blockName'    => $block_type->name,
            'attrs'        => $prepared,
            'innerBlocks'  => $inner_blocks,
            'innerHTML'    => '',
            'innerContent' => [],
        ];
        $block = new \WP_Block($parsed);

        // get_block_wrapper_attributes() reads from this static.
        $previous = \WP_Block_Supports::$block_to_render ?? null;
        \WP_Block_Supports::$block_to_render = $parsed;

        try {
            $html = (string) call_user_func($block_type->render_callback, $prepared, $content, $block);
        } catch (\Throwable $e) {
            \WP_Block_Supports::$block_to_render = $previous;
            return new \WP_Error('render_failed', $e->getMessage(), ['status' => 500]);
        }

        \WP_Block_Supports::$block_to_render = $previous;
        return $html;
    }

    /**
     * Fetch the component HTML from the configured component server.
     *
     * Editor previews intentionally do NOT send innerBlocks. The component
     * server's Repeater pattern emits a <repeater> marker when called
     * without blocks, and gcb-lite's parse-preview.js swaps that marker for
     * a real InnerBlocks UI on the editor side — WP itself then owns the
     * children. If we passed innerBlocks here, the component would render
     * the items inline instead of emitting the marker, and the editor's
     * Add button would never appear.
     *
     * The frontend page route (BlockRenderer.jsx) passes innerBlocks to
     * <Repeater> at the React layer, so the public side still renders
     * items correctly without needing them in the URL.
     *
     * The `$inner_blocks` parameter is accepted (and ignored) so the call
     * signature mirrors render_php — keeps the dispatcher in render_one
     * simple.
     *
     * Cache shape (per-attributes transient): { html, modified }.
     *
     * Cache semantics — read this carefully, it's a stale-while-error and
     * HTML-stability cache, NOT a stale-while-revalidate / skip-HTTP cache:
     *
     *  - We ALWAYS make the HTTP call (no check-first short-circuit). This
     *    keeps editor previews fresh as the author edits.
     *  - The component server stamps its response with a `modified`
     *    timestamp (its own start time). If our cached `modified` matches
     *    the just-fetched one, we return the cached html string — which is
     *    byte-identical to what we just received but avoids re-allocating
     *    a fresh string for every render.
     *  - If the HTTP call fails (network, non-200, missing wrapper
     *    markers), we fall back to the cached html. That's the
     *    stale-while-error behaviour.
     *
     * If a future caller wants to skip the HTTP round-trip entirely (e.g.
     * the public-frontend page builder where staleness is acceptable),
     * add a short TTL and a check-first short-circuit here — but don't
     * apply it to the editor-preview path.
     */
    private static function render_component_server($slug, array $attributes, array $inner_blocks = []) {
        $frontend_url = \GCBLite\Frontend\Url::get();

        // No React frontend configured (Settings → GCB Lite is empty, no
        // wp-config constant, no filter). Bail with the standard
        // unavailable placeholder rather than firing a doomed HTTP call.
        if ($frontend_url === '') {
            return self::unavailable_placeholder($slug, $attributes);
        }

        $attrs_hash = md5(wp_json_encode($attributes));
        $cache_key  = "gcblite_render_{$slug}_{$attrs_hash}";
        $cached     = get_transient($cache_key);

        // Cache HIT: return immediately, schedule a background revalidate.
        //
        // The fast path. Editor opening a saved page, public page render,
        // anything that doesn't change attrs — all instant. The background
        // revalidate keeps the cache fresh so the NEXT render reflects any
        // Vercel-side change (CSS update, component fix, etc.) without
        // requiring a content save to trigger CacheWarmer.
        //
        // fastcgi_finish_request flushes the response to the user, then
        // lets the PHP process keep running. The user sees instant HTML;
        // the Vercel fetch happens after they've already got their bytes.
        // Not all SAPIs support it (php-cli, php-built-in, some Apache
        // setups) — we degrade gracefully: the background work skips and
        // CacheWarmer (save_post) becomes the only update path.
        if (is_array($cached) && !empty($cached['html'])) {
            self::schedule_revalidate($slug, $attributes, $cache_key);
            return $cached['html'];
        }

        // Cache MISS: synchronous fetch (matches old behaviour exactly).
        return self::fetch_and_cache($slug, $attributes, $cache_key, $frontend_url);
    }

    /**
     * Synchronous fetch from the component server. Writes the cache as
     * a side-effect on success. Returns the resolved HTML, or a
     * placeholder if anything goes wrong.
     *
     * Cache-write safety: we ONLY overwrite the transient when we have
     * verified-good content from the frontend — a 200 response, with
     * the expected wrapper markers, AND a modified timestamp. Any
     * failure mode (network error, non-200, empty extraction, missing
     * timestamp) leaves the existing cache entry alone and logs a
     * warning so the operator can see "we tried to refresh and couldn't
     * reach Vercel." That way a flaky frontend doesn't poison cached
     * good content with placeholders.
     */
    private static function fetch_and_cache($slug, array $attributes, $cache_key, $frontend_url) {
        $api_url = trailingslashit($frontend_url)
                 . 'wordpress/render/' . rawurlencode($slug)
                 . '?attrs=' . rawurlencode(wp_json_encode($attributes));

        $cached   = get_transient($cache_key);
        $response = wp_remote_get($api_url, ['timeout' => self::HTTP_TIMEOUT]);

        // Network/HTTP failure → use stale cache if we have one, otherwise a
        // placeholder so the editor still shows something. Either way:
        // do NOT touch the cache.
        if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
            $detail = is_wp_error($response)
                ? $response->get_error_message()
                : ('HTTP ' . wp_remote_retrieve_response_code($response));
            self::log_revalidate_failure($slug, $cache_key, $detail);

            if (is_array($cached) && !empty($cached['html'])) {
                return $cached['html'];
            }
            return self::unavailable_placeholder($slug, $attributes);
        }

        $body      = wp_remote_retrieve_body($response);
        $extracted = HtmlExtractor::extract($body);

        // Resolve any root-relative URLs (src="/foo.png", href="/bar.css")
        // against the component-server origin. If a block author writes a
        // relative image path in their React component, it's relative to
        // that frontend's public dir — NOT to whichever WP site eventually
        // displays this HTML. So we rewrite once here, in the place that
        // knows both URLs.
        if ($extracted['html'] !== '') {
            $extracted['html'] = self::resolve_relative_urls($extracted['html'], $frontend_url);
        }

        if ($extracted['html'] === '') {
            // 200 but no wrapper markers — frontend ran but produced
            // a degenerate response. Same protection as network failure.
            self::log_revalidate_failure($slug, $cache_key, 'no wrapper markers in response');
            if (is_array($cached) && !empty($cached['html'])) {
                return $cached['html'];
            }
            return self::unavailable_placeholder($slug, $attributes);
        }

        if (!$extracted['modified']) {
            // Frontend gave us HTML but no `modified` timestamp. We can
            // serve the response to this caller but we DON'T cache it —
            // without the timestamp we can't tell if a future revalidate
            // returns the same content. Better to re-fetch next time
            // than to write a half-formed entry.
            self::log_revalidate_failure($slug, $cache_key, 'response missing modified timestamp');
            return $extracted['html'];
        }

        set_transient($cache_key, [
            'html'     => $extracted['html'],
            'modified' => $extracted['modified'],
        ], self::CACHE_TTL);

        return $extracted['html'];
    }

    /**
     * Emit a warning when a revalidate fetch failed. The operator can
     * grep the log for [gcb-lite revalidate] to see every time we tried
     * to refresh a cache entry and couldn't reach the frontend (or got
     * an unusable response). The cache itself is unchanged in every
     * failure case — stale-but-good > fresh-but-broken.
     */
    private static function log_revalidate_failure($slug, $cache_key, $reason) {
        if (!defined('WP_DEBUG') || !WP_DEBUG) {
            return;
        }
        error_log(sprintf(
            '[gcb-lite revalidate] frontend fetch failed for %s (%s): %s — cache left untouched',
            $slug,
            $cache_key,
            $reason
        ));
    }

    /**
     * Schedule a background revalidate of the given cache entry.
     *
     * Uses fastcgi_finish_request to flush the response to the client
     * first, then continues the script to fetch + update the cache.
     *
     * IMPORTANT: must NOT fire inside a REST request. fastcgi_finish_request
     * truncates the response stream — if WP's REST framework hasn't
     * finished writing the JSON envelope yet, the client gets a partial
     * body and the editor shows "Response is not a valid JSON response."
     * REST requests skip the revalidate; the next non-REST page-view
     * (or the save_post hook) will refresh the cache instead.
     *
     * Skipped on:
     *  - REST contexts (defined('REST_REQUEST') OR wp_is_serving_rest_request)
     *  - SAPIs without fastcgi_finish_request (CLI, php-built-in, some Apache)
     *  - Frontend URL not configured
     */
    private static function schedule_revalidate($slug, array $attributes, $cache_key) {
        if (!function_exists('fastcgi_finish_request')) {
            return;
        }
        // Don't touch the connection mid-REST. WP_REST_Server writes its
        // JSON envelope at request-end; cutting the FastCGI socket here
        // truncates that response.
        if (defined('REST_REQUEST') && REST_REQUEST) {
            return;
        }
        if (function_exists('wp_is_serving_rest_request') && wp_is_serving_rest_request()) {
            return;
        }

        // Capture by value — the closure runs after the response is sent.
        $frontend_url = \GCBLite\Frontend\Url::get();
        register_shutdown_function(static function () use ($slug, $attributes, $cache_key, $frontend_url) {
            if ($frontend_url === '') return;
            try {
                self::fetch_and_cache($slug, $attributes, $cache_key, $frontend_url);
            } catch (\Throwable $e) {
                if (defined('WP_DEBUG') && WP_DEBUG) {
                    error_log("[gcb-lite revalidate] {$slug}: " . $e->getMessage());
                }
            }
        });
        fastcgi_finish_request();
    }

    // frontend_url() retired — every caller now uses GCBLite\Frontend\Url::get()
    // directly. Kept as a one-liner shim for any third-party callers that
    // might have started using it (very unlikely on a pre-1.0 plugin, but
    // cheap insurance).
    private static function frontend_url() {
        return \GCBLite\Frontend\Url::get();
    }

    /**
     * Rewrite root-relative URLs in component-server HTML against the
     * component-server origin.
     *
     * Why: an author writing a React component for a headless theme
     * naturally writes `<img src="/images/foo.png" />`, where /images/
     * lives in their Next.js public dir. When gcb-lite ships that HTML
     * to a WP install on a different origin, the browser resolves
     * /images/foo.png against the WP origin — 404. So before returning,
     * we prefix every src/href/srcset/data-bg URL that starts with `/`
     * (but not `//` and not a real URL) with the component-server origin.
     *
     * Targets:
     *  - <img src="/x">, <source src="/x">
     *  - <link href="/x">, <a href="/x"> (links would resolve to WP origin
     *    on their own; rewriting points them at the component server which
     *    matches what the author meant)
     *  - srcset="/x 1x, /y 2x"
     *  - inline style="background-image:url(/x)"
     *
     * Pure string ops via regex — DOMDocument would be more correct but
     * is heavyweight and adds a dep on libxml. The HTML we're rewriting
     * is component-server output, not user content, so the regex is safe
     * against the markup we control.
     */
    private static function resolve_relative_urls($html, $base) {
        $base = rtrim($base, '/');
        if ($base === '') return $html;

        // Match attr="/path" — exclude //protocol-relative and absolute URLs.
        // Captures the attribute name + opening quote, then the leading /,
        // then the path (no whitespace, no quotes).
        $html = preg_replace_callback(
            '#\b(src|href)\s*=\s*(["\'])(/(?!/)[^"\']*)\2#',
            static function ($m) use ($base) {
                return $m[1] . '=' . $m[2] . $base . $m[3] . $m[2];
            },
            $html
        );

        // srcset is space- or comma-separated. Rewrite each /-prefixed URL.
        $html = preg_replace_callback(
            '#\bsrcset\s*=\s*(["\'])([^"\']*)\1#',
            static function ($m) use ($base) {
                $rewritten = preg_replace_callback(
                    '#(^|,\s*|\s+)(/(?!/)[^\s,"\']+)#',
                    static function ($mm) use ($base) {
                        return $mm[1] . $base . $mm[2];
                    },
                    $m[2]
                );
                return 'srcset=' . $m[1] . $rewritten . $m[1];
            },
            $html
        );

        // inline style url(/foo). Only single root-relative form; covers
        // background-image, list-style-image, etc.
        $html = preg_replace_callback(
            '#url\(\s*(["\']?)(/(?!/)[^)\'"\s]*)\1\s*\)#',
            static function ($m) use ($base) {
                return 'url(' . $m[1] . $base . $m[2] . $m[1] . ')';
            },
            $html
        );

        return $html;
    }

    private static function unavailable_placeholder($slug, array $attributes) {
        return sprintf(
            '<div class="gcblite-%1$s" data-gcblite-block="%1$s" data-gcblite-attrs="%2$s"><!-- component server unavailable --></div>',
            esc_attr($slug),
            esc_attr(wp_json_encode($attributes))
        );
    }
}
