<?php
/**
 * A PART'S SETTING — what a built block's render.php prints for a value a person chose in the sidebar.
 *
 * Mark, 2026-10-10, the same audit that produced helpers.php: a kit part's settings (a stats part's counter duration,
 * a text/media part's text position, a divider's place) were each printed by 170 characters of inline PHP — a cast, a
 * guard, a ternary — and a stats block carried that blob sixteen times. The render file now says
 * `gcblite_setting($attributes, 'counter_duration', '2', '2')` and the rule lives here, once, tested.
 *
 * The rule has not changed: the stored value prints when it is a safe word (lower-case letters, digits, `_ . -`,
 * one to twelve of them), else the default; the word `drawn` — whether stored or the default — prints the value
 * the drawing itself carried. A block ejected to a site without GCB carries a copy of this file beside its
 * render.php, which is why the function is guarded with function_exists. Nothing here echoes: it returns the
 * escaped text to print inside an attribute.
 *
 * @package GCBLite\Render
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('gcblite_setting')) {
    /**
     * The value a part's attribute prints: the stored word when it is safe, else the default; `drawn` means the
     * drawing's own value. Attributes arrive as an array from the editor or an object from the REST API; a value
     * that is not a string — an array, an object, a number — is not a safe word and falls to the default.
     */
    function gcblite_setting($attributes, string $key, string $default, string $drawn = ''): string {
        if (is_object($attributes)) {
            $attributes = (array) $attributes;
        }
        $v = is_array($attributes) ? ($attributes[$key] ?? '') : '';
        $v = is_scalar($v) ? (string) $v : '';
        if (!preg_match('/^[a-z0-9_.-]{1,12}$/', $v)) {
            $v = $default;
        }
        return esc_attr($v === 'drawn' ? $drawn : $v);
    }
}
