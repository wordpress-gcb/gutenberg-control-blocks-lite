<?php
/**
 * SCRIPT SHELTER — a block's script reaches the browser as it was written.
 *
 * A built block prints its handler inline, inside post content, and
 * `the_content` runs the text filters AFTER the blocks are rendered: do_blocks
 * at 9, wptexturize at 10, convert_smilies at 20. WordPress means to leave a
 * <script> alone, but its tag splitter takes a bare `<` for the start of a
 * tag — `if (diff <= 0)` — loses track of the element, and from there rewrites
 * every `&&` as `&#038;&#038;`, including the one in the wrapper WE put round
 * every handler (matrix run mx2 / countdown on Astra, 2026-09-22: "Invalid or
 * unexpected token", on the real page only). One comparison and the whole
 * block is dead on every front end; the Studio and the editor never run
 * the_content, so nothing before the front look could see it.
 *
 * So inline scripts are lifted out of the content once the blocks have
 * rendered, held as comments the text filters pass over, and put back byte
 * for byte after the last of them. Nothing about a built block changes.
 *
 * Lived in gcb-pro for its first day; moved here 2026-09-22 — a block ejected
 * to a site that runs only gcb-lite carries the same inline script, and lite
 * is what renders it.
 *
 * @package GCBLite\Rendering
 */

namespace GCBLite\Rendering;

if (! defined('ABSPATH')) {
    exit;
}

final class ScriptShelter
{
    /** token → the script, exactly as rendered */
    private static array $held = array();
    private static int $n = 0;

    /** Is a page being assembled — one whose buffer will put the scripts back? */
    private static bool $open = false;

    /**
     * WHERE IT HOOKS, AND WHY NOT the_content (amended 2026-09-22, the same
     * night: mx3 / hero on Twenty Twenty-Five threw the same error AFTER the
     * first fix). A block theme texturizes TWICE — `the_content`, and then
     * `get_the_block_template_html()` runs wptexturize over the whole PAGE
     * with no hook between do_blocks and it. Handing the script back at
     * the_content@99 handed it straight to the second pass. So a gcb block's
     * script is lifted as the BLOCK renders — post content, a template part, a
     * pattern, all the same — and put back once, at the very end of the page.
     */
    public static function init(): void
    {
        add_action('template_redirect', array(self::class, 'open'), 0);
        add_filter('render_block', array(self::class, 'shelter_block'), 99, 2);
    }

    /** A front-end page begins: buffer it, so the last thing that happens to it is ours. */
    public static function open(): void
    {
        if (self::$open || (function_exists('is_feed') && is_feed())) {
            return;
        }
        self::$open = true;
        ob_start(array(self::class, 'restore'));
    }

    /** Only OUR blocks, and only while a page is open: with no buffer, nothing would put a script back. */
    public static function shelter_block($html, $block)
    {
        if (! self::$open || ! is_string($html)
            || strpos((string) (is_array($block) ? ($block['blockName'] ?? '') : ''), 'gcb/') !== 0) {
            return $html;
        }
        return self::shelter($html);
    }

    /** Tests have no template_redirect. */
    public static function open_for_tests(): void
    {
        self::$open = true;
    }

    /** Inline scripts out, a comment in the place of each. A script with a `src` has no body to harm. */
    public static function shelter($html)
    {
        if (! is_string($html) || stripos($html, '<script') === false) {
            return $html;
        }
        $out = preg_replace_callback(
            '#<script\b(?![^>]*\bsrc\s*=)[^>]*>.*?</script\s*>#is',
            static function (array $m): string {
                $token = 'gcb-script-' . (++self::$n) . '-' . substr(md5($m[0]), 0, 10);
                self::$held[$token] = $m[0];
                return '<!--' . $token . '-->';
            },
            $html
        );
        return is_string($out) ? $out : $html;
    }

    /** Each script back where its comment stands. The page's output buffer calls this last (PHP hands it a second argument). */
    public static function restore($html, $phase = 0)
    {
        if (! is_string($html) || self::$held === array() || strpos($html, '<!--gcb-script-') === false) {
            return $html;
        }
        foreach (self::$held as $token => $script) {
            $mark = '<!--' . $token . '-->';
            if (strpos($html, $mark) !== false) {
                $html = str_replace($mark, $script, $html);
                unset(self::$held[$token]);
            }
        }
        return $html;
    }

    /** Tests start clean. */
    public static function reset(): void
    {
        self::$held = array();
        self::$n    = 0;
        self::$open = false;
    }
}
