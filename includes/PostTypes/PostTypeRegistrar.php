<?php
/**
 * Config-driven custom post type registration.
 *
 * GCB already *attaches* structured fields to a post type
 * (PostFields\Registrar), but registering the post type itself was theme code
 * (`register_post_type()` in functions.php). This closes that gap: a CPT is
 * described as JSON under the active theme's `gcb-post-types/` directory (one
 * file per type, mirroring how blocks live under `blocks/`), and GCB registers
 * it on `init` — plus any taxonomy and structured fields declared alongside.
 *
 * This is what the AI site architect writes to when it creates a "Person" CPT:
 * it emits config (data, re-editable, headless-friendly), not hand-written PHP.
 *
 * Config shape (gcb-post-types/person.json):
 *   {
 *     "post_type": "person",
 *     "args": { "label": "People", "public": true, "menu_icon": "dashicons-groups",
 *               "supports": ["title", "thumbnail"], "has_archive": true },
 *     "taxonomies": [
 *       { "taxonomy": "department", "args": { "label": "Departments", "hierarchical": true } }
 *     ],
 *     "fields": { "controls": [ … same shape as block.fields.json … ] }
 *   }
 *
 * @package GCBLite\PostTypes
 */

namespace GCBLite\PostTypes;

if (!defined('ABSPATH')) {
    exit;
}

class PostTypeRegistrar {

    /** Directory under the active theme holding one JSON config per CPT. */
    const DIR = 'gcb-post-types';

    public static function init() {
        // Priority 5: before PostFields\Registrar's init-100 editor stripping,
        // and before themes that register fields on the default init priority.
        add_action('init', [__CLASS__, 'register_all'], 5);
        // Restrict the block editor to a CPT's allowed_blocks (hybrid types that
        // want a curated visual body, not "anything goes").
        add_filter('allowed_block_types_all', [__CLASS__, 'filter_allowed_blocks'], 10, 2);
    }

    /**
     * If the current edit screen's post type declares `allowed_blocks` in its
     * config, restrict the editor to that list. Returns the original value
     * (usually true = all) for any type without a restriction.
     *
     * @param bool|array $allowed
     * @param object     $context  WP_Block_Editor_Context
     * @return bool|array
     */
    public static function filter_allowed_blocks($allowed, $context) {
        $post = $context->post ?? null;
        if (!$post || empty($post->post_type)) {
            return $allowed;
        }
        $cfg = self::configs()[$post->post_type] ?? null;
        if (!$cfg || empty($cfg['allowed_blocks']) || !is_array($cfg['allowed_blocks'])) {
            return $allowed;
        }
        return array_values(array_filter($cfg['allowed_blocks'], 'is_string'));
    }

    /** Absolute path to the active (child) theme's CPT config dir. */
    public static function config_dir(): string {
        return trailingslashit(get_stylesheet_directory()) . self::DIR;
    }

    /** Read every CPT config file. @return array<string,array> post_type => config */
    public static function configs(): array {
        $dir = self::config_dir();
        if (!is_dir($dir)) {
            return [];
        }
        $out = [];
        foreach (glob($dir . '/*.json') ?: [] as $file) {
            $cfg = json_decode((string) file_get_contents($file), true);
            if (is_array($cfg) && !empty($cfg['post_type'])) {
                $out[(string) $cfg['post_type']] = $cfg;
            }
        }
        return $out;
    }

    /** Register every configured CPT (+ its taxonomies + structured fields). */
    public static function register_all() {
        foreach (self::configs() as $post_type => $cfg) {
            self::register_one($post_type, $cfg);
        }
    }

    private static function register_one(string $post_type, array $cfg) {
        if (!preg_match('/^[a-z][a-z0-9_-]{1,19}$/', $post_type)) {
            return; // invalid / reserved-length slug
        }

        // Don't clobber a type the theme/plugin already registered in code.
        if (!post_type_exists($post_type)) {
            $args = is_array($cfg['args'] ?? null) ? $cfg['args'] : [];
            $args = wp_parse_args($args, [
                'public'       => true,
                'show_in_rest' => true, // headless + block-editor need this
                'label'        => ucwords(str_replace(['-', '_'], ' ', $post_type)),
            ]);
            register_post_type($post_type, $args);
        }

        // Taxonomies declared alongside the CPT.
        foreach (($cfg['taxonomies'] ?? []) as $tax) {
            if (!is_array($tax) || empty($tax['taxonomy'])) {
                continue;
            }
            $tslug = (string) $tax['taxonomy'];
            if (!preg_match('/^[a-z][a-z0-9_-]{1,31}$/', $tslug) || taxonomy_exists($tslug)) {
                continue;
            }
            $targs = wp_parse_args(is_array($tax['args'] ?? null) ? $tax['args'] : [], [
                'public'       => true,
                'show_in_rest' => true,
                'label'        => ucwords(str_replace(['-', '_'], ' ', $tslug)),
            ]);
            register_taxonomy($tslug, $post_type, $targs);
        }

        // Structured fields → hand to the existing PostFields registry.
        if (!empty($cfg['fields']['controls']) && class_exists('\\GCBLite\\PostFields\\Registrar')) {
            \GCBLite\PostFields\Registrar::register($post_type, $cfg['fields']);
        }
    }

    /**
     * Write a CPT config file (used by the builder / AI architect). Validates
     * the slug, writes atomically, and returns the path. Caller must hold the
     * edit_themes capability — gated at the REST layer.
     *
     * @return array{ok: bool, error?: string, path?: string, post_type?: string}
     */
    /**
     * @param array  $config     The CPT config to persist.
     * @param string $target_dir Optional override for where the JSON is written
     *                           (e.g. a draft workspace theme's gcb-post-types/).
     *                           Defaults to the active theme's config_dir().
     */
    public static function write(array $config, string $target_dir = ''): array {
        $post_type = strtolower(trim((string) ($config['post_type'] ?? '')));
        if (!preg_match('/^[a-z][a-z0-9_-]{1,19}$/', $post_type)) {
            return ['ok' => false, 'error' => 'Invalid post type slug (lowercase, 2–20 chars, letters/digits/-/_).'];
        }
        if (in_array($post_type, ['post', 'page', 'attachment', 'revision', 'nav_menu_item'], true)) {
            return ['ok' => false, 'error' => "“{$post_type}” is a reserved WordPress type."];
        }

        $dir = $target_dir !== '' ? untrailingslashit($target_dir) : self::config_dir();
        if (!is_dir($dir) && !wp_mkdir_p($dir)) {
            return ['ok' => false, 'error' => 'Could not create the gcb-post-types directory in the theme.'];
        }
        if (!is_writable($dir)) {
            return ['ok' => false, 'error' => 'The theme directory is not writable.'];
        }

        $path    = $dir . '/' . $post_type . '.json';
        $encoded = wp_json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($encoded === false) {
            return ['ok' => false, 'error' => 'Could not encode the config.'];
        }

        $tmp = $path . '.gcbtmp';
        if (file_put_contents($tmp, $encoded . "\n") === false || !@rename($tmp, $path)) {
            @unlink($tmp);
            return ['ok' => false, 'error' => 'Could not write the config file.'];
        }

        return ['ok' => true, 'path' => $path, 'post_type' => $post_type];
    }
}
