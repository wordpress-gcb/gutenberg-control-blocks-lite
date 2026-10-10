<?php
/**
 * CLEAN MARKUP — a visitor's page carries no editor identifiers.
 *
 * Every element a built block renders carries `data-gcb="y4ikro"`: the id the
 * studio and the marks mode use to point at a thing ("that heading, make it
 * smaller"). A review (2026-10-10) found 1291 of them across 231 render files,
 * shipped to every visitor. On the front end exactly one script reads them —
 * gcb-pro's assets/gcb-marks.js, enqueued only for a signed-in builder with
 * the admin bar (gcb-pro includes/AI/Marks.php, enqueue()). For everyone else
 * they are dead weight, and a tour of the plugin's internals.
 *
 * The same goes for `data-gcb-placeholder="Scroll to see…"`, kimi's switch for
 * the studio preview's throwaway scroll boxes (gcb-pro src/manuscript/
 * placeholder.js): read by the preview's document builder and by nothing a
 * visitor loads.
 *
 * So, when the marks script is not going to be on the page — not the editor,
 * not a REST render, no admin bar — the two attributes come off every gcb
 * block as it renders. The condition mirrors Marks.php's so a builder who IS
 * signed in keeps the ids the marks need. Nothing else is touched: the
 * `data-gcb-*` family (`-field`, `-kit`, `-layout`, `-repeater`, …) is read
 * by the kit and the field scripts and stays exactly as rendered.
 *
 * @package GCBLite\Frontend
 */

namespace GCBLite\Frontend;

if (!defined('ABSPATH')) {
    exit;
}

class CleanMarkup {

    /**
     * After InnerBlocksReplacer (10) has put the inner content in, before
     * ScriptShelter (99) lifts the scripts out.
     */
    const PRIORITY = 20;

    /** the decision for this request, made once; null until asked */
    private static $cleaning = null;

    public static function init() {
        add_filter('render_block', [__CLASS__, 'clean_block'], self::PRIORITY, 2);
    }

    /**
     * Our blocks only, and only on a page the marks script will not be on.
     *
     * @param string $html  the rendered block
     * @param array  $block the parsed block
     * @return string the block, with the editor's ids gone
     */
    public static function clean_block($html, $block) {
        if (!is_string($html) || $html === '') {
            return $html;
        }
        $name = is_array($block) ? (string) ($block['blockName'] ?? '') : '';
        if (strpos($name, 'gcb/') !== 0 || !self::cleaning()) {
            return $html;
        }
        return self::strip($html);
    }

    /**
     * Is this a page to clean? The inverse of Marks::enqueue()'s condition:
     * the editor and a REST render keep everything (the studio and the block
     * editor read the ids); a signed-in builder with the admin bar keeps them
     * for the marks script. Everyone else is a visitor.
     */
    public static function cleaning() {
        if (self::$cleaning !== null) {
            return self::$cleaning;
        }
        if (function_exists('is_admin') && is_admin()) {
            return self::$cleaning = false;
        }
        if (defined('REST_REQUEST') && REST_REQUEST) {
            return self::$cleaning = false;
        }
        if (function_exists('wp_is_serving_rest_request') && wp_is_serving_rest_request()) {
            return self::$cleaning = false;
        }
        if (function_exists('is_admin_bar_showing') && is_admin_bar_showing()) {
            return self::$cleaning = false;
        }
        return self::$cleaning = true;
    }

    /**
     * The regex, on its own: `data-gcb` and `data-gcb-placeholder` off every
     * tag, nothing else.
     *
     * Attributes are found only INSIDE a tag (so a paragraph that mentions the
     * word is left alone), the tag match steps over quoted values (so a `>`
     * inside a label does not end it early), and the attribute match insists
     * on a terminator after the name — whitespace, `/` or `>` — so
     * `data-gcb-field` and the rest of the family can never be taken for it.
     * Double-quoted, single-quoted, unquoted and valueless forms all go.
     *
     * @param string $html rendered markup
     * @return string the same markup without the editor's attributes
     */
    public static function strip(string $html): string {
        if (strpos($html, 'data-gcb') === false) {
            return $html;
        }
        $out = preg_replace_callback(
            '/<[a-zA-Z][^>"\']*(?:(?:"[^"]*"|\'[^\']*\')[^>"\']*)*>/',
            static function (array $m): string {
                $tag = $m[0];
                if (strpos($tag, 'data-gcb') === false) {
                    return $tag;
                }
                $clean = preg_replace(
                    '/\s+data-gcb(?:-placeholder)?(?:\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s"\'=<>`]+))?(?=[\s\/>])/i',
                    '',
                    $tag
                );
                return is_string($clean) ? $clean : $tag;
            },
            $html
        );
        return is_string($out) ? $out : $html;
    }

    /** Tests decide the page afresh. */
    public static function reset() {
        self::$cleaning = null;
    }
}
