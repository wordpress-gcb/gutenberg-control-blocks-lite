<?php
/**
 * THE BREADCRUMBS' SERVER HALF (2026-10-21): what a screen reader needs, made true whatever the markup forgot.
 *
 * The trail is WordPress's own shape (core/breadcrumbs, WP 7: `<nav aria-label><ol><li><a>…` and the page last,
 * `aria-current="page"`); the kit draws its look (style.css). Here only: the nav named "Breadcrumb" when it is not
 * named, and the last item said to be the page (`aria-current="page"` on its link or its words) when no item is.
 *
 * @package GCBLite\Kit
 */

namespace GCBLite\Kit;

if (!defined('ABSPATH')) {
    exit;
}

final class Breadcrumbs {

    public static function register_hooks() {
        add_filter('render_block', [self::class, 'render'], 25, 1);
    }

    public static function render($html) {
        return is_string($html) ? self::named($html) : $html;
    }

    /** each trail named and its page said — pure, and the same twice over */
    public static function named(string $html): string {
        if (strpos($html, 'data-gcb-kit="breadcrumbs"') === false) {
            return $html;
        }
        $doc  = new \DOMDocument();
        $prev = libxml_use_internal_errors(true);
        $ok   = $doc->loadHTML('<?xml encoding="utf-8"?><div id="gcb-kb-root">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        $root = $ok ? $doc->getElementById('gcb-kb-root') : null;
        if (!$root) {
            return $html;
        }
        $x       = new \DOMXPath($doc);
        $changed = false;
        foreach (iterator_to_array($x->query('.//*[@data-gcb-kit="breadcrumbs"]', $root)) as $nav) {
            if (!$nav->hasAttribute('aria-label') && !$nav->hasAttribute('aria-labelledby')) {
                $nav->setAttribute('aria-label', 'Breadcrumb');
                $changed = true;
            }
            if ($x->query('.//*[@aria-current]', $nav)->length) {
                continue;
            }
            $items = $x->query('.//li', $nav);
            $last  = $items->length ? $items->item($items->length - 1) : null;
            if (!$last instanceof \DOMElement) {
                continue;
            }
            $said = null;
            foreach ($last->childNodes as $c) {
                if ($c instanceof \DOMElement) {
                    $said = $c;
                    break;
                }
            }
            ($said ?? $last)->setAttribute('aria-current', 'page');
            $changed = true;
        }
        if (!$changed) {
            return $html;
        }
        $out = '';
        foreach (iterator_to_array($root->childNodes) as $node) {
            $out .= $doc->saveHTML($node);
        }
        return $out;
    }
}
