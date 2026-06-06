<?php
/**
 * Parses theme.json-derived tokens into the GCB Lite token tree shape.
 *
 * Ported from the original GCB CustomTokens parser. Two parts:
 *   - parse_theme_json_tokens($theme_json['custom'])
 *       Reads settings.custom.* and produces tokens with cssVar references.
 *       Supports both simple format (`gap.xs: "0.25rem"`) and object format
 *       (`gap.tight: { name, value, slug }`).
 *   - parse_spacing_tokens($spacingSizes)
 *       Reads settings.spacing.spacingSizes and produces tokens that reference
 *       --wp--preset--spacing--{slug}.
 *
 * Output shape (consumed by useTokens / TokenSelector / spacing/select fields):
 *   [
 *     'custom' => [
 *       'label' => 'Custom (from theme.json)',
 *       'children' => [
 *         '{category}' => [
 *           'label' => 'Category',
 *           'tokens' => [
 *             ['key', 'slug', 'value', 'cssVar', 'label'], ...
 *           ],
 *         ],
 *       ],
 *     ],
 *     'spacing' => [...],
 *   ]
 *
 * @package GCBLite\Tokens
 */

namespace GCBLite\Tokens;

if (!defined('ABSPATH')) {
    exit;
}

class TokenParser {

    /**
     * Read theme.json and emit the merged tokens tree.
     */
    public static function tokens_for_editor() {
        if (!function_exists('wp_get_global_settings')) {
            return [];
        }

        $settings = wp_get_global_settings();
        $tokens = [];

        if (isset($settings['custom']) && is_array($settings['custom'])) {
            $tokens = self::parse_theme_json_tokens($settings['custom']);
        }

        // Colour palette (settings.color.palette) — the token type users reach
        // for most. Prefer theme-defined, fall back to core defaults.
        $palette = self::origin_list($settings['color']['palette'] ?? null);
        if ($palette) {
            $tokens = array_merge($tokens, self::parse_color_tokens($palette));
        }

        // Font sizes (settings.typography.fontSizes) — heading / type styles.
        $font_sizes = self::origin_list($settings['typography']['fontSizes'] ?? null);
        if ($font_sizes) {
            $tokens = array_merge($tokens, self::parse_typography_tokens($font_sizes));
        }

        if (isset($settings['spacing']['spacingSizes']) && is_array($settings['spacing']['spacingSizes'])) {
            $sizes = self::origin_list($settings['spacing']['spacingSizes']);
            if ($sizes) {
                $tokens = array_merge($tokens, self::parse_spacing_tokens($sizes));
            }
        }

        return $tokens;
    }

    /**
     * theme.json presets are keyed by origin (theme / default / custom). Prefer
     * the theme's own list, fall back to core defaults, then any custom origin.
     */
    private static function origin_list($preset) {
        if (!is_array($preset)) {
            return null;
        }
        if (array_key_exists(0, $preset)) {
            return $preset; // already a flat list (no origin keys)
        }
        $list = $preset['theme'] ?? $preset['default'] ?? $preset['custom'] ?? null;
        return is_array($list) && !empty($list) ? $list : null;
    }

    /**
     * settings.color.palette → a `color` group. Each entry is
     * `{ slug, color, name }`; we reference --wp--preset--color--{slug}.
     */
    public static function parse_color_tokens(array $palette) {
        $list = [];
        foreach ($palette as $c) {
            if (!isset($c['slug'])) {
                continue;
            }
            $slug  = $c['slug'];
            $value = $c['color'] ?? '';
            $name  = $c['name'] ?? ucwords(str_replace('-', ' ', $slug));
            $list[] = [
                'key'    => $slug,
                'slug'   => $slug,
                'value'  => $value,
                'cssVar' => "var(--wp--preset--color--{$slug})",
                'label'  => $name . ($value !== '' ? " ({$value})" : ''),
                'swatch' => $value, // raw hex/colour, for the picker swatch
            ];
        }

        return $list ? [
            'color' => [
                'label'    => __('Colours (from theme.json)', 'gcblite'),
                'children' => [
                    'palette' => [
                        'label'  => __('Palette', 'gcblite'),
                        'tokens' => $list,
                    ],
                ],
            ],
        ] : [];
    }

