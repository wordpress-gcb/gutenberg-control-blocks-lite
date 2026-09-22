<?php
/**
 * HOVER FOLLOWS THE SCROLL.
 *
 * Mark, 2026-09-22: "when you scroll, unless you stop scrolling and move your
 * mouse, you're not engaged in the thing … if your mouse is on it you're
 * engaged even if your mouse is just on it as you scroll by."
 *
 * A browser updates :hover and fires mouseenter only when the pointer MOVES.
 * A card scrolling under a still pointer engages nothing (Safari: not even
 * once the scroll stops). build/hover-follows-scroll.js asks, on every
 * scroll, what is under the pointer inside a gcb block, marks it `gcb-hover`
 * and fires the mouse events the browser would have. It is enqueued the
 * first time a gcb/* block renders on a front-end page, and nowhere else.
 *
 * @package GCBLite\Frontend
 */

namespace GCBLite\Frontend;

if (!defined('ABSPATH')) {
    exit;
}

class HoverFollowsScroll {

    const HANDLE = 'gcblite-hover-follows-scroll';

    private static $done = false;

    public static function init() {
        add_filter('render_block', [__CLASS__, 'on_render'], 5, 2);
    }

    /**
     * The first gcb block on a front-end page brings the runtime with it.
     *
     * @param string $html  the rendered block
     * @param array  $block the parsed block
     * @return string the block, untouched
     */
    public static function on_render($html, $block) {
        if (self::$done || is_admin() || wp_doing_ajax()) {
            return $html;
        }
        $name = is_array($block) ? (string) ($block['blockName'] ?? '') : '';
        if (strpos($name, 'gcb/') !== 0) {
            return $html;
        }
        self::$done = true;
        $dir  = defined('GCBLITE_PLUGIN_DIR') ? GCBLITE_PLUGIN_DIR : dirname(__DIR__, 2) . '/';
        $url  = defined('GCBLITE_PLUGIN_URL') ? GCBLITE_PLUGIN_URL : '';
        $file = $dir . 'build/hover-follows-scroll.js';
        $ver  = file_exists($file) ? (string) filemtime($file) : (defined('GCBLITE_VERSION') ? GCBLITE_VERSION : '0');
        wp_enqueue_script(self::HANDLE, $url . 'build/hover-follows-scroll.js', [], $ver, ['in_footer' => true, 'strategy' => 'defer']);
        return $html;
    }

    /** Tests start clean. */
    public static function reset() {
        self::$done = false;
    }
}
