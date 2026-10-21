<?php
/**
 * THE COMBOBOX'S SERVER HALF (2026-10-21): its options from the site's terms, and the box its list floats in.
 *
 * THE SITE'S TERMS AS ITS OPTIONS: `<div data-gcb-kit="combobox" data-gcb-terms="location">` takes an <option> a term of
 * that taxonomy, by its name — into the part's <select> when it holds one, else into its <datalist> (made, and named by
 * the input's `list`, when none is drawn: before the script the browser's own suggestions; after it, the kit's). Drawn
 * before gcb-pro's term strip (render_block 9), which would otherwise take the part for a strip and copy its first
 * child a term; the part is marked data-gcb-terms-filled, which the strip passes by. No AJAX: every term is in the page.
 *
 * THE BOX ITS LIST FLOATS IN, as kit/select's (Select.php): a positioner round the list, a popover the script shows in
 * the top layer, with the ids by which Zag finds the input, the list and the box — drawn here so a router swap, which
 * puts back the server's markup, moves nothing. A select's choice (the kit filter's, drawn at 20) is said in the box
 * typed in, so the first paint and a swap show it.
 *
 * @package GCBLite\Kit
 */

namespace GCBLite\Kit;

if (!defined('ABSPATH')) {
    exit;
}

final class Combobox {

    /** @var int comboboxes drawn on this page: each its ids, the same on every render of the page */
    private static $made = 0;

    public static function register_hooks() {
        /* the terms before the term strip (9); the box after the kit filter (20), which writes a select's options */
        add_filter('render_block', [self::class, 'terms'], 8, 1);
        add_filter('render_block', [self::class, 'render'], 25, 1);
    }

    public static function terms($html) {
        return is_string($html) ? self::prepare($html, [self::class, 'names'], static fn(): int => ++self::$made) : $html;
    }

    public static function render($html) {
        return is_string($html) ? self::prepare($html, null, static fn(): int => ++self::$made) : $html;
    }

    /** a taxonomy's term names, by name */
    public static function names(string $taxonomy): array {
        if (!function_exists('taxonomy_exists') || !taxonomy_exists($taxonomy)) {
            return [];
        }
        $names = get_terms(['taxonomy' => $taxonomy, 'hide_empty' => false, 'fields' => 'names', 'orderby' => 'name']);
        return is_array($names) ? array_values(array_map('strval', $names)) : [];
    }

