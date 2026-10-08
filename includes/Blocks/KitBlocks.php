<?php
namespace GCBLite\Blocks;

/**
 * Assets + icon collection for the blocks the plugin ships itself
 * ("the kit" — the blocks/ directory at the plugin root, scanned by
 * BlockLoader alongside the theme's).
 *
 * Also owns the site's custom icon collection: WP 7.1's Icons API
 * (wp_register_icon_collection / wp_register_icon) lets plugins add
 * collections beside core's. We register a "gcb" collection and fill it
 * from the gcblite_custom_icons filter, so custom/brand icons flow into
 * every icon picker and every server-side render with no extra
 * plumbing. Feature-detected — on WP 7.0 the collection quietly doesn't
 * exist and core icons still work.
 */
class KitBlocks {

    public static function init() {
        add_action('init', [__CLASS__, 'register_styles']);
        add_action('init', [__CLASS__, 'register_icon_collection']);
        add_filter('rest_post_dispatch', [__CLASS__, 'paginate_icons'], 10, 3);
        add_action('init', [__CLASS__, 'register_map_assets']);
        add_action('init', [__CLASS__, 'register_layout_assets']);
        add_action('init', [__CLASS__, 'register_kit_block_assets']);
        add_filter('block_categories_all', [__CLASS__, 'block_category'], 10, 1);
        // Line icons' stroke styling: the page and canvas (enqueue_block_assets), and the admin document the icon
        // picker sits in.
        add_action('enqueue_block_assets', [__CLASS__, 'enqueue_line_icon_css']);
        add_action('enqueue_block_editor_assets', [__CLASS__, 'enqueue_line_icon_css']);
    }

    /** The class a `'style' => 'line'` icon's <svg> carries. */
    public const LINE_ICON_CLASS = 'gcb-icon-line';

    /**
     * Stroke styling for line icons — once, wherever icons are drawn. Width and colour are custom properties a theme
     * can set (`--gcb-icon-stroke`, default 1.5; the stroke is currentColor).
     */
    public const LINE_ICON_CSS = 'svg.gcb-icon-line{fill:none;stroke:currentColor;stroke-width:var(--gcb-icon-stroke,1.5);stroke-linecap:round;stroke-linejoin:round}';

    /** True once a registered custom icon is a line icon (register_icon_collection). */
    private static $has_line_icons = false;

    public static function enqueue_line_icon_css() {
        if (!self::$has_line_icons || wp_style_is('gcblite-line-icons', 'enqueued')) {
            return;
        }
        wp_register_style('gcblite-line-icons', false, [], null);
        wp_enqueue_style('gcblite-line-icons');
        wp_add_inline_style('gcblite-line-icons', self::LINE_ICON_CSS);
    }

    /**
     * A line icon's SVG made to survive the icon registry (TODO "Line icons through the registry", 2026-10-07):
     * wp_register_icon strips every stroke-* attribute and <g>, so a stroke icon comes out a filled blob — in the
     * picker too. It keeps a class on <svg> and fill on the shapes, so the <svg> gets LINE_ICON_CLASS (styled by
     * LINE_ICON_CSS) and each shape without a fill gets fill="none" (the registry's default fill would fill it).
     */
    public static function line_icon_svg($svg) {
        $svg = (string) $svg;
        $svg = preg_replace_callback('/<svg\b[^>]*>/i', function ($m) {
            $tag = $m[0];
            if (preg_match('/\sclass=(["\'])(.*?)\1/i', $tag, $c)) {
                $classes = preg_split('/\s+/', trim($c[2]));
                if (in_array(self::LINE_ICON_CLASS, $classes, true)) {
                    return $tag;
                }
                return str_replace($c[0], ' class=' . $c[1] . trim($c[2] . ' ' . self::LINE_ICON_CLASS) . $c[1], $tag);
            }
            return preg_replace('/^<svg\b/i', '<svg class="' . self::LINE_ICON_CLASS . '"', $tag);
        }, $svg, 1);
        return preg_replace_callback('/<(path|circle|ellipse|line|polyline|polygon|rect)\b(?![^>]*\sfill=)/i', function ($m) {
            return '<' . $m[1] . ' fill="none"';
        }, $svg);
    }

