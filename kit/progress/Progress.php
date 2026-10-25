<?php
/**
 * THE PROGRESS' SERVER HALF (2026-10-21): the bar, or the ring, drawn on the server at its value.
 *
 * A goal or a completion ("$12,400 of $20,000 raised", "Profile 60% complete", "Step 2 of 4") is a number the page
 * already knows when it is drawn. Drawn here, the bar is in the first paint (its fill playing from nothing by CSS alone,
 * kit/progress/style.css), on a page with no script, in the editor (which runs no part's script), and in the server's
 * markup a router swap puts back — so a swap moves nothing. The script (view.js) keeps it right after: a value the page
 * changes, words a swap changes, the fill held back until a bar below the fold is seen.
 *
 * THE VALUE: `data-value` and `data-max`; else the design's own words inside the part (a record's number field) — its
 * first number the value, a "%" after it out of 100, else its second number the most ("12,400 of 20,000"), else 100.
 * The same reading as the script's (value() there).
 *
 * WHAT IS DRAWN: Zag's progress anatomy (@zag-js/progress, what the script connects to): a track, role progressbar with
 * its aria values, and its range — in the design's `[data-gcb-kit-progress-bar]` when it draws one, else at the end of
 * the part; with `data-shape="circle"` (or "gauge", a half ring), the ring (an svg of two circles). The part's
 * `--percent` is the one number the look reads.
 *
 * THE DRAWING'S OWN, KEPT (2026-10-26, the kit wears the drawing): in the slot, a `[data-gcb-kit-progress-label]` (a
 * ring's "60%" in its middle) stays, and a drawn `[data-gcb-kit-progress-fill]` is the bar's range, its classes kept;
 * the rest of the slot is drawn afresh.
 *
 * @package GCBLite\Kit
 */

namespace GCBLite\Kit;

if (!defined('ABSPATH')) {
    exit;
}

final class Progress {

    /** @var int bars drawn on this page: each its ids, the same on every render of the page */
    private static $made = 0;

    public static function register_hooks() {
        /* after the kit filter (20), whose answer may hold the number; before the parts' own look is decided (30) */
        add_filter('render_block', [self::class, 'render'], 25, 1);
    }

    public static function render($html) {
        return is_string($html) ? self::drawn($html, static fn(): int => ++self::$made) : $html;
    }

    /** a number as a design writes it: "12,400" twelve thousand, "4,5" four and a half, "1 200" not two numbers */
    public static function number(string $s): ?float {
        $s = str_replace(["\u{00a0}", "\u{202f}", ' '], '', trim($s));
        if ($s === '') {
            return null;
        }
        if (preg_match('/^\d{1,3}(,\d{3})+(\.\d+)?$/', $s)) {
            $s = str_replace(',', '', $s);
        } else {
            $s = str_replace(',', '.', $s);
        }
        return is_numeric($s) ? (float) $s : null;
    }

    /**
     * The value and the most, from the attributes or the words — pure.
     *
     * @return array{0: float, 1: float} [value, max], the value within 0…max
     */
    public static function value(?string $value, ?string $max, string $words): array {
        $v = $value !== null && $value !== '' ? self::number($value) : null;
        $m = $max !== null && $max !== '' ? self::number($max) : null;
        if ($v === null || $m === null) {
            preg_match_all('/\d[\d,.\x{00a0}\x{202f}]*(?:\d)?\s*(%)?/u', $words, $found, PREG_SET_ORDER);
            $nums = [];
            foreach ($found as $f) {
                $n = self::number(rtrim(preg_replace('/\s*%$/', '', $f[0]), '.,'));
                if ($n !== null) {
                    $nums[] = [$n, !empty($f[1])];
                }
            }
            if ($v === null && $nums) {
                $v = $nums[0][0];
            }
            if ($m === null) {
                $m = $nums && $nums[0][1] ? 100.0 : (isset($nums[1]) ? $nums[1][0] : 100.0);
            }
        }
        $m = $m !== null && $m > 0 ? $m : 100.0;
        $v = max(0.0, min($m, $v ?? 0.0));
        return [$v, $m];
    }

    /** the part's words, each piece of them apart ("Uploading 45%", not "Uploading45%"), a "$" kept to its number */
    public static function words(\DOMXPath $x, \DOMElement $part): string {
        $bits = [];
        foreach ($x->query('.//text()', $part) as $t) {
            $bits[] = (string) $t->nodeValue;
        }
        return self::tidy(implode(' ', $bits));
    }

    public static function tidy(string $s): string {
        $s = trim(preg_replace('/\s+/u', ' ', $s));
        return preg_replace(['/([$£€¥#])\s+(?=\d)/u', '/\s+([%.,:;!?)])/u', '/([(])\s+/u'], ['$1', '$1', '$1'], $s);
    }

