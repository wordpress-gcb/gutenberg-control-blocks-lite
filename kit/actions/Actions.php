<?php
/**
 * THE ACTIONS MENU'S SERVER HALF (2026-10-21): the box its list floats in, drawn on the server — the select's reason
 * (kit/select/Select.php). A card's ⋯ lives in a filter's results, which WordPress's router patches back to the server's
 * markup: a box the script made would be taken away, the list put back where it was drawn and Zag left placing a box
 * that is gone. Drawn here, the box — a popover in the top layer, above every section whatever stacks or clips them —
 * the trigger's and the list's ids (by which Zag finds them) and the list's tabindex are in the server's markup and the
 * browser's alike, so a swap moves nothing.
 *
 * @package GCBLite\Kit
 */

namespace GCBLite\Kit;

if (!defined('ABSPATH')) {
    exit;
}

final class Actions {

    /** @var int menus drawn on this page: each its ids, the same on every render of the page */
    private static $made = 0;

    public static function register_hooks() {
        /* with the select's box (25): before the parts' own look is decided (30) */
        add_filter('render_block', [self::class, 'render'], 25, 1);
    }

    public static function render($html) {
        return is_string($html) ? self::positioned($html, static fn(): int => ++self::$made) : $html;
    }

    /**
     * Each menu's list in a positioner (a popover), unless it is in one already, and its trigger, list and box their
     * ids and the list its tabindex, unless they have them — pure.
     *
     * @param string        $html a rendered block
     * @param callable|null $next () => the next menu's number on the page
     * @return string
     */
    public static function positioned(string $html, ?callable $next = null) {
        if (strpos($html, 'data-gcb-kit-actions-list') === false) {
            return $html;
        }
        $doc  = new \DOMDocument();
        $prev = libxml_use_internal_errors(true);
        $ok   = $doc->loadHTML('<?xml encoding="utf-8"?><div id="gcb-ka-root">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        $root = $ok ? $doc->getElementById('gcb-ka-root') : null;
        if (!$root) {
            return $html;
        }
        $x       = new \DOMXPath($doc);
        $changed = false;
        $n       = 0;
        $set     = static function (\DOMElement $e, string $k, string $v) use (&$changed) {
            if (!$e->hasAttribute($k)) {
                $e->setAttribute($k, $v);
                $changed = true;
            }
        };
        foreach (iterator_to_array($x->query('.//*[@data-gcb-kit="actions"]', $root)) as $menu) {
            $id      = 'gcb-actions-' . ($next ? (int) $next() : ++$n);
            $trigger = $x->query('.//*[@data-gcb-kit-actions-trigger]', $menu)->item(0);
            $list    = $x->query('.//*[@data-gcb-kit-actions-list]', $menu)->item(0);
            if ($trigger instanceof \DOMElement) {
                $set($trigger, 'id', $id . '-trigger');
            }
            if (!$list instanceof \DOMElement) {
                continue;
            }
            $set($list, 'id', $id . '-list');
            $set($list, 'tabindex', '0');
            $box = $list->parentNode instanceof \DOMElement && $list->parentNode->hasAttribute('data-gcb-kit-actions-positioner') ? $list->parentNode : null;
            if (!$box) {
                $box = $doc->createElement('div');
                $box->setAttribute('data-gcb-kit-actions-positioner', '');
                $list->parentNode->replaceChild($box, $list);
                $box->appendChild($list);
                $changed = true;
            }
            $set($box, 'id', $id . '-positioner');
            $set($box, 'popover', 'manual');
        }
        if (!$changed) {
            return $html;
        }
        $out = '';
        foreach (iterator_to_array($root->childNodes) as $c) {
            $out .= $doc->saveHTML($c);
        }
        return $out;
    }
}
