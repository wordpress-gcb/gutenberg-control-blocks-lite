<?php
/**
 * Resolve a "query-loop" field's config into a PAGINATED WP_Query.
 *
 * Where Collection picks "the latest N" or "this hand-picked list", QueryLoop
 * runs an open, paginated query over a post type — by taxonomy filters, order,
 * and a page number — and reports how many pages there are. This is what powers
 * a real listing block: render page 1 server-side, then let the front end fetch
 * further pages from the /gcblite/v1/query REST endpoint.
 *
 * The query-loop field stores an object attribute shaped like:
 *
 *   {
 *     "postType":  "team-member",
 *     "perPage":   12,
 *     "orderby":   "date" | "title" | "menu_order" | "rand",
 *     "order":     "DESC" | "ASC",
 *     "pagination":"numbered" | "loadmore" | "none",
 *     "filterTaxonomies": [ { "slug": "department", "label": "Department" } ]
 *   }
 *
 * Active front-end filter selections (the visitor ticking "Engineering") are
 * passed separately as $filters = [ "department" => ["engineering", ...] ] so
 * the stored config stays the block's design and the request carries the state.
 *
 * @package GCBLite\Blocks\Queries
 */

namespace GCBLite\Blocks\Queries;

if (!defined('ABSPATH')) {
    exit;
}

class QueryLoop {

    /** Hard ceiling on per-page, whatever the config asks for. */
    const MAX_PER_PAGE = 100;

    /** Orderby values we allow through to WP_Query (allow-list). */
    const ORDERBY = ['date', 'title', 'menu_order', 'rand', 'modified'];

    /**
     * Build the WP_Query args from a query-loop config + page + active filters.
     * Pure (no WP calls) so the filter/order/pagination logic is unit-testable.
     *
     * @param array $config  The stored query-loop field value.
     * @param int   $page    1-based page number.
     * @param array $filters Active term filters: [ taxonomy_slug => string[] ].
     * @return array WP_Query args, or [] if there's no usable post type.
     */
    public static function build_args(array $config, $page = 1, array $filters = []) {
        $post_type = isset($config['postType']) ? (string) $config['postType'] : '';
        if ($post_type === '') {
            return [];
        }

        $per_page = (int) ($config['perPage'] ?? 12);
        if ($per_page <= 0) {
            $per_page = 12;
        }
        if ($per_page > self::MAX_PER_PAGE) {
            $per_page = self::MAX_PER_PAGE;
        }

        $page = max(1, (int) $page);

        $orderby = isset($config['orderby']) && in_array($config['orderby'], self::ORDERBY, true)
            ? (string) $config['orderby']
            : 'date';
        $order = isset($config['order']) && strtoupper((string) $config['order']) === 'ASC' ? 'ASC' : 'DESC';

        $args = [
            'post_type'              => $post_type,
            'post_status'            => 'publish',
            'posts_per_page'         => $per_page,
            'paged'                  => $page,
            'orderby'                => $orderby,
            'order'                  => $order,
            'ignore_sticky_posts'    => true,
            'update_post_meta_cache'  => true,
            // total_pages needs found_rows, so we DON'T set no_found_rows here.
            'update_post_term_cache' => true,  // renderers usually show taxonomy terms
        ];

        // Restrict active filters to the taxonomies the field actually declared,
        // so a crafted request can't query arbitrary taxonomies.
        $allowed = [];
        foreach (($config['filterTaxonomies'] ?? []) as $t) {
            if (is_array($t) && !empty($t['slug'])) {
                $allowed[(string) $t['slug']] = true;
            }
        }

        $tax_query = [];
        foreach ($filters as $taxonomy => $terms) {
            $taxonomy = (string) $taxonomy;
            if (!isset($allowed[$taxonomy]) || !is_array($terms) || $terms === []) {
                continue;
            }
            $terms = array_values(array_filter(array_map('sanitize_title', $terms)));
            if ($terms === []) {
                continue;
            }
            $tax_query[] = [
                'taxonomy' => $taxonomy,
                'field'    => 'slug',
                'terms'    => $terms,
                'operator' => 'IN',
            ];
        }
        if (count($tax_query) > 1) {
            // Multiple facets active → AND across facets (must match each).
            $tax_query['relation'] = 'AND';
        }
        if ($tax_query !== []) {
            $args['tax_query'] = $tax_query;
        }

        return $args;
    }