    /** a number said plainly: 12400, 4.5 */
    private static function said(float $n): string {
        return rtrim(rtrim(number_format($n, 4, '.', ''), '0'), '.');
    }

    /**
     * Each progress drawn at its value, unless it is drawn already — pure, and the same twice over.
     *
     * @param string        $html a rendered block
     * @param callable|null $next () => the next part's number on the page
     */
    public static function drawn(string $html, ?callable $next = null): string {
        if (strpos($html, 'data-gcb-kit="progress"') === false) {
            return $html;
        }
        $doc  = new \DOMDocument();
        $prev = libxml_use_internal_errors(true);
        $ok   = $doc->loadHTML('<?xml encoding="utf-8"?><div id="gcb-kp-root">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        $root = $ok ? $doc->getElementById('gcb-kp-root') : null;
        if (!$root) {
            return $html;
        }
        $x       = new \DOMXPath($doc);
        $changed = false;
        $n       = 0;
        foreach (iterator_to_array($x->query('.//*[@data-gcb-kit="progress"]', $root)) as $part) {
            if ($x->query('.//*[@data-scope="progress"][@data-part="track" or @data-part="circle"]', $part)->length) {
                continue;
            }
            $id     = 'gcb-progress-' . ($next ? (int) $next() : ++$n);
            $circle = in_array($part->getAttribute('data-shape'), ['circle', 'gauge'], true);
            $words  = self::words($x, $part);
            [$v, $m] = self::value(
                $part->hasAttribute('data-value') ? $part->getAttribute('data-value') : null,
                $part->hasAttribute('data-max') ? $part->getAttribute('data-max') : null,
                $words
            );
            $pct   = $m > 0 ? $v / $m * 100 : 0;
            $state = $v >= $m ? 'complete' : 'loading';
            $name  = $part->getAttribute('data-label') ?: (mb_strlen($words) > 0 && mb_strlen($words) <= 120 ? $words : 'Progress');

            $style = trim((string) $part->getAttribute('style'));
            $style = preg_replace('/(^|;)\s*--percent\s*:[^;]*;?/', '$1', $style);
            $part->setAttribute('style', ($style !== '' ? rtrim($style, '; ') . '; ' : '') . '--percent: ' . self::said(round($pct, 3)));

            $slot = $x->query('.//*[@data-gcb-kit-progress-bar]', $part)->item(0);
            if (!$slot instanceof \DOMElement) {
                $slot = $doc->createElement('span');
                $slot->setAttribute('data-gcb-kit-progress-bar', '');
                $part->appendChild($slot);
            }
            $keep = null;
            $fill = null;
            foreach (iterator_to_array($slot->childNodes) as $child) {
                if ($child instanceof \DOMElement && $child->hasAttribute('data-gcb-kit-progress-label')) {
                    $keep = $keep ?? $child;
                } elseif ($child instanceof \DOMElement && $child->hasAttribute('data-gcb-kit-progress-fill') && !$circle) {
                    $fill = $fill ?? $child;
                }
                $slot->removeChild($child);
            }
            $bar = [
                'role'          => 'progressbar',
                'aria-label'    => $name,
                'aria-valuemin' => '0',
                'aria-valuemax' => self::said($m),
                'aria-valuenow' => self::said($v),
                'aria-valuetext' => self::said(round($pct)) . '%',
                'data-state'    => $state,
            ];
            if ($circle) {
                $svg = $doc->createElement('svg');
                foreach (['data-scope' => 'progress', 'data-part' => 'circle', 'id' => $id . '-circle'] + $bar as $k => $val) {
                    $svg->setAttribute($k, $val);
                }
                foreach (['circle-track', 'circle-range'] as $p) {
                    $c = $doc->createElement('circle');
                    $c->setAttribute('data-scope', 'progress');
                    $c->setAttribute('data-part', $p);
                    if ($p === 'circle-range') {
                        $c->setAttribute('data-state', $state);
                        if ($v <= 0) {
                            $c->setAttribute('data-empty', '');
                        }
                    }
                    $svg->appendChild($c);
                }
                $slot->appendChild($svg);
            } else {
                foreach (['data-scope' => 'progress', 'data-part' => 'track', 'id' => $id . '-track', 'data-orientation' => 'horizontal'] + $bar as $k => $val) {
                    $slot->setAttribute($k, $val);
                }
                $range = $fill ?? $doc->createElement('span');
                $range->setAttribute('data-scope', 'progress');
                $range->setAttribute('data-part', 'range');
                $range->setAttribute('data-state', $state);
                $range->setAttribute('data-orientation', 'horizontal');
                $slot->appendChild($range);
            }
            if ($keep) {
                $slot->appendChild($keep);
            }
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
