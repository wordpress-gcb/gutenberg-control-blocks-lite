<?php
/**
 * Front-end pagination endpoint for query-loop blocks.
 *
 *   GET /gcblite/v1/query?blockName=gcb/team-directory&attributes={json}&page=2&gcb_tax_department=engineering
 *
 * A query-loop block renders page 1 server-side. When the visitor pages or
 * filters, the block's view.js calls THIS endpoint, which re-runs the very same
 * render.php in "fragment" mode (QueryLoop::context() sees gcb_fragment=1) so the
 * block emits only its items + pager — identical markup, no template drift. We
 * return that HTML plus the pagination meta.
 *
 * Public + read-only by design: it renders the same gcb/* blocks a visitor
 * already sees on the page, over published content only.
 *
 * @package GCBLite\RestAPI
 */

namespace GCBLite\RestAPI;

if (!defined('ABSPATH')) {
    exit;
}

class QueryLoopAPI {

    const MAX_PAGE = 1000; // sanity ceiling

    public static function init() {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function register_routes() {
        register_rest_route('gcblite/v1', '/query', [
            'methods'             => 'GET',
            'callback'            => [__CLASS__, 'query'],
            'permission_callback' => '__return_true',
            'args'                => [
                'blockName' => ['type' => 'string', 'required' => true],
                'page'      => ['type' => 'integer', 'required' => false],
            ],
        ]);
    }

    public static function query($request) {
        $block_name = (string) $request->get_param('blockName');
        $page       = max(1, min(self::MAX_PAGE, (int) $request->get_param('page') ?: 1));

        if (strpos($block_name, 'gcb/') !== 0) {
            return new \WP_Error('invalid_block', 'Only gcb/* blocks may be queried.', ['status' => 400]);
        }

        $registry   = \WP_Block_Type_Registry::get_instance();
        $block_type = $registry->get_registered($block_name);
        if (!$block_type || !is_callable($block_type->render_callback)) {
            return new \WP_Error('block_not_found', "Block {$block_name} is not registered or has no render.", ['status' => 404]);
        }

        // attributes: JSON in the `attributes` param (the block's saved attrs,
        // so the query config — postType, perPage, filters — is authoritative
        // from the block instance, not forgeable beyond what the field allows).
        $attrs_raw  = $request->get_param('attributes');
        $attributes = [];
        if (is_string($attrs_raw) && $attrs_raw !== '') {
            $decoded = json_decode($attrs_raw, true);
            if (is_array($decoded)) {
                $attributes = $decoded;
            }
        } elseif (is_array($attrs_raw)) {
            $attributes = $attrs_raw;
        }

        // Tell QueryLoop::context() (read by render.php) which page + that this
        // is a fragment request. Filters already ride in $_GET as gcb_tax_*.
        $prev_page     = $_GET['gcb_page']     ?? null;
        $prev_fragment = $_GET['gcb_fragment'] ?? null;
        $_GET['gcb_page']     = $page;
        $_GET['gcb_fragment'] = '1';

        try {
            $block = new \WP_Block([
                'blockName' => $block_name,
                'attrs'     => $attributes,
            ]);
            $html = $block->render();
        } catch (\Throwable $e) {
            $html = '';
        } finally {
            // Restore request state so we don't leak into anything downstream.
            if ($prev_page === null) { unset($_GET['gcb_page']); } else { $_GET['gcb_page'] = $prev_page; }
            if ($prev_fragment === null) { unset($_GET['gcb_fragment']); } else { $_GET['gcb_fragment'] = $prev_fragment; }
        }

        return rest_ensure_response([
            'success' => true,
            'page'    => $page,
            'html'    => $html,
        ]);
    }
}