    /**
     * Each combobox: its terms (when asked for and $terms given), its list in a positioner, the ids, and a select's
     * choice in its box — pure, and the same twice over.
     *
     * @param string        $html     a rendered block
     * @param callable|null $terms_of (taxonomy) => term names; null leaves the terms alone
     * @param callable|null $next     () => the next combobox's number on the page
     * @return string
     */
    public static function prepare(string $html, ?callable $terms_of = null, ?callable $next = null) {
        if (strpos($html, 'data-gcb-kit="combobox"') === false) {
            return $html;
        }
        $doc  = new \DOMDocument();
        $prev = libxml_use_internal_errors(true);
        $ok   = $doc->loadHTML('<?xml encoding="utf-8"?><div id="gcb-kc-root">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        $root = $ok ? $doc->getElementById('gcb-kc-root') : null;
        if (!$root) {
            return $html;
        }
        $x       = new \DOMXPath($doc);
        $changed = false;
        $n       = 0;
        $set     = static function (\DOMElement $e, string $k, string $v) use (&$changed): void {
            if ($e->getAttribute($k) !== $v || !$e->hasAttribute($k)) {
                $e->setAttribute($k, $v);
                $changed = true;
            }
        };
        foreach (iterator_to_array($x->query('.//*[@data-gcb-kit="combobox"]', $root)) as $box) {
            $input  = $x->query('.//input[not(@type="hidden")]', $box)->item(0);
            $list   = $x->query('.//*[@data-gcb-kit-combobox-list]', $box)->item(0);
            $select = $x->query('.//select', $box)->item(0);
            $mark   = $x->query('.//*[@data-gcb-kit-combobox-positioner][@id]', $box)->item(0);
            /* the number it was given before (the terms' pass) is its number now: one set of ids a part */
            $was = $mark instanceof \DOMElement ? (string) $mark->getAttribute('id') : '';
            $id  = preg_match('/^(.+)-positioner$/', $was, $m) ? $m[1] : '';
            if ($id === '') {
                $id = 'gcb-combobox-' . ($next ? (int) $next() : ++$n);
            }

            /* THE TERMS */
            $tax = (string) $box->getAttribute('data-gcb-terms');
            if ($terms_of && $tax !== '' && !$box->hasAttribute('data-gcb-terms-filled')) {
                $set($box, 'data-gcb-terms-filled', '');
                $into = $select;
                if (!$into instanceof \DOMElement) {
                    $into = $x->query('.//datalist', $box)->item(0);
                }
                if (!$into instanceof \DOMElement) {
                    $into = $doc->createElement('datalist');
                    $box->appendChild($into);
                    $changed = true;
                }
                if (!$select && !$into->hasAttribute('id')) {
                    $into->setAttribute('id', $id . '-options');
                }
                if (!$select && $input instanceof \DOMElement && !$input->hasAttribute('list')) {
                    $input->setAttribute('list', $into->getAttribute('id'));
                }
                $have = [];
                foreach ($into->getElementsByTagName('option') as $o) {
                    $have[mb_strtolower((string) $o->getAttribute('value'))] = true;
                }
                foreach ((array) call_user_func($terms_of, $tax) as $name) {
                    $name = trim((string) $name);
                    if ($name === '' || isset($have[mb_strtolower($name)])) {
                        continue;
                    }
                    $have[mb_strtolower($name)] = true;
                    $o = $doc->createElement('option');
                    $o->setAttribute('value', $name);
                    if ($select) {
                        $o->appendChild($doc->createTextNode($name));
                    }
                    $into->appendChild($o);
                    $changed = true;
                }
            }

            /* THE IDS AND THE BOX */
            if ($input instanceof \DOMElement && !$input->hasAttribute('id')) {
                $set($input, 'id', $id . '-input');
            }
            if ($input instanceof \DOMElement && !$input->hasAttribute('class') && !$input->hasAttribute('data-gcb-kit-control')) {
                $set($input, 'data-gcb-kit-control', ''); // the kit's input (controls.css), unless the design drew its own
            }
            $label = $x->query('.//label', $box)->item(0);
            if ($label instanceof \DOMElement && $input instanceof \DOMElement && !$label->hasAttribute('for')) {
                $set($label, 'for', $input->getAttribute('id'));
            }
            if (!$list instanceof \DOMElement) {
                continue;
            }
            if (!$list->hasAttribute('id')) {
                $set($list, 'id', $id . '-list');
            }
            $pos = $list->parentNode instanceof \DOMElement && $list->parentNode->hasAttribute('data-gcb-kit-combobox-positioner') ? $list->parentNode : null;
            if (!$pos) {
                $pos = $doc->createElement('div');
                $pos->setAttribute('data-gcb-kit-combobox-positioner', '');
                $list->parentNode->replaceChild($pos, $list);
                $pos->appendChild($list);
                $changed = true;
            }
            if (!$pos->hasAttribute('id')) {
                $set($pos, 'id', $id . '-positioner');
            }
            if (!$pos->hasAttribute('popover')) {
                $set($pos, 'popover', 'manual');
            }

            /* A SELECT'S CHOICE IN THE BOX: its words, so the first paint and a swap say it */
            if ($select instanceof \DOMElement && $input instanceof \DOMElement) {
                $said = '';
                foreach ($select->getElementsByTagName('option') as $o) {
                    if ($o->hasAttribute('selected') && (string) $o->getAttribute('value') !== '') {
                        $said = trim((string) $o->textContent) ?: (string) $o->getAttribute('value');
                        break;
                    }
                }
                if ($said !== '') {
                    $set($input, 'value', $said);
                } elseif ($input->hasAttribute('value')) {
                    $input->removeAttribute('value');
                    $changed = true;
                }
            }
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
