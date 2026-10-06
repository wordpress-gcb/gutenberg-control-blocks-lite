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
    const ORDERBY = ['date', 'title', 'menu_order', 'rand', 'modified', 'meta_value', 'meta_value_num'];

    /**
     * The two orders that read a META KEY rather than the post (gcb-pro's
     * leaderboard, 2026-09-22: "highest score first" — a score is meta, and
     * `meta_value_num` is what makes 42,850,000 sort above 9). They need the
     * key beside them as `metaKey`; without one they fall back to date.
     */
    const META_ORDERBY = ['meta_value', 'meta_value_num'];

    /**
     * Statuses an EDITING context may ask for (allow-list). Never 'trash' or
     * 'auto-draft': deleted is deleted, and an auto-draft is not yet a record.
     */
    const EDITABLE_STATUSES = ['publish', 'draft', 'pending', 'future', 'private'];

    /**
     * Build the WP_Query args from a query-loop config + page + active filters.
     * Pure (no WP calls) so the filter/order/pagination logic is unit-testable.
     *
     * @param array $config   The stored query-loop field value.
     * @param int   $page     1-based page number.
     * @param array $filters  Active term filters: [ taxonomy_slug => string[] ].
     * @param array $statuses Post statuses to query. Defaults to publish only —
     *                        an editing context passes EDITABLE_STATUSES so the
     *                        author sees their unpublished records. Allow-listed,
     *                        so a crafted value can't reach 'trash'.
     * @return array WP_Query args, or [] if there's no usable post type.
     */
    public static function build_args(array $config, $page = 1, array $filters = [], array $statuses = []) {
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
        $meta_key = '';
        if (in_array($orderby, self::META_ORDERBY, true)) {
            $meta_key = isset($config['metaKey']) ? sanitize_key((string) $config['metaKey']) : '';
            if ($meta_key === '') {
                $orderby = 'date'; // a meta order with no key is no order
            }
        }
        $order = isset($config['order']) && strtoupper((string) $config['order']) === 'ASC' ? 'ASC' : 'DESC';

        // Publish-only unless the caller (an editor/preview render) asked for
        // more, and then only from the allow-list.
        $statuses = array_values(array_intersect($statuses, self::EDITABLE_STATUSES));
        $post_status = ($statuses === [] || $statuses === ['publish']) ? 'publish' : $statuses;

        $args = [
            'post_type'              => $post_type,
            'post_status'            => $post_status,
            'posts_per_page'         => $per_page,
            'paged'                  => $page,
            'orderby'                => $orderby,
            'order'                  => $order,
            'ignore_sticky_posts'    => true,
            'update_post_meta_cache'  => true,
            // total_pages needs found_rows, so we DON'T set no_found_rows here.
            'update_post_term_cache' => true,  // renderers usually show taxonomy terms
        ];
        if ($meta_key !== '') {
            $args['meta_key'] = $meta_key;
        }

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
     * Which statuses THIS render should see.
     *
     * A block is built before its records are published. In the editor the
     * author must see their own drafts, or the listing looks broken and they
     * "fix" a block that was never wrong. On the public front end the answer
     * is always publish-only.
     *
     * Two things must BOTH hold to widen it: the render is an editor/preview
     * one, and the current user may actually read other people's drafts. The
     * capability check is what makes this safe — a visitor hitting the REST
     * route with any parameter they like still gets publish-only.
     *
     * @return string[] Statuses for build_args (empty = publish only).
     */
    public static function statuses_for_context() {
        if (!function_exists('current_user_can') || !current_user_can('edit_posts')) {
            return [];
        }

        // An editor render: the block editor's server-side render endpoint, any
        // other admin-side render, or a logged-in preview of unsaved changes.
        $editing = (defined('REST_REQUEST') && REST_REQUEST)
            || (function_exists('is_admin') && is_admin())
            || (function_exists('is_preview') && is_preview());

        return $editing ? self::EDITABLE_STATUSES : [];
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
     * @param array    $opts         `wrapper` => false asks for the items BARE: no
     *                               `.gcb-queryloop__items` div and no pager, for a
     *                               region whose element is its layout (a <tbody>,
     *                               a <ul>) where neither has a legal place — a div
     *                               inside a tbody is foster-parented out of the
     *                               table and every row loses its layout (gcb-pro's
     *                               leaderboard, 2026-09-22). `empty` => fn(string
     *                               $message): string shapes the no-results state
     *                               as one of the region's own items; bare with no
     *                               `empty` prints nothing rather than a stray <p>.
     * @return string
     */
    /**
     * EACH ITEM SAYS WHICH POST IT IS (gcb-pro's kit filter, 2026-10-07: a post-type list filtered by its posts'
     * categories): `data-gcb-post` on the item's first element, so what reads the page knows the post behind a card.
     */
    public static function with_post_id(string $html, $post): string {
        $id = is_object($post) && isset($post->ID) ? (int) $post->ID : (is_numeric($post) ? (int) $post : 0);
        if ($id <= 0 || $html === '' || ! class_exists('\WP_HTML_Tag_Processor')) {
            return $html;
        }
        $p = new \WP_HTML_Tag_Processor($html);
        if ($p->next_tag() && $p->get_attribute('data-gcb-post') === null) {
            $p->set_attribute('data-gcb-post', (string) $id);
            return $p->get_updated_html();
        }
        return $html;
    }

    public static function render_items(array $config, callable $render_item, array $opts = []) {
        $ctx = self::context($config);
        $statuses = self::statuses_for_context();
        $res = self::query($config, $ctx['page'], $ctx['filters'], $statuses);

        $items = '';
        foreach ($res['posts'] as $post) {
            $items .= self::with_post_id((string) call_user_func($render_item, $post), $post);
        }
        /* Empty in the EDITOR (where drafts already count) means there are
           genuinely no records yet — say so, since "No results." reads like
           a broken block to someone who just built it. */
        $message = $statuses === []
            ? esc_html__('No results.', 'gcblite')
            : esc_html__('Nothing here yet — add a record to this post type and it will appear.', 'gcblite');

        $pagination = isset($config['pagination']) ? (string) $config['pagination'] : 'numbered';

        // A fragment request (page 2+ via REST) returns items + pager only — no
        // outer wrapper/controls, so view.js can swap/append in place.
        return self::list_markup($items, $res, $pagination, $opts, $message, (string) ($config['postType'] ?? ''));
    }

    /**
     * The list around the rendered items — pure, so the wrapped and the bare
     * shapes can be tested without a query.
     *
     * @param string $items      every item's HTML, concatenated ('' = no posts)
     * @param array  $res        what query() returned (page, total_pages)
     * @param string $pagination 'numbered' | 'loadmore' | 'none'
     * @param array  $opts       see render_items()
     * @param string $message    the no-results words, already escaped
     * @param string $post_type  for the empty paragraph's data-post-type
     * @return string
     */
    public static function list_markup($items, array $res, $pagination, array $opts = [], $message = '', $post_type = '') {
        $items = (string) $items;
        $bare  = array_key_exists('wrapper', $opts) && $opts['wrapper'] === false;

        if ($bare) {
            if ($items === '' && isset($opts['empty']) && is_callable($opts['empty'])) {
                $items = (string) call_user_func($opts['empty'], (string) $message);
            }
            return $items;
        }

        if ($items === '') {
            $items = '<p class="gcb-queryloop__empty" data-post-type="' . esc_attr((string) $post_type) . '">' . $message . '</p>';
        }

        // data-* on the list let view.js know the query state for fetching more.
        $list  = '<div class="gcb-queryloop__items"'
            . ' data-page="' . (int) $res['page'] . '"'
            . ' data-total-pages="' . (int) $res['total_pages'] . '"'
            . ' data-pagination="' . esc_attr((string) $pagination) . '">'
            . $items . '</div>';

        return $list . self::pager_markup($res, (string) $pagination);
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
    public static function query(array $config, $page = 1, array $filters = [], array $statuses = []) {
        $args = self::build_args($config, $page, $filters, $statuses);
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
