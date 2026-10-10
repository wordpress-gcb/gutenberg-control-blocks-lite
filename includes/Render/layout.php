<?php
/**
 * LAYOUT CSS — what a built block's render.php prints to place the boxes of a grid the way a person arranged them.
 *
 * Mark, 2026-10-10, the same reading of a generated render file as helpers.php: a list with the Layout control
 * carried a nine-line inline PHP block — a `class_exists` guard, a count of the inner blocks, two hand-built
 * selectors and the `<style>` echo — and a grid of fixed boxes carried one such block per grid. The render file now
 * says WHAT it prints — `gcblite_layout_css($attributes, 'layout', $gcb_layout_id, …)` — and the HOW lives here, once,
 * tested. The CSS itself is still gcb-lite's contract (\GCBLite\Contract\Fields::layout_css): this file only wraps
 * it. Where that class is not loaded the grid stands as drawn, which is what the guard always meant.
 *
 * Guarded with function_exists like helpers.php, so a copy may travel with an ejected block.
 *
 * @package GCBLite\Render
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('gcblite_layout_count')) {
    /**
     * How many items a list holds: the block's inner blocks (WordPress hands a WP_Block_List — Countable, never cast
     * to an array: it has three properties of its own), a plain number, else $default — enough for any list a
     * person is likely to draw.
     */
    function gcblite_layout_count($count, $default = 24) {
        if (is_int($count) || (is_string($count) && is_numeric($count))) {
            return max(1, (int) $count);
        }
        if (is_object($count) && isset($count->inner_blocks) && (is_array($count->inner_blocks) || $count->inner_blocks instanceof \Countable)) {
            return max(1, count($count->inner_blocks));
        }
        return max(1, (int) $default);
    }
}

if (!function_exists('gcblite_layout_css')) {
    /**
     * The `<style>` that places a grid's boxes as a person arranged them in the Layout control — or '' when nothing is
     * stored, when they kept the drawn layout, when the value does not fit the control's limits, or where gcb-lite's
     * Contract\Fields is not loaded. The grid element carries `data-gcb-layout="$id"`; the rules address it by that
     * mark (written twice, so they beat the design's own utility classes) and its boxes as its direct children.
     *
     * @param array|object $attributes the block's attributes
     * @param string       $key        the layout field's attribute key: 'layout', 'layout2', …
     * @param string       $id         the grid's mark, from wp_unique_id('gcb-l-'); letters, digits, - and _ only
     * @param array        $limits     the control's limits — cols, minItemPx, containerPx, gapPx (Fields::layout_limits)
     * @param int|object   $count      how many boxes: a number for a grid of fixed boxes, or the $block whose inner
     *                                 blocks are a list's items (gcblite_layout_count)
     */
    function gcblite_layout_css($attributes, $key, $id, array $limits, $count = 24) {
        if (!class_exists('\GCBLite\Contract\Fields')) {
            return '';
        }
        $id = preg_replace('/[^A-Za-z0-9_-]/', '', (string) $id);
        if ($id === '') {
            return '';
        }
        $attributes = is_object($attributes) ? (array) $attributes : $attributes;
        $value = is_array($attributes) ? ($attributes[(string) $key] ?? null) : null;
        $list  = '[data-gcb-layout="' . $id . '"][data-gcb-layout]';
        $item  = '[data-gcb-layout="' . $id . '"]>:nth-child(%d)';
        $css   = \GCBLite\Contract\Fields::layout_css($value, $limits, gcblite_layout_count($count), $list, $item);
        return $css === '' ? '' : '<style>' . $css . '</style>';
    }
}
