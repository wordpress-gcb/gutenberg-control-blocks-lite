<?php
/**
 * THE SELECT'S SERVER HALF (2026-10-21): the box its list floats in, drawn on the server.
 *
 * The list floats over the page in a positioner Zag places. The script used to make that box in the browser, moving
 * the drawn list into it — and a filter answered on the server is swapped in place by WordPress's router, which put the
 * list back where the server drew it: out of the box, the focus of an open list lost with it, and Zag still holding the
 * old list as its open layer (the next press inside the new one read as a press outside, and the list shut). Drawn
 * here, the box is in the server's markup and the browser's alike, so a swap moves nothing. So are the parts' ids (the
 * script keeps the ids the page gives them) and the list's tabindex: a swap that took them away left an open list
 * unfocusable, and its focus went.
 *
 * @package GCBLite\Kit
 */

namespace GCBLite\Kit;

if (!defined('ABSPATH')) {
    exit;
}

final class Select {

    /** @var int selects drawn on this page: each its ids, the same on every render of the page */
    private static $made = 0;

    public static function register_hooks() {
        /* after the kit filter (20), which writes a select's options; before the parts' own look is decided (30) */
        add_filter('render_block', [self::class, 'render'], 25, 1);
    }

    public static function render($html) {
        return is_string($html) ? self::positioned($html, static fn(): int => ++self::$made) : $html;
    }

    /**
     * Each select's list in a positioner, unless it is in one already, and its trigger and list their ids and the
     * list its tabindex, unless they have them — pure.
     *
     * @param string        $html a rendered block
     * @param callable|null $next () => the next select's number on the page
     * @return string
     */
    public static function positioned(string $html, ?callable $next = null) {
        if (strpos($html, 'data-gcb-kit-select-list') === false) {
            return $html;
        }
        $doc  = new \DOMDocument();
        $prev = libxml_use_internal_errors(true);
        $ok   = $doc->loadHTML('<?xml encoding="utf-8"?><div id="gcb-ks-root">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        $root = $ok ? $doc->getElementById('gcb-ks-root') : null;
        if (!$root) {
            return $html;
        }
        $x       = new \DOMXPath($doc);
        $changed = false;
        $n       = 0;
        foreach (iterator_to_array($x->query('.//*[@data-gcb-kit="select"]', $root)) as $select) {
            $id      = 'gcb-select-' . ($next ? (int) $next() : ++$n);
            $trigger = $x->query('.//*[@data-gcb-kit-select-trigger]', $select)->item(0);
            $list    = $x->query('.//*[@data-gcb-kit-select-list]', $select)->item(0);
            if ($trigger instanceof \DOMElement && !$trigger->hasAttribute('id')) {
                $trigger->setAttribute('id', $id . '-trigger');
                $changed = true;
            }
            if (!$list instanceof \DOMElement) {
                continue;
            }
            if (!$list->hasAttribute('id')) {
                $list->setAttribute('id', $id . '-list');
                $changed = true;
            }
            if (!$list->hasAttribute('tabindex')) {
                $list->setAttribute('tabindex', '0');
                $changed = true;
            }
            if ($list->parentNode instanceof \DOMElement && $list->parentNode->hasAttribute('data-gcb-kit-select-positioner')) {
                continue;
            }
            $box = $doc->createElement('div');
            $box->setAttribute('data-gcb-kit-select-positioner', '');
            $list->parentNode->replaceChild($box, $list);
            $box->appendChild($list);
            $changed = true;
        }
        if (!$changed) {
            return $html;
        }
        $out = '';
        foreach (iterator_to_array($root->childNodes) as $n) {
            $out .= $doc->saveHTML($n);
        }
        return $out;
    }
}
