<?php
/**
 * Loads and registers blocks from the active theme's `blocks/` directory.
 *
 * Each block is a directory with:
 *   - block.json         — standard WP block metadata
 *   - block.fields.json  — GCB controls config (optional)
 *   - render.php         — server-rendered template (optional but typical)
 *
 * Block names use the `gcb/` prefix. Render is via render.php — WP's native
 * render_callback handles it; no plugin magic.
 *
 * @package GCBLite\Blocks
 */

namespace GCBLite\Blocks;

use GCBLite\Validation\BlockGcbValidator;

if (!defined('ABSPATH')) {
    exit;
}

class BlockLoader {

    /**
     * Cache of loaded block configs keyed by full block name (gcb/{slug}).
     */
    private static $blocks = [];

    /**
     * Map of childBlockName => [parentBlockName, ...].
     * Populated during the first scan from each render.php's <Repeater allowedBlocks>.
     */
    private static $repeater_parents = [];

    public static function init() {
        // Load early so block.json auto-registration sees our attribute additions.
        add_action('init', [__CLASS__, 'register_blocks'], 5);
    }

    /**
     * Scan the theme's blocks directory and register every `block.json`.
     * First pass builds the repeater parent-map (which children are scoped
     * to which parents); second pass registers each block, injecting
     * `parent` constraints from the map.
     */
    public static function register_blocks() {
        $dirs = self::scan_block_dirs();

        // First pass: build repeater parent-map by scanning each render.php.
        foreach ($dirs as $block_dir) {
            self::index_repeater_parents($block_dir);
        }

        // Second pass: register each block.
        foreach ($dirs as $block_dir) {
            self::register_one($block_dir);
        }
    }

    /**
     * Discover which blocks act as repeater children of this block, and
     * record the parent relationship so registration can inject WP's
     * `parent` constraint on each child.
     *
     * Two sources, in order:
     *   1. <Repeater allowedBlocks='[...]' /> tags inside render.php
     *      — for PHP-rendered blocks. Authoritative because the same
     *        tag is what produces the editor's InnerBlocks UI.
     *   2. `allowed_blocks` key in block.fields.json — for blocks that
     *      have no render.php (rendered by the component server). React
     *      components don't have an HTML tag we can scan, so the schema
     *      file is the only declaration.
     */
    private static function index_repeater_parents($block_dir) {
        $block_json_path = $block_dir . '/block.json';
        if (!file_exists($block_json_path)) {
            return;
        }
        $block_json = json_decode(file_get_contents($block_json_path), true);
        if (!is_array($block_json) || empty($block_json['name'])) {
            return;
        }
        $parent_name = $block_json['name'];

        $allowed_children = self::discover_allowed_children($block_dir);
        foreach ($allowed_children as $child_name) {
            self::$repeater_parents[$child_name][] = $parent_name;
        }
    }

    /**
     * @return array<int, string> child block names this block allows
     */
    private static function discover_allowed_children($block_dir) {
        // First try render.php for <Repeater allowedBlocks='[...]'>.
        $render_path = $block_dir . '/render.php';
        if (file_exists($render_path)) {
            $render = file_get_contents($render_path);
            if (preg_match_all('/<repeater\b([^>]*)>/i', $render, $matches)) {
                $out = [];
                foreach ($matches[1] as $attrs_blob) {
                    if (!preg_match('/allowedBlocks\s*=\s*([\'"])(.+?)\1/i', $attrs_blob, $attr_match)) {
                        continue;
                    }
                    $value = html_entity_decode($attr_match[2]);
                    if ($value === 'all' || $value === '') {
                        continue;
                    }
                    $allowed = json_decode($value, true);
                    if (!is_array($allowed)) {
                        continue;
                    }
                    foreach ($allowed as $name) {
                        if (is_string($name) && $name !== '') {
                            $out[] = $name;
                        }
                    }
                }
                if (!empty($out)) {
                    return $out;
                }
            }
        }

        // Fall back to block.fields.json's `allowed_blocks` for React-only blocks.
        $fields_path = $block_dir . '/block.fields.json';
        if (!file_exists($fields_path)) {
            return [];
        }
        $fields = json_decode(file_get_contents($fields_path), true);
        $allowed = $fields['allowed_blocks'] ?? [];
        if (!is_array($allowed)) {
            return [];
        }
        return array_values(array_filter($allowed, fn($n) => is_string($n) && $n !== ''));
    }

    /**
     * Get the resolved config for a registered block. Returns the controls
     * array merged with WP attribute defaults — useful for headless callers.
     */
    public static function get_block_config($block_name) {
        return self::$blocks[$block_name] ?? null;
    }

