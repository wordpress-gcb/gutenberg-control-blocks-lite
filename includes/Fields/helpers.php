<?php
/**
 * Global helper for the control-type registry. Kept outside the namespace so
 * a theme or plugin can call it from functions.php / its main file:
 *
 *   add_action('gcblite_register_control_types', function () {
 *       gcblite_register_control_type('timeline', [
 *           'shape'  => 'array',
 *           'doc'    => __DIR__ . '/fields/timeline.md',
 *           'script' => 'my-timeline-control',
 *       ]);
 *   });
 *
 * Register on that action (it fires on `init` at 4): GCB types every block's
 * attributes at init/5, and a type registered later stores a string.
 *
 * See GCBLite\Fields\ControlTypes for what registering buys, and AGENTS.md
 * ("Adding your own field type") for the JS side.
 *
 * @package GCBLite\Fields
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('gcblite_register_control_type')) {
    /**
     * @param string $type 'my-field' — lowercase letters, digits and dashes; not a built-in name.
     * @param array  $args shape (required: string|number|integer|boolean|object|array),
     *                     doc (absolute path to a schemas/controls-style .md file),
     *                     script (handle of an editor script that calls gcbLiteControls.register()).
     * @return bool Whether it was registered.
     */
    function gcblite_register_control_type($type, array $args) {
        return \GCBLite\Fields\ControlTypes::register($type, $args);
    }
}
