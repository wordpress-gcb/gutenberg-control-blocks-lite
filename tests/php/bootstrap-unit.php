<?php
/**
 * Bootstrap for the "unit" PHPUnit suite. No WordPress runtime — these
 * tests cover pure functions (Validator, Conditional, etc.) that don't
 * touch WP globals.
 *
 * Anything that *does* need WP (apply_filters, get_option, etc.) is
 * shimmed here as a minimal stub so the production code under test
 * doesn't fatal. The stubs default to behaving like an empty WP install
 * — no filters registered, no options set — and individual tests can
 * override per-test.
 */

if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}

// Composer autoloader for GCBLite\ and GCBLite\Tests\.
require_once __DIR__ . '/../../vendor/autoload.php';

// ---------------------------------------------------------------------
// Minimal WP function shims
// ---------------------------------------------------------------------
//
// These exist only so the production code under test can call them
// without fataling. Tests that care about behaviour override the
// in-memory state held in the GCBLite\Tests\WpStub singleton.

require_once __DIR__ . '/WpStub.php';

if (!function_exists('apply_filters')) {
    function apply_filters($tag, $value, ...$args) {
        return \GCBLite\Tests\WpStub::apply_filters($tag, $value, $args);
    }
}

if (!function_exists('has_filter')) {
    function has_filter($tag, $callback = false) {
        return \GCBLite\Tests\WpStub::has_filter($tag);
    }
}

if (!function_exists('add_filter')) {
    function add_filter($tag, $callback, $priority = 10, $accepted_args = 1) {
        \GCBLite\Tests\WpStub::add_filter($tag, $callback);
        return true;
    }
}

if (!function_exists('get_option')) {
    function get_option($name, $default = false) {
        return \GCBLite\Tests\WpStub::get_option($name, $default);
    }
}

if (!function_exists('esc_url_raw')) {
    // Strip control chars + restrict to http/https + a small set of safe chars.
    // Mirrors WP's behaviour closely enough for unit tests; the real WP function
    // is used in production.
    function esc_url_raw($url) {
        $url = trim((string) $url);
        if ($url === '') return '';
        $url = preg_replace('/[^A-Za-z0-9\-._~:\/?#\[\]@!\$&\'()*+,;=%]/', '', $url);
        if (!preg_match('#^https?://#i', $url)) return '';
        return $url;
    }
}

if (!function_exists('__')) {
    function __($text, $domain = null) { return $text; }
}

// Shims for the filesystem-touching token writer. get_stylesheet_directory()
// honours a per-test override so CustomTokenWriterTest can point at a temp dir.
if (!function_exists('get_stylesheet_directory')) {
    function get_stylesheet_directory() {
        return $GLOBALS['__gcb_test_stylesheet_dir'] ?? sys_get_temp_dir();
    }
}
if (!function_exists('trailingslashit')) {
    function trailingslashit($s) { return rtrim((string) $s, '/\\') . '/'; }
}
if (!function_exists('wp_json_encode')) {
    function wp_json_encode($data, $options = 0, $depth = 512) { return json_encode($data, $options, $depth); }
}
if (!function_exists('wp_mkdir_p')) {
    function wp_mkdir_p($dir) { return is_dir($dir) || mkdir($dir, 0777, true); }
}
if (!function_exists('wp_parse_args')) {
    function wp_parse_args($args, $defaults = []) { return array_merge($defaults, (array) $args); }
}

if (!function_exists('sprintf')) {
    // PHP has sprintf natively; nothing to do.
}
