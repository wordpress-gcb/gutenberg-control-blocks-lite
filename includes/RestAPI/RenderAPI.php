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
        // Both routes are public-readable. They only render gcb/* blocks that
        // are already registered on the site — i.e. content the site has
        // chosen to publish. The render output is the same HTML a visitor
        // would see embedded in a public page, so making this gated would just
        // force the headless front-end to ship a service-account password.
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

        $slug       = substr($block_name, strlen('gcb/'));
        $theme_root = get_stylesheet_directory();
        $render_php = $theme_root . '/blocks/' . $slug . '/render.php';

        $html = file_exists($render_php)
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
        if (file_exists($render_php) && !empty($inner_blocks)) {
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
        $frontend_url = self::frontend_url();

        $api_url = trailingslashit($frontend_url)
                 . 'wordpress/render/' . rawurlencode($slug)
                 . '?attrs=' . rawurlencode(wp_json_encode($attributes));

        $attrs_hash = md5(wp_json_encode($attributes));
        $cache_key  = "gcblite_render_{$slug}_{$attrs_hash}";
        $cached     = get_transient($cache_key);

        $response = wp_remote_get($api_url, ['timeout' => self::HTTP_TIMEOUT]);

        // Network/HTTP failure → use stale cache if we have one, otherwise a
        // placeholder so the editor still shows something.
        if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
            if (is_array($cached) && !empty($cached['html'])) {
                return $cached['html'];
            }
            return self::unavailable_placeholder($slug, $attributes);
        }

        $body      = wp_remote_retrieve_body($response);
        $extracted = HtmlExtractor::extract($body);

        if ($extracted['html'] === '') {
            // Component server returned 200 but didn't include the wrapper
            // markers — same fallback as for a network failure.
            if (is_array($cached) && !empty($cached['html'])) {
                return $cached['html'];
            }
            return self::unavailable_placeholder($slug, $attributes);
        }

        // Cache reuse: only when the timestamp matches what we already have.
        if (is_array($cached)
            && !empty($cached['html'])
            && !empty($cached['modified'])
            && $extracted['modified']
            && $cached['modified'] === $extracted['modified']
        ) {
            return $cached['html'];
        }

        if ($extracted['modified']) {
            set_transient($cache_key, [
                'html'     => $extracted['html'],
                'modified' => $extracted['modified'],
            ], self::CACHE_TTL);
        }

        return $extracted['html'];
    }

    private static function frontend_url() {
        $url = defined('GCBLITE_COMPONENT_SERVER_URL') ? GCBLITE_COMPONENT_SERVER_URL : self::COMPONENT_SERVER_DEFAULT;
        return apply_filters('gcblite_frontend_url', $url);
    }

    private static function unavailable_placeholder($slug, array $attributes) {
        return sprintf(
            '<div class="gcblite-%1$s" data-gcblite-block="%1$s" data-gcblite-attrs="%2$s"><!-- component server unavailable --></div>',
            esc_attr($slug),
            esc_attr(wp_json_encode($attributes))
        );
    }
}