    /**
     * The gcb/map block's assets: its style + the front-end view script,
     * plus the public Google Maps JS API (gated on a configured key). The
     * map renders a REAL interactive map by default — view.js does
     * new google.maps.Map, styled by a Cloud Map ID. Registered by handle
     * (block.json names them in "style"/"viewScript") so the block only
     * loads them when it's actually on the page.
     *
     * loading=async + callback=gcbMapInit is Google's required async
     * bootstrap; view.js defines gcbMapInit as the global the loader calls.
     * Styling is a Cloud Map ID (view.js passes mapId) — Google's forward
     * path, replacing the deprecated JSON styles array (the two are
     * mutually exclusive). Classic google.maps.Marker still works with a
     * mapId (vector map), so no marker library is required.
     */
    /**
     * THE GCB GROUP IN THE INSERTER (Mark, 2026-10-09: "can we include some default blocks as well like the grid
     * block?"): the blocks the plugin ships for a person to arrange by hand — Layout (the grid), Carousel, Tabs,
     * Accordion, Icon list, Map — under one heading, so they are found beside a theme's own (whose category is "GCB" on a site the AI built for —
     * hence "GCB kit", slug gcb-kit). The AI never reaches for
     * them: the chat's register is the theme's blocks dir, not this one.
     */
    public static function block_category($categories) {
        $categories = is_array($categories) ? $categories : [];
        foreach ($categories as $c) {
            if (is_array($c) && ($c['slug'] ?? '') === 'gcb-kit') {
                return $categories;
            }
        }
        array_unshift($categories, [
            'slug'  => 'gcb-kit',
            'title' => __('GCB kit', 'gcblite'),
            'icon'  => null,
        ]);
        return $categories;
    }

    /**
     * The carousel, tabs and accordion blocks' style + front-end script, by the handles their block.json name
     * (style / viewScript), so each loads only with its block. Each script is the block's own small driver — no
     * library, nothing of gcb-pro's kit — so the free plugin alone runs them.
     */
    public static function register_kit_block_assets() {
        foreach (['carousel', 'tabs', 'accordion'] as $b) {
            wp_register_style('gcblite-' . $b, GCBLITE_PLUGIN_URL . 'blocks/' . $b . '/style.css', [], GCBLITE_VERSION);
            wp_register_script('gcblite-' . $b . '-view', GCBLITE_PLUGIN_URL . 'blocks/' . $b . '/view.js', [], GCBLITE_VERSION, true);
        }
    }

    /** The gcb/layout block's style (blocks/layout/style.css), by the handle block.json names, so it loads only with the block. */
    public static function register_layout_assets() {
        wp_register_style(
            'gcblite-layout',
            GCBLITE_PLUGIN_URL . 'blocks/layout/style.css',
            [],
            GCBLITE_VERSION
        );
    }

    public static function register_map_assets() {
        wp_register_style(
            'gcblite-map',
            GCBLITE_PLUGIN_URL . 'blocks/map/style.css',
            [],
            GCBLITE_VERSION
        );

        // view.js defines the gcbMapInit callback, so it must load BEFORE
        // the Google loader fires that callback → the Maps API depends on
        // view.js (not the reverse). block.json's viewScript is
        // gcblite-map-view; the Maps API rides along as its dependency's
        // dependency being flipped, so we make the Maps handle depend on
        // view and enqueue Maps from the block too.
        wp_register_script(
            'gcblite-map-view',
            GCBLITE_PLUGIN_URL . 'blocks/map/view.js',
            [],
            GCBLITE_VERSION,
            true
        );

        if (class_exists('\GCBLite\Integrations\GoogleMapsKey')) {
            $key = \GCBLite\Integrations\GoogleMapsKey::get();
            if ($key !== '') {
                wp_register_script(
                    'gcblite-google-maps',
                    'https://maps.googleapis.com/maps/api/js?key=' . esc_attr($key)
                        . '&loading=async&callback=gcbMapInit',
                    [ 'gcblite-map-view' ],
                    null,
                    true
                );
                // The block only names gcblite-map-view as its viewScript;
                // pull the Maps loader in alongside it whenever the view
                // script is enqueued (i.e. the block is on the page).
                add_action('wp_enqueue_scripts', function () {
                    if (wp_script_is('gcblite-map-view', 'enqueued')) {
                        wp_enqueue_script('gcblite-google-maps');
                    }
                }, 20);
            }
        }
    }

