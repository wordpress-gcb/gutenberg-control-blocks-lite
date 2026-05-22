<?php
/**
 * Pulls just the component HTML out of a Next.js page response.
 *
 * Contract with the component server:
 *   The Next.js route at /wordpress/render/{slug} wraps its component in
 *   <wp-block-wrapper data-block-name="{slug}" data-cache-timestamp="{ts}">...
 *   We rewrite that to HTML comment markers and extract everything between
 *   them. Everything else from the Next.js page (doctype, head, scripts,
 *   styles) is discarded — those don't belong in a Gutenberg preview.
 *
 * Lifted from the full plugin's Rendering\Shared\TemplateExecutor.
 *
 * @package GCBLite\Rendering
 */

namespace GCBLite\Rendering;

if (!defined('ABSPATH')) {
    exit;
}

class HtmlExtractor {

    /**
     * @param string $html Raw response body from the component server
     * @return array{ html: string, modified: ?string }
     *     html     — extracted component HTML (no scripts/styles/links)
     *     modified — cache-busting timestamp the component server emitted, or null
     */
    public static function extract($html) {
        // Step 1: convert <wp-block-wrapper> tags into comment markers and
        // surface the cache timestamp as a separate sibling comment.
        $html = preg_replace_callback(
            '/<wp-block-wrapper\s+data-block-name="([^"]+)"(?:\s+data-cache-timestamp="([^"]+)")?>(.+?)<\/wp-block-wrapper>/s',
            function ($matches) {
                $name = $matches[1];
                $ts   = $matches[2] ?? '';
                $body = $matches[3];
                $out  = '';
                if ($ts !== '') {
                    $out .= "<!-- gcblite-modified:{$ts} -->";
                }
                $out .= "<!-- WP-BLOCK-START:{$name} -->{$body}<!-- WP-BLOCK-END:{$name} -->";
                return $out;
            },
            $html
        );

        // Step 2: pull the cache timestamp back out (we return it separately
        // so the caller can decide whether to reuse cached HTML).
        $modified = null;
        if (preg_match('/<!-- gcblite-modified:(\d+) -->/', $html, $m)) {
            $modified = $m[1];
            $html = preg_replace('/<!-- gcblite-modified:\d+ -->/', '', $html);
        }

        // Step 3: extract between markers. Anything outside is by definition
        // not the component — discard it.
        if (preg_match('/<!-- WP-BLOCK-START:([^>]+) -->(.*)<!-- WP-BLOCK-END:\1 -->/s', $html, $m)) {
            $component = $m[2];

            // Defense in depth — the component server shouldn't be emitting
            // these inside the wrapper, but strip them in case.
            $component = preg_replace('/<script\b[^>]*>.*?<\/script>/is', '', $component);
            $component = preg_replace('/<style\b[^>]*>.*?<\/style>/is', '', $component);
            $component = preg_replace('/<link\b[^>]*>/i', '', $component);

            return ['html' => trim($component), 'modified' => $modified];
        }

        // No markers — component server is misconfigured or returned an error
        // page. Caller should treat as failure.
        return ['html' => '', 'modified' => $modified];
    }
}
