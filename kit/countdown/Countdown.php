<?php
/**
 * THE COUNTDOWN'S SERVER HALF (2026-10-21): the time left, said in the page as it is drawn.
 *
 * "Sale ends in 2d 04h 12m" is true when the page is drawn: the slots the design drew are filled here with the time left
 * at that moment, so a page with no script, the editor (which runs no part's script) and the server's markup a router
 * swap puts back all say something true. The script (view.js) then counts it down each second from the visitor's clock.
 *
 * THE TIME: `data-until` is an ISO 8601 moment, its offset the truth ("2026-12-01T09:00:00+10:30"). One written without
 * an offset is the site's time (WordPress's time zone setting), and is written back with that offset, so the browser
 * reads the same moment the server did.
 *
 * THE SLOTS: `[data-gcb-kit-countdown-part="days|hours|minutes|seconds"]`. The largest the design drew holds all of the
 * time above it (no days slot: 50 hours); the smallest is rounded up (no seconds slot: 12 minutes 30 seconds says 13
 * minutes), so it never says nothing is left while something is. Hours, minutes and seconds are two digits.
 *
 * DONE: the part is marked `data-done` when the time is up; the look (style.css) then shows its
 * `[data-gcb-kit-countdown-done]` and hides its `[data-gcb-kit-countdown-left]` — one attribute, drawn here, so a swap
 * keeps it.
 *
 * @package GCBLite\Kit
 */

namespace GCBLite\Kit;

if (!defined('ABSPATH')) {
    exit;
}

final class Countdown {

    const UNITS = ['days' => 86400, 'hours' => 3600, 'minutes' => 60, 'seconds' => 1];

    public static function register_hooks() {
        add_filter('render_block', [self::class, 'render'], 25, 1);
    }

    public static function render($html) {
        return is_string($html) ? self::drawn($html, time(), function_exists('wp_timezone') ? wp_timezone() : null) : $html;
    }

    /** the moment `data-until` names, in seconds; null when it names none */
    public static function until(string $iso, ?\DateTimeZone $site = null): ?\DateTimeImmutable {
        $iso = trim($iso);
        if ($iso === '') {
            return null;
        }
        try {
            $at = new \DateTimeImmutable($iso, $site ?? new \DateTimeZone('UTC'));
        } catch (\Exception $e) {
            return null;
        }
        return $at;
    }

    /** an ISO moment written with its offset (Z, +10:30, -0500) */
    public static function has_offset(string $iso): bool {
        return (bool) preg_match('/(?:[zZ]|[+-]\d{2}:?\d{2})$/', trim($iso));
    }

    /**
     * The time left split into the slots drawn — pure (the script's split() is the same).
     *
     * @param int      $left  seconds left (0 or less: none)
     * @param string[] $units the slots drawn, by name
     * @return array<string,int>
     */
    public static function split(int $left, array $units): array {
        $have = array_values(array_filter(array_keys(self::UNITS), static fn($u) => in_array($u, $units, true)));
        if (!$have || $left <= 0) {
            return array_fill_keys($have, 0);
        }
        $small = self::UNITS[end($have)];
        $left  = (int) (ceil($left / $small) * $small);
        $out   = [];
        foreach ($have as $u) {
            $out[$u] = intdiv($left, self::UNITS[$u]);
            $left   -= $out[$u] * self::UNITS[$u];
        }
        return $out;
    }

    public static function said(string $unit, int $n): string {
        return $unit === 'days' ? (string) $n : str_pad((string) $n, 2, '0', STR_PAD_LEFT);
    }

    /**
     * Each countdown's slots filled for the moment $now, its done said, its until given an offset — pure.
     *
     * @param string             $html a rendered block
     * @param int                $now  the moment it is drawn (unix seconds)
     * @param \DateTimeZone|null $site the site's time zone, for an until written without an offset
     */
    public static function drawn(string $html, int $now, ?\DateTimeZone $site = null): string {
        if (strpos($html, 'data-gcb-kit="countdown"') === false) {
            return $html;
        }
        $doc  = new \DOMDocument();
        $prev = libxml_use_internal_errors(true);
        $ok   = $doc->loadHTML('<?xml encoding="utf-8"?><div id="gcb-kcd-root">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        $root = $ok ? $doc->getElementById('gcb-kcd-root') : null;
        if (!$root) {
            return $html;
        }
        $x       = new \DOMXPath($doc);
        $changed = false;
        foreach (iterator_to_array($x->query('.//*[@data-gcb-kit="countdown"]', $root)) as $part) {
            $iso = (string) $part->getAttribute('data-until');
            $at  = self::until($iso, $site);
            if (!$at) {
                continue;
            }
            $changed = true;
            if (!self::has_offset($iso)) {
                $part->setAttribute('data-until', $at->format('Y-m-d\TH:i:sP'));
            }
            $left  = $at->getTimestamp() - $now;
            $slots = [];
            foreach ($x->query('.//*[@data-gcb-kit-countdown-part]', $part) as $slot) {
                $slots[] = $slot;
            }
            $units = array_map(static fn($s) => (string) $s->getAttribute('data-gcb-kit-countdown-part'), $slots);
            $time  = self::split($left, $units);
            foreach ($slots as $slot) {
                $unit = (string) $slot->getAttribute('data-gcb-kit-countdown-part');
                if (isset($time[$unit])) {
                    $slot->textContent = self::said($unit, $time[$unit]);
                }
            }
            if ($left <= 0) {
                $part->setAttribute('data-done', '');
            } else {
                $part->removeAttribute('data-done');
            }
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