    /**
     * Kit block styles are registered by handle (named in each block.json
     * "style") rather than file: — the plugin dir is often a symlink in
     * dev, and WP mis-derives file: URLs for paths outside the real
     * WP_PLUGIN_DIR. GCBLITE_PLUGIN_URL always resolves correctly.
     */
    public static function register_styles() {
        wp_register_style(
            'gcblite-icon-list',
            GCBLITE_PLUGIN_URL . 'blocks/icon-list/style.css',
            [],
            GCBLITE_VERSION
        );
    }

    /**
     * PAGE THE ICONS LIST (2026-10-07). /wp/v2/icons ignores `page` and
     * `per_page` and returns every icon each time. The icon field's picker
     * (@wordpress-gcb/fields controls/icon.js) asks 100 at a time and keeps
     * going while a page comes back full — so once a site has 100+ icons
     * (core's 88 plus a theme's collection) every page is "full" and it makes
     * 49 identical requests before the picker can show anything ("Unknown
     * icon" meanwhile). Slice the list as asked, with the usual totals.
     *
     * Only when a page or per_page was actually requested; a bare request
     * still gets everything, as core gives it.
     *
     * @param \WP_HTTP_Response|\WP_REST_Response $response
     * @param \WP_REST_Server                    $server
     * @param \WP_REST_Request                   $request
     */
    public static function paginate_icons($response, $server, $request) {
        if (!$response instanceof \WP_REST_Response || $request->get_route() !== '/wp/v2/icons' || $response->is_error()) {
            return $response;
        }
        $params = $request->get_query_params();
        if (!isset($params['page']) && !isset($params['per_page'])) {
            return $response;
        }
        $all = $response->get_data();
        if (!is_array($all) || !array_is_list($all)) {
            return $response;
        }
        $per   = max(1, min(100, (int) ($params['per_page'] ?? 10)));
        $page  = max(1, (int) ($params['page'] ?? 1));
        $total = count($all);
        $response->set_data(array_slice($all, ($page - 1) * $per, $per));
        $response->header('X-WP-Total', (string) $total);
        $response->header('X-WP-TotalPages', (string) max(1, (int) ceil($total / $per)));
        return $response;
    }

    /**
     * The "gcb" icon collection — custom/brand icons beside core's.
     */
    public static function register_icon_collection() {
        if (!function_exists('wp_register_icon_collection')) {
            return; // WP < 7.1 — registry closed to third parties.
        }

        /**
         * Custom icons for the site's gcb collection.
         *
         * @param array $icons name => { label: string, content: svg string, style?: 'line' }
         *                     'line' — a stroke icon (stroke="currentColor"-style paths): GCB keeps it a line
         *                     through the registry (line_icon_svg) and ships its CSS (LINE_ICON_CSS).
         */
        $icons = apply_filters('gcblite_custom_icons', []);
        if (empty($icons) || !is_array($icons)) {
            return; // No empty collection cluttering the picker.
        }

        wp_register_icon_collection('gcb', [
            'label'       => __('Site icons', 'gcblite'),
            'description' => __('Custom icons added through GCB.', 'gcblite'),
        ]);

        foreach ($icons as $name => $args) {
            if (!is_string($name) || !is_array($args) || empty($args['content'])) {
                continue;
            }
            $content = (string) $args['content'];
            if (($args['style'] ?? '') === 'line') {
                $content = self::line_icon_svg($content);
                self::$has_line_icons = true;
            }
            wp_register_icon('gcb/' . $name, [
                'label'   => (string) ($args['label'] ?? $name),
                'content' => $content,
            ]);
        }
    }
}
