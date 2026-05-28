<?php
/**
 * Autoloader for structured-field JSON schemas.
 *
 * Mirrors the block.fields.json convention for the four structured-field
 * registrars. On `init` (priority 1, before themes typically register
 * theirs at priority 10), globs the active theme for:
 *
 *   post-fields/{post-type}.fields.json     → gcblite_register_post_fields()
 *   taxonomy-fields/{taxonomy}.fields.json  → gcblite_register_taxonomy_fields()
 *   options-fields/{slug}.fields.json       → gcblite_register_options_fields()
 *   user-fields.fields.json                 → gcblite_register_user_fields()
 *
 * Each file has the shape `{ "controls": [...] }` — same schema as
 * block.fields.json. PHP `gcblite_register_*_fields()` helpers continue
 * to work alongside JSON files; both paths converge on the same
 * registrar internals.
 *
 * @package GCBLite\StructuredFields
 */

namespace GCBLite\StructuredFields;

if (!defined('ABSPATH')) {
    exit;
}

class Autoloader {

    /**
     * Run before theme-level registrations so authors can still override
     * a JSON-registered field by re-registering it in functions.php.
     */
    public static function init() {
        add_action('init', [__CLASS__, 'autoload'], 1);
    }

    public static function autoload() {
        $base = self::theme_dir();
        if (!$base || !is_dir($base)) return;

        self::autoload_kind($base . '/post-fields',     'gcblite_register_post_fields');
        self::autoload_kind($base . '/taxonomy-fields', 'gcblite_register_taxonomy_fields');
        self::autoload_kind($base . '/options-fields',  'gcblite_register_options_fields');
        self::autoload_user($base . '/user-fields.fields.json');
    }

    /**
     * Glob `{dir}/*.fields.json` and dispatch each one as
     * `$helper($basename_without_suffix, $config)`. The basename is the
     * post-type / taxonomy / options-page slug.
     */
    private static function autoload_kind($dir, $helper) {
        if (!is_dir($dir) || !function_exists($helper)) return;

        foreach (glob($dir . '/*.fields.json') ?: [] as $file) {
            $id     = basename($file, '.fields.json');
            $config = self::read_json($file);
            if (!is_array($config) || empty($config['controls'])) continue;
            $helper($id, $config);
        }
    }

    /**
     * User fields are single — no per-slug split. Just one
     * `user-fields.fields.json`.
     */
    private static function autoload_user($file) {
        if (!is_readable($file) || !function_exists('gcblite_register_user_fields')) return;
        $config = self::read_json($file);
        if (!is_array($config) || empty($config['controls'])) return;
        gcblite_register_user_fields($config);
    }

    /**
     * Active theme dir (child theme wins). Parent theme is intentionally
     * NOT a fallback — child themes own structured-field schemas just
     * like they own block-fields schemas.
     */
    public static function theme_dir() {
        return get_stylesheet_directory();
    }

    private static function read_json($file) {
        $raw = @file_get_contents($file);
        if (!is_string($raw)) return null;
        $data = json_decode($raw, true);
        return is_array($data) ? $data : null;
    }
}