    /**
     * @return array<int, string> Absolute paths to block directories
     *
     * Scans two sources:
     *   1. The active theme's blocks/ directory (the canonical location).
     *   2. The plugin's bundled examples/blocks/ directory, IF
     *      GCBLITE_LOAD_EXAMPLES is defined as truthy in wp-config.php.
     *      Off by default so production sites don't get demo blocks
     *      cluttering their inserter. Useful for WordPress Playground
     *      demos and for anyone exploring the plugin on a fresh install.
     */
    private static function scan_block_dirs() {
        $dirs = [];

        $theme_blocks = trailingslashit(get_stylesheet_directory()) . 'blocks';
        if (is_dir($theme_blocks)) {
            $dirs = array_merge($dirs, glob($theme_blocks . '/*', GLOB_ONLYDIR) ?: []);
        }

        // Blocks the plugin ships itself (icon-list, …). After the theme in
        // the list so the slug de-dup below lets a theme override a kit
        // block by shipping a dir of the same name.
        $kit_blocks = GCBLITE_PLUGIN_DIR . 'blocks';
        if (is_dir($kit_blocks)) {
            $dirs = array_merge($dirs, glob($kit_blocks . '/*', GLOB_ONLYDIR) ?: []);
        }

        if (defined('GCBLITE_LOAD_EXAMPLES') && GCBLITE_LOAD_EXAMPLES) {
            $example_blocks = GCBLITE_PLUGIN_DIR . 'examples/blocks';
            if (is_dir($example_blocks)) {
                $dirs = array_merge($dirs, glob($example_blocks . '/*', GLOB_ONLYDIR) ?: []);
            }
        }

        /**
         * Register extra individual block dirs for THIS request. A companion plugin
         * (e.g. GCB Pro) uses this to make a block in an inactive workspace theme
         * registerable + renderable in the editor for a live preview, without
         * activating that theme. Each entry is an absolute path to a single block
         * dir (the folder that holds block.json), NOT a blocks/ root.
         *
         * @param array<int,string> $extra_dirs absolute block-dir paths
         */
        $extra_dirs = apply_filters('gcblite_block_dirs', []);
        if (is_array($extra_dirs)) {
            $dirs = array_merge($dirs, $extra_dirs);
        }

        // De-dup by slug (active theme wins) so a draft block can't double-register
        // a name the active theme already has.
        $by_slug = [];
        foreach ($dirs as $dir) {
            $slug = basename($dir);
            if (!isset($by_slug[$slug]) && file_exists($dir . '/block.json')) {
                $by_slug[$slug] = $dir;
            }
        }
        return array_values($by_slug);
    }

    private static function register_one($block_dir) {
        $block_json_path = $block_dir . '/block.json';
        $block_json = json_decode(file_get_contents($block_json_path), true);
        if (!is_array($block_json) || empty($block_json['name'])) {
            return;
        }

        // Only handle our own blocks (gcb/ prefix).
        if (strpos($block_json['name'], 'gcb/') !== 0) {
            return;
        }

        // Sibling fields config — controls + GCB extras. Optional: a block can
        // exist with no controls (just rendered HTML).
        $fields_config = self::load_fields_config($block_dir);

        if (!empty($fields_config)) {
            $validation = BlockGcbValidator::validate($fields_config);
            if (!$validation['ok']) {
                if (defined('WP_DEBUG') && WP_DEBUG) {
                    foreach ($validation['errors'] as $err) {
                        trigger_error(
                            "GCB Lite: invalid block.fields.json in {$block_dir} — [{$err['path']}] {$err['message']}",
                            E_USER_WARNING
                        );
                    }
                }
                return;
            }
        }

        // Generate WP attribute definitions from the controls so the editor
        // saves typed values for each one.
        $generated_attributes = self::generate_attributes($fields_config['controls'] ?? []);
        $existing_attributes  = $block_json['attributes'] ?? [];

        // Merge our generated attributes into block.json's attributes via the
        // metadata filter — preserves anything the author set manually. Also
        // attach `gcb-lite` as the editor script if the block doesn't bring
        // its own (so it appears in the inserter and gets the Inspector layer)
        // and inject `parent` constraints from any <Repeater allowedBlocks>
        // declarations found in other blocks' render.php files.
        $parents = self::$repeater_parents[$block_json['name']] ?? [];

        // Auto-wire render.php if it exists and block.json hasn't explicitly
        // declared a render — saves authors from repeating "render: file:./render.php"
        // in every block.json. Standard WP recognises both `render` (camelCase, set
        // via metadata filter) and `render_callback` (snake_case via register args);
        // the metadata filter happens first so we go through that.
        $has_render_php = file_exists($block_dir . '/render.php');

        add_filter('block_type_metadata', function ($metadata) use ($block_json, $generated_attributes, $parents, $has_render_php, $block_dir) {
            if (($metadata['name'] ?? null) !== $block_json['name']) {
                return $metadata;
            }
            $metadata['attributes'] = array_merge(
                $metadata['attributes'] ?? [],
                $generated_attributes
            );
            // Editor-only: how a repeater's children are arranged for EDITING (the
            // RepeaterTag layout). Not used on the front end. Harmless on non-repeater
            // blocks. Default 'carousel' = the current WYSIWYG behaviour.
            if (!isset($metadata['attributes']['editLayout'])) {
                $metadata['attributes']['editLayout'] = ['type' => 'string', 'default' => 'carousel'];
            }
            if (empty($metadata['editorScript']) && empty($metadata['editor_script'])) {
                $metadata['editorScript'] = 'gcb-lite';
            }
            if (!empty($parents) && empty($metadata['parent'])) {
                $metadata['parent'] = array_values(array_unique($parents));
            }
            // SAFETY NET: instead of WP's native `render: file:./render.php` (a bare
            // require that white-screens the whole page if the template fatals), wire
            // a render_callback that try/catches the include. A fatal in one block
            // then renders empty on the front end (and a small note in the editor)
            // instead of taking down the page. Applies to every gcb/* block.
            if ($has_render_php && empty($metadata['render']) && empty($metadata['render_callback'])) {
                $renderFile = $block_dir . '/render.php';
                $metadata['render_callback'] = static function ($attributes, $content, $block) use ($renderFile) {
                    return self::safe_render($renderFile, $attributes, $content, $block);
                };
            }
            return $metadata;
        });

        // WP 7.0 FIX: WordPress 7.0 no longer honours a `render_callback` set via the
        // `block_type_metadata` filter (above) — it's discarded during registration, so
        // every gcb/* block ends up with a NULL callback and renders BLANK on the front end
        // AND in the editor preview. (Wasn't noticed because the AI builder renders via its
        // own preview path, not do_blocks().) The `register_block_type_args` filter modifies
        // the REGISTER ARGS, which WP 7.0 DOES honour — so wire the same crash-safe render.php
        // callback here. Scoped to THIS block's name; harmless alongside the metadata filter
        // (whichever WP version honours its own path, the callback is identical).
        if ($has_render_php) {
            $renderFile = $block_dir . '/render.php';
            $blockName  = $block_json['name'];
            add_filter('register_block_type_args', function ($args, $name) use ($renderFile, $blockName) {
                if ($name === $blockName && empty($args['render_callback'])) {
                    $args['render_callback'] = static function ($attributes, $content, $block) use ($renderFile) {
                        return self::safe_render($renderFile, $attributes, $content, $block);
                    };
                }
                return $args;
            }, 20, 2);
        }

        // Register from directory. (render_callback wired via register_block_type_args for
        // WP 7.0 + the metadata filter for older WP; WP picks up everything else from block.json.)
        $block_type = register_block_type($block_dir);

        if ($block_type) {
            self::$blocks[$block_json['name']] = [
                'block_json' => $block_json,
                'fields'     => $fields_config,
                'attributes' => array_keys($generated_attributes),
            ];
        }
    }

