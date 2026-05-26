<?php
/**
 * Author-facing helpers for the click-to-focus-Inspector affordance.
 *
 * Render.php templates can tag elements that should jump to a specific
 * Inspector field on click. The attribute name is decided by the
 * `gcblite_focus_field_attribute` filter — whatever the site returns
 * is what the editor JS listens for AND what these helpers emit.
 *
 * The default value lives in EditorAssets::localize() (one source of
 * truth). If a site returns an empty string from the filter, that's a
 * deliberate opt-out: the helpers emit nothing and the click handler
 * has nothing to bind to.
 *
 * Use the helpers below from render.php so the markup always tracks
 * whichever attribute the site is configured to use, and you don't
 * have to know the filter name:
 *
 *   <span <?php echo gcb_focus_attr('eyebrow'); ?>>...</span>
 *
 *   // Or print without echoing:
 *   <?php gcb_focus('eyebrow'); ?>
 *
 * @package GCBLite\FocusField
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('gcb_focus_field_attribute_name')) {
    /**
     * The configured attribute name. Resolution order:
     *
     *   1. `gcblite_focus_field_attribute` filter return value
     *   2. Plugin default: `data-focus-field`
     *
     * A site that returns the empty string from the filter is opting
     * out — the helpers below emit nothing and the click handler skips
     * binding. A site that returns a non-string is treated the same.
     *
     * The default is intentionally specific (`data-focus-field`) so the
     * out-of-box behaviour is the affordance working. Sites that want
     * to disable, rename, or namespace it have a single point of control.
     */
    function gcb_focus_field_attribute_name() {
        $default = 'data-focus-field';
        $name = apply_filters('gcblite_focus_field_attribute', $default);
        return is_string($name) ? $name : '';
    }
}

if (!function_exists('gcb_focus_attr')) {
    /**
     * Build (don't print) the focus-field attribute as a single
     * pre-escaped string for use inside an HTML tag.
     *
     * Returns an empty string when either:
     *   - the site filtered the attribute name to empty (opt-out), or
     *   - the caller passed an empty attribute key.
     *
     * @param string $attribute_key The block attribute key the click
     *                              should focus in the Inspector.
     * @return string
     */
    function gcb_focus_attr($attribute_key) {
        if (!is_string($attribute_key) || $attribute_key === '') {
            return '';
        }
        $name = gcb_focus_field_attribute_name();
        if ($name === '') {
            return '';
        }
        return sprintf('%s="%s"', esc_attr($name), esc_attr($attribute_key));
    }
}

if (!function_exists('gcb_focus')) {
    /**
     * Print the focus-field attribute directly. Convenience wrapper
     * around gcb_focus_attr() for the common case where you just want
     * to echo it inside a tag.
     */
    function gcb_focus($attribute_key) {
        echo gcb_focus_attr($attribute_key);
    }
}
