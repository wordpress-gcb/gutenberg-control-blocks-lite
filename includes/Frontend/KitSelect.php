<?php
/**
 * THE KIT'S FORM PARTS, LOADED WHERE THEY ARE USED (Mark, 2026-10-19: "zag sounds good … both can be uniform"). One
 * select and one slider for GCB Pro's built sections and GCB Forms (src/kit/<part>.js on Zag, assets/kit/<part>.css):
 * any block whose output holds a `data-gcb-kit="<part>"` brings that part's script module and defaults onto the page;
 * a page without one carries neither.
 *
 * @package GCBLite\Frontend
 */

namespace GCBLite\Frontend;

if (!defined('ABSPATH')) {
    exit;
}

class KitSelect {

    /** the parts, each its module build/modules/kit-<part>.js and its defaults assets/kit/<part>.css: the select, the
     slider, the dates (a from, a to and a calendar) */
    const PARTS = ['select', 'slider', 'dates'];

    public static function init() {
        add_action('init', [__CLASS__, 'register']);
        add_filter('render_block', [__CLASS__, 'note'], 10, 1);
        add_filter('render_block', [__CLASS__, 'own'], 30, 1);
    }

    /** the controls a part's look reaches into, beside the parts themselves (any data-gcb-kit-* attribute) */
    const CONTROLS = ['DETAILS', 'SUMMARY', 'INPUT', 'SELECT', 'BUTTON'];

    /**
     * WHICH PARTS ARE THE DESIGN'S, decided once from the markup as written (Mark, 2026-10-19: "when i hover over
     * something it breaks"). A part's look is for a bare part; a part the design gave classes to is the design's. The
     * test was once :not([class]) in the CSS — but the page adds classes as it runs (gcb-hover under the pointer, and
     * `class=""` left when it goes; an Interactivity class binding), and every one took the part's look away. So the
     * classes as written are read here and a part with any is stamped `data-gcb-own`; the CSS asks for that, and
     * nothing a script adds later changes the answer. A class only a `data-wp-class--` binding sets is not the
     * design's. Runs after the kit's own filters (20) and before the Interactivity API processes directives.
     */
    public static function own($content) {
        if (!is_string($content) || strpos($content, 'data-gcb-kit="') === false || !class_exists('WP_HTML_Tag_Processor')) {
            return $content;
        }
        $p = new \WP_HTML_Tag_Processor($content);
        while ($p->next_tag()) {
            if ($p->is_tag_closer() || $p->get_attribute('data-gcb-own') !== null) {
                continue;
            }
            if (!in_array($p->get_tag(), self::CONTROLS, true) && !$p->get_attribute_names_with_prefix('data-gcb-kit')) {
                continue;
            }
            $class = $p->get_attribute('class');
            if (!is_string($class) || trim($class) === '') {
                continue;
            }
            $bound = array_map(
                static fn ($a) => substr($a, strlen('data-wp-class--')),
                (array) $p->get_attribute_names_with_prefix('data-wp-class--')
            );
            if (array_diff(preg_split('/\s+/', trim($class)), $bound)) {
                $p->set_attribute('data-gcb-own', '');
            }
        }
        return $p->get_updated_html();
    }

    public static function register() {
        /* the grid every part stands on (assets/kit/tokens.css): with any kit part, GCB Pro's included */
        $tokens = GCBLITE_PLUGIN_DIR . 'assets/kit/tokens.css';
        if (file_exists($tokens)) {
            wp_register_style('gcblite-kit-tokens', GCBLITE_PLUGIN_URL . 'assets/kit/tokens.css', [], (string) filemtime($tokens));
        }
        foreach (self::PARTS as $part) {
            $asset = GCBLITE_PLUGIN_DIR . 'build/modules/kit-' . $part . '.asset.php';
            $css   = GCBLITE_PLUGIN_DIR . 'assets/kit/' . $part . '.css';
            if (function_exists('wp_register_script_module') && file_exists($asset)) {
                $a = require $asset;
                wp_register_script_module('gcblite/kit-' . $part, GCBLITE_PLUGIN_URL . 'build/modules/kit-' . $part . '.js', (array) ($a['dependencies'] ?? []), (string) ($a['version'] ?? GCBLITE_VERSION));
            }
            if (file_exists($css)) {
                wp_register_style('gcblite-kit-' . $part, GCBLITE_PLUGIN_URL . 'assets/kit/' . $part . '.css', ['gcblite-kit-tokens'], (string) filemtime($css));
            }
        }
    }

    /** a block that draws a kit part brings its script and its defaults */
    public static function note($content) {
        if (!is_string($content) || strpos($content, 'data-gcb-kit="') === false) {
            return $content;
        }
        wp_enqueue_style('gcblite-kit-tokens'); // any kit part, on the page and the editor's canvas
        if (is_admin()) {
            return $content;
        }
        foreach (self::PARTS as $part) {
            if (strpos($content, 'data-gcb-kit="' . $part . '"') !== false) {
                if (function_exists('wp_enqueue_script_module')) {
                    wp_enqueue_script_module('gcblite/kit-' . $part);
                }
                wp_enqueue_style('gcblite-kit-' . $part);
            }
        }
        return $content;
    }
}