    /**
     * Crash-safe render of a block's render.php. Same scope WP's native file render
     * gives the template ($attributes, $content, $block), but wrapped so a fatal in
     * one block renders empty on the front end (and a small note in the editor)
     * instead of white-screening the whole page.
     *
     * @param string    $renderFile absolute path to render.php
     * @param array     $attributes block attributes
     * @param string    $content    inner-block content
     * @param \WP_Block $block      the block instance
     * @return string
     */
    public static function safe_render($renderFile, $attributes, $content, $block) {
        // Run the include in a closure so the template only sees the three vars WP
        // provides — no access to this method's locals.
        $run = static function ($__file, $attributes, $content, $block) {
            ob_start();
            require $__file;
            return (string) ob_get_clean();
        };

        try {
            return $run($renderFile, $attributes, $content, $block);
        } catch (\Throwable $e) {
            // Clean up any buffer the template left open.
            while (ob_get_level() > 0) {
                @ob_end_clean();
            }

            // Editor preview (rendered via our REST endpoint) → a small, visible note
            // so the author knows the block errored; the front end stays silent.
            $inEditor = (defined('REST_REQUEST') && REST_REQUEST)
                || (defined('GCBLITE_EDITOR_PREVIEW') && GCBLITE_EDITOR_PREVIEW);

            // Log for diagnosis regardless.
            if (function_exists('error_log')) {
                $name = is_object($block) && isset($block->name) ? $block->name : 'gcb block';
                error_log("[GCB] render error in {$name}: " . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
            }

            if ($inEditor) {
                return '<div style="padding:16px;border:1px dashed #d9534f;border-radius:8px;'
                    . 'background:#fdf2f2;color:#a12b2b;font:500 13px/1.4 system-ui,sans-serif">'
                    . 'This block hit a render error — ' . esc_html($e->getMessage())
                    . '. Rebuild or edit it to fix.</div>';
            }
            return ''; // front end: fail silent, never white-screen the page
        }
    }

    /**
     * Read and decode block.fields.json next to block.json. Returns [] if absent.
     */
    private static function load_fields_config($block_dir) {
        $path = $block_dir . '/block.fields.json';
        if (!file_exists($path)) {
            return [];
        }
        $data = json_decode(file_get_contents($path), true);
        return is_array($data) ? $data : [];
    }

    /**
     * Map controls → WP attribute definitions.
     *
     * @param array $controls
     * @return array<string, array{type: string, default: mixed}>
     */
    private static function generate_attributes(array $controls) {
        // Delegated to the wordpress-gcb/fields SDK — the same block.fields.json
        // → block attributes logic, extracted so headless/standalone blocks can
        // register typed attributes without this plugin. See the php-sdk repo.
        return \GCBFields\Schema::attributes($controls);
    }
}
