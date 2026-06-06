<?php
/**
 * Writes custom design tokens into the active theme's theme.json.
 *
 * When an author adds a token in the field builder that isn't in the theme yet
 * and chooses "add to my theme", this appends it to `settings.custom.{category}`
 * so it's reusable in every block — the reusable counterpart to a one-off token
 * stored on a single field.
 *
 * Mutating a theme file is invasive, so this is deliberately conservative:
 *   - only writes to `settings.custom.{category}` — never touches the
 *     `color.palette` / `typography.fontSizes` core preset arrays;
 *   - merges into the existing JSON and re-serialises (never rewrites blind);
 *   - validates slug + category (`^[a-z][a-z0-9-]*$`) and requires a value;
 *   - refuses if theme.json is absent or not writable, returning a clear error
 *     so the caller can fall back to a one-off token.
 *
 * The REST layer (BuilderAPI) gates the call on `edit_themes` +
 * DISALLOW_FILE_EDIT, the same guard as every other builder write.
 *
 * @package GCBLite\Tokens
 */

namespace GCBLite\Tokens;

if (!defined('ABSPATH')) {
    exit;
}

class CustomTokenWriter {

    const SLUG_RE = '/^[a-z][a-z0-9-]*$/';

    /**
     * Add a custom token to the active theme's theme.json.
     *
     * @param string $category e.g. "color", "spacing", "typography" (the custom bucket).
     * @param string $slug     token slug (validated).
     * @param string $value    the raw value (hex, size, etc.) — required, non-empty.
     * @param string $name     optional human label.
     * @return array{ok: bool, error?: string, token?: array, css_var?: string}
     */
    public static function add(string $category, string $slug, string $value, string $name = ''): array {
        $category = strtolower(trim($category));
        $slug     = strtolower(trim($slug));
        $value    = trim($value);

        if (!preg_match(self::SLUG_RE, $category)) {
            return ['ok' => false, 'error' => 'Invalid category. Use lowercase letters, digits and hyphens.'];
        }
        if (!preg_match(self::SLUG_RE, $slug)) {
            return ['ok' => false, 'error' => 'Invalid token name. Use lowercase letters, digits and hyphens (e.g. "brand-pink").'];
        }
        if ($value === '') {
            return ['ok' => false, 'error' => 'A token value is required.'];
        }

        $path = self::theme_json_path();
        if ($path === '') {
            return ['ok' => false, 'error' => 'The active theme has no theme.json to write to.'];
        }
        if (!is_writable($path)) {
            return ['ok' => false, 'error' => 'theme.json is not writable. Saved as a one-off on this field instead.'];
        }

        $json = json_decode((string) file_get_contents($path), true);
        if (!is_array($json)) {
            return ['ok' => false, 'error' => 'Could not read theme.json (invalid JSON).'];
        }

        // Merge into settings.custom.{category}.{slug} = value. We only ever
        // touch this sub-tree; everything else is round-tripped untouched.
        if (!isset($json['settings']) || !is_array($json['settings'])) {
            $json['settings'] = [];
        }
        if (!isset($json['settings']['custom']) || !is_array($json['settings']['custom'])) {
            $json['settings']['custom'] = [];
        }
        if (!isset($json['settings']['custom'][$category]) || !is_array($json['settings']['custom'][$category])) {
            $json['settings']['custom'][$category] = [];
        }
        $json['settings']['custom'][$category][$slug] = $value;

        $encoded = wp_json_encode($json, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($encoded === false) {
            return ['ok' => false, 'error' => 'Could not encode the updated theme.json.'];
        }

        // Write atomically-ish: a temp file + rename, so a failed write never
        // leaves a half-truncated theme.json.
        $tmp = $path . '.gcbtmp';
        if (file_put_contents($tmp, $encoded . "\n") === false || !@rename($tmp, $path)) {
            @unlink($tmp);
            return ['ok' => false, 'error' => 'Could not write theme.json.'];
        }

        // WP caches parsed theme.json; clear it so the new token shows immediately.
        if (function_exists('wp_clean_theme_json_cache')) {
            wp_clean_theme_json_cache();
        }

        $css_var = "var(--wp--custom--{$category}--{$slug})";
        return [
            'ok'      => true,
            'css_var' => $css_var,
            'token'   => [
                'key'    => $slug,
                'slug'   => "{$category}-{$slug}",
                'value'  => $value,
                'cssVar' => $css_var,
                'label'  => ($name !== '' ? $name : ucwords(str_replace('-', ' ', $slug))) . " ({$value})",
            ],
        ];
    }

    /** Absolute path to the active (child) theme's theme.json, or '' if none. */
    private static function theme_json_path(): string {
        $path = trailingslashit(get_stylesheet_directory()) . 'theme.json';
        return file_exists($path) ? $path : '';
    }
}