    /**
     * Read the current page + active filters + fragment flag from the request.
     * render.php calls this so the same template serves the initial server page
     * (full markup) and the REST fragment requests (items + pager only).
     *
     * @param array $config The query-loop field value (for the declared filters).
     * @return array{page:int, filters:array<string,string[]>, fragment:bool}
     */
    public static function context(array $config) {
        // phpcs:disable WordPress.Security.NonceVerification.Recommended -- read-only public listing
        $page = isset($_GET['gcb_page']) ? max(1, (int) $_GET['gcb_page']) : 1;
        $fragment = !empty($_GET['gcb_fragment']);

        $filters = [];
        foreach (($config['filterTaxonomies'] ?? []) as $t) {
            if (!is_array($t) || empty($t['slug'])) {
                continue;
            }
            $slug = (string) $t['slug'];
            $key  = 'gcb_tax_' . $slug;
            if (!isset($_GET[$key]) || $_GET[$key] === '') {
                continue;
            }
            // Accept "a,b,c" or a single term.
            $vals = is_array($_GET[$key]) ? $_GET[$key] : explode(',', (string) $_GET[$key]);
            $vals = array_values(array_filter(array_map('sanitize_title', $vals)));
            if ($vals) {
                $filters[$slug] = $vals;
            }
        }
        // phpcs:enable
        return ['page' => $page, 'filters' => $filters, 'fragment' => $fragment];
    }

    /**
     * Render a query-loop's items (and pager) for the current request context.
     * This is what makes server page 1 and the REST pages identical — ONE item
     * template, called both places. The caller supplies a $render_item callback
     * that returns one post's HTML; QueryLoop owns the query, the list wrapper,
     * and the pager markup the view.js wires up.
     *
     * @param array    $config       The query-loop field value.
     * @param callable $render_item  fn(\WP_Post $post): string — one item's HTML.
     * @return string
     */
    public static function render_items(array $config, callable $render_item) {
        $ctx = self::context($config);
        $res = self::query($config, $ctx['page'], $ctx['filters']);

        $items = '';
        foreach ($res['posts'] as $post) {
            $items .= (string) call_user_func($render_item, $post);
        }
        if ($items === '') {
            $items = '<p class="gcb-queryloop__empty">' . esc_html__('No results.', 'gcblite') . '</p>';
        }

        $pagination = isset($config['pagination']) ? (string) $config['pagination'] : 'numbered';

        // data-* on the list let view.js know the query state for fetching more.
        $list  = '<div class="gcb-queryloop__items"'
            . ' data-page="' . (int) $res['page'] . '"'
            . ' data-total-pages="' . (int) $res['total_pages'] . '"'
            . ' data-pagination="' . esc_attr($pagination) . '">'
            . $items . '</div>';

        $pager = self::pager_markup($res, $pagination);

        // A fragment request (page 2+ via REST) returns items + pager only — no
        // outer wrapper/controls, so view.js can swap/append in place.
        return $list . $pager;
    }

    /** Build the pager markup for the active pagination mode. */
    private static function pager_markup(array $res, $mode) {
        if ($mode === 'none' || $res['total_pages'] <= 1) {
            return '';
        }
        if ($mode === 'loadmore') {
            if ($res['page'] >= $res['total_pages']) {
                return '';
            }
            return '<div class="gcb-queryloop__pager gcb-queryloop__pager--loadmore">'
                . '<button type="button" class="gcb-queryloop__loadmore" data-next="' . (int) ($res['page'] + 1) . '">'
                . esc_html__('Load more', 'gcblite') . '</button></div>';
        }
        // numbered
        $out = '<nav class="gcb-queryloop__pager gcb-queryloop__pager--numbered" aria-label="' . esc_attr__('Pagination', 'gcblite') . '">';
        for ($i = 1; $i <= $res['total_pages']; $i++) {
            $cur = $i === $res['page'];
            $out .= '<button type="button" class="gcb-queryloop__page' . ($cur ? ' is-current' : '') . '"'
                . ' data-page="' . $i . '"' . ($cur ? ' aria-current="page"' : '') . '>' . $i . '</button>';
        }
        $out .= '</nav>';
        return $out;
    }

    /**
     * Run the paginated query.
     *
     * @return array{posts: array<int,\WP_Post>, page: int, per_page: int, total: int, total_pages: int}
     */
    public static function query(array $config, $page = 1, array $filters = []) {
        $args = self::build_args($config, $page, $filters);
        if ($args === []) {
            return ['posts' => [], 'page' => 1, 'per_page' => 0, 'total' => 0, 'total_pages' => 0];
        }

        $q = new \WP_Query($args);

        return [
            'posts'       => $q->posts,
            'page'        => (int) $args['paged'],
            'per_page'    => (int) $args['posts_per_page'],
            'total'       => (int) $q->found_posts,
            'total_pages' => (int) $q->max_num_pages,
        ];
    }
}