    /**
     * settings.typography.fontSizes → a `typography` group. Each entry is
     * `{ slug, size, name }`; we reference --wp--preset--font-size--{slug}.
     */
    public static function parse_typography_tokens(array $font_sizes) {
        $list = [];
        foreach ($font_sizes as $f) {
            if (!isset($f['slug'])) {
                continue;
            }
            $slug = $f['slug'];
            $size = $f['size'] ?? '';
            $name = $f['name'] ?? ucwords(str_replace('-', ' ', $slug));
            $list[] = [
                'key'    => $slug,
                'slug'   => $slug,
                'value'  => $size,
                'cssVar' => "var(--wp--preset--font-size--{$slug})",
                'label'  => $name . ($size !== '' ? " ({$size})" : ''),
            ];
        }

        return $list ? [
            'typography' => [
                'label'    => __('Typography (from theme.json)', 'gcblite'),
                'children' => [
                    'fontSize' => [
                        'label'  => __('Font Sizes', 'gcblite'),
                        'tokens' => $list,
                    ],
                ],
            ],
        ] : [];
    }

    /**
     * Convert settings.custom.* to our token format.
     *
     * Supports:
     *   simple:  custom.gap.xs = "0.25rem"
     *   object:  custom.gap.tight = { name, value, slug }
     */
    public static function parse_theme_json_tokens(array $theme_json_custom) {
        $tokens = [
            'custom' => [
                'label'    => __('Custom (from theme.json)', 'gcblite'),
                'children' => [],
            ],
        ];

        foreach ($theme_json_custom as $category => $values) {
            if (!is_array($values)) {
                continue;
            }

            $token_list = [];
            foreach ($values as $key => $value) {
                // camelCase → kebab-case (superWide → super-wide)
                $kebab_key = strtolower(preg_replace('/([a-z])([A-Z])/', '$1-$2', $key));

                if (is_array($value) && isset($value['slug'])) {
                    // Object format: name/value/slug provided.
                    $slug = strtolower(preg_replace('/([a-z])([A-Z])/', '$1-$2', $value['slug']));
                    $final_slug = (strpos($slug, $category) === 0) ? $slug : "{$category}-{$slug}";

                    $token_list[] = [
                        'key'    => $key,
                        'slug'   => $final_slug,
                        'value'  => $value['value'] ?? '',
                        'cssVar' => "var(--wp--custom--{$category}--{$kebab_key})",
                        'label'  => ($value['name'] ?? ucfirst(str_replace('-', ' ', $kebab_key)))
                                  . (isset($value['value']) ? " ({$value['value']})" : ''),
                    ];
                } else {
                    // Simple format: derive slug + cssVar.
                    $display = is_array($value) ? wp_json_encode($value) : $value;
                    $token_list[] = [
                        'key'    => $key,
                        'slug'   => "{$category}-{$kebab_key}",
                        'value'  => $display,
                        'cssVar' => "var(--wp--custom--{$category}--{$kebab_key})",
                        'label'  => ucfirst(str_replace('-', ' ', $kebab_key)) . " ({$display})",
                    ];
                }
            }

            if (!empty($token_list)) {
                $tokens['custom']['children'][$category] = [
                    'label'  => ucfirst(str_replace('-', ' ', $category)),
                    'tokens' => $token_list,
                ];
            }
        }

        return $tokens;
    }

    /**
     * Convert settings.spacing.spacingSizes (each `{ slug, size, name }`) into
     * tokens that reference --wp--preset--spacing--{slug}.
     */
    public static function parse_spacing_tokens(array $spacing_sizes) {
        $tokens = [
            'spacing' => [
                'label'    => __('Spacing (from theme.json)', 'gcblite'),
                'children' => [
                    'presets' => [
                        'label'  => __('Spacing Presets', 'gcblite'),
                        'tokens' => [],
                    ],
                ],
            ],
        ];

        foreach ($spacing_sizes as $spacing) {
            if (!isset($spacing['slug'], $spacing['size'])) {
                continue;
            }
            $slug = $spacing['slug'];
            $size = $spacing['size'];
            $name = $spacing['name'] ?? $slug;

            $tokens['spacing']['children']['presets']['tokens'][] = [
                'key'    => $slug,
                'slug'   => $slug,
                'value'  => $size,
                'cssVar' => "var(--wp--preset--spacing--{$slug})",
                'label'  => "{$name} ({$size})",
            ];
        }

        return $tokens;
    }
}
