<?php
/**
 * In-memory WP state for the "unit" PHPUnit suite. Production code calls
 * the WP function shims (apply_filters, get_option, etc.) defined in
 * bootstrap-unit.php; those shims read from this class.
 *
 * Each test starts with a clean slate via reset() in setUp().
 */

namespace GCBLite\Tests;

class WpStub {

    /** @var array<string, array<int, callable>> */
    private static $filters = [];

    /** @var array<string, mixed> */
    private static $options = [];

    public static function reset() {
        self::$filters = [];
        self::$options = [];
    }

    public static function add_filter($tag, callable $cb) {
        self::$filters[$tag][] = $cb;
    }

    public static function has_filter($tag) {
        return !empty(self::$filters[$tag]);
    }

    public static function apply_filters($tag, $value, array $args = []) {
        if (empty(self::$filters[$tag])) {
            return $value;
        }
        foreach (self::$filters[$tag] as $cb) {
            $value = $cb($value, ...$args);
        }
        return $value;
    }

    public static function set_option($name, $value) {
        self::$options[$name] = $value;
    }

    public static function get_option($name, $default = false) {
        return array_key_exists($name, self::$options) ? self::$options[$name] : $default;
    }
}
