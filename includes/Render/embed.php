<?php
/**
 * RENDER HELPERS, THE EMBED — a third-party widget a built block carries (Mark, 2026-10-10: "can gcb create a trust
 * pilot component on its own? … let's give it that ability").
 *
 * A widget is a provider's snippet: some markup (`<div class="trustpilot-widget" data-template-id="…">`) and a
 * `<script src>` from the provider's own host that finds that markup and draws into it. The `embed` field stores
 * the snippet as a site owner pastes it; the render calls gcblite_embed() and prints what comes back:
 *
 *   - a `<script src>` whose host is on the allow-list (`gcblite_embed_hosts` filter) is enqueued in the footer,
 *     once per address per request, its async / defer kept as the script's loading strategy. Called after
 *     wp_footer, when an enqueue would never print, the tag is printed inline instead — still once;
 *   - every other `<script>` is dropped: inline code, a script from a host nobody listed. A pasted snippet never
 *     runs code of its own;
 *   - the rest passes wp_kses with a widget-shaped allow-list (div, span, a, p, iframe, img, blockquote; the usual
 *     attributes and any data-*), an iframe only on https, HTML comments gone.
 *
 * Guarded with function_exists like helpers.php: a block ejected to a site without GCB carries a copy.
 *
 * @package GCBLite\Render
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('gcblite_embed_hosts')) {
    /**
     * The hosts a widget's script may load from. Exact host names, lowercase. Add a provider with
     * `add_filter('gcblite_embed_hosts', fn ($h) => array_merge($h, ['widget.example.com']));`.
     *
     * @return string[]
     */
    function gcblite_embed_hosts(): array {
        $hosts = array(
            'widget.trustpilot.com',
            'assets.calendly.com',
            'embed.typeform.com',
            'static.elfsight.com',
            'apps.elfsight.com',
            'widgets.sociablekit.com',
            'www.instagram.com',
            'platform.twitter.com',
        );
        if (function_exists('apply_filters')) {
            $filtered = apply_filters('gcblite_embed_hosts', $hosts);
            if (is_array($filtered)) {
                $hosts = $filtered;
            }
        }
        $out = array();
        foreach ($hosts as $h) {
            if (is_string($h) && trim($h) !== '') {
                $out[] = strtolower(trim($h));
            }
        }
        return array_values(array_unique($out));
    }
}

if (!function_exists('gcblite_embed_script_src')) {
    /**
     * A script address as it will load — `//host/x.js` and `http://` made https — when its host is on the
     * allow-list; '' otherwise.
     */
    function gcblite_embed_script_src(string $src): string {
        $src = trim(html_entity_decode($src, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        if (strpos($src, '//') === 0) {
            $src = 'https:' . $src;
        } elseif (stripos($src, 'http://') === 0) {
            $src = 'https://' . substr($src, 7);
        }
        if (stripos($src, 'https://') !== 0 || preg_match('/[\s"\'<>]/', $src)) {
            return '';
        }
        $host = strtolower((string) parse_url($src, PHP_URL_HOST));
        return $host !== '' && in_array($host, gcblite_embed_hosts(), true) ? $src : '';
    }
}

if (!function_exists('gcblite_embed_load')) {
    /**
     * Load one allowed widget script, once per address per request. Returns '' when it was enqueued (or already
     * loaded); the `<script>` tag to print when wp_footer has already run and an enqueue would never print.
     *
     * @param string $strategy 'async', 'defer' or ''.
     */
    function gcblite_embed_load(string $src, string $strategy = ''): string {
        if (!empty($GLOBALS['gcblite_embed_loaded'][$src])) {
            return '';
        }
        $GLOBALS['gcblite_embed_loaded'][$src] = true;
        $late = function_exists('did_action') && did_action('wp_footer');
        if ($late || !function_exists('wp_enqueue_script')) {
            $url = function_exists('esc_url') ? esc_url($src) : htmlspecialchars($src, ENT_QUOTES);
            return '<script src="' . $url . '"' . ($strategy !== '' ? ' ' . $strategy : '') . '></script>';
        }
        $handle = 'gcb-embed-' . md5($src);
        $args   = array('in_footer' => true);
        if ($strategy !== '') {
            $args['strategy'] = $strategy;
        }
        wp_enqueue_script($handle, $src, array(), null, $args);
        if ($strategy !== '' && function_exists('wp_script_add_data')) {
            wp_script_add_data($handle, 'strategy', $strategy);
        }
        return '';
    }
}

if (!function_exists('gcblite_embed_allowed_html')) {
    /** The wp_kses allow-list a widget's markup passes through. */
    function gcblite_embed_allowed_html(): array {
        $attrs = array(
            'class' => true, 'id' => true, 'style' => true, 'href' => true, 'target' => true, 'rel' => true,
            'src' => true, 'width' => true, 'height' => true, 'title' => true, 'allow' => true,
            'allowfullscreen' => true, 'loading' => true, 'alt' => true, 'data-*' => true,
        );
        $out = array();
        foreach (array('div', 'span', 'a', 'p', 'iframe', 'img', 'blockquote') as $tag) {
            $out[$tag] = $attrs;
        }
        return $out;
    }
}

if (!function_exists('gcblite_embed')) {
    /**
     * A widget, ready to print: the stored snippet, else the drawn one ($fallback). Its allowed scripts are loaded
     * (enqueued, or printed inline after wp_footer); every other script, every comment and anything the allow-list
     * does not name is gone.
     *
     * @param mixed  $value    the field's stored snippet
     * @param string $fallback the snippet the block was built with
     */
    function gcblite_embed($value, string $fallback = ''): string {
        $html = is_string($value) && trim($value) !== '' ? $value : $fallback;
        if (trim($html) === '') {
            return '';
        }
        $html = (string) preg_replace('/<!--.*?(?:-->|$)/s', '', $html);
        /* a <style> block's text would print as words once kses took its tags */
        $html = (string) preg_replace('#<style\b[^>]*>.*?(?:</style\s*>|$)#is', '', $html);
        $late = '';
        $html = (string) preg_replace_callback(
            '#<script\b([^>]*)>(.*?)(?:</script\s*>|$)#is',
            static function ($m) use (&$late) {
                if (trim($m[2]) !== '' || !preg_match('/(?:^|\s)src\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+))/i', $m[1], $s)) {
                    return ''; // inline code: never run
                }
                $src = gcblite_embed_script_src(($s[1] ?? '') !== '' ? $s[1] : (($s[2] ?? '') !== '' ? $s[2] : ($s[3] ?? '')));
                if ($src === '') {
                    return ''; // a host nobody listed
                }
                $strategy = preg_match('/(?:^|\s)async(?:[\s=]|$)/i', $m[1]) ? 'async'
                    : (preg_match('/(?:^|\s)defer(?:[\s=]|$)/i', $m[1]) ? 'defer' : '');
                $late .= gcblite_embed_load($src, $strategy);
                return '';
            },
            $html
        );
        /* an opening <script> with no end left over: its tag goes, kses takes the rest */
        $html = (string) preg_replace('#</?script\b[^>]*>#i', '', $html);
        $html = wp_kses($html, gcblite_embed_allowed_html());
        /* an iframe only on https: one on anything else goes, with what it holds */
        $html = (string) preg_replace_callback(
            '#<iframe\b([^>]*)>(.*?)(?:</iframe\s*>|$)#is',
            static function ($m) {
                return preg_match('/(?:^|\s)src\s*=\s*(["\']?)https:\/\//i', $m[1]) ? $m[0] : '';
            },
            $html
        );
        return trim($html) . $late;
    }
}
