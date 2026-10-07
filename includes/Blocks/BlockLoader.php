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
        // One callback each for every gcb/* block (see wire()).
        add_filter('block_type_metadata', [__CLASS__, 'filter_metadata']);
        add_filter('register_block_type_args', [__CLASS__, 'filter_args'], 20, 2);
    }

    /**
     * What each block needs when WordPress registers it, by block name:
     * its generated attributes, its repeater parents, its render.php ('' for none).
     *
     * @var array<string, array{attributes: array, parents: array, render: string}>
     */
    private static $wiring = [];

    /** Keep what a block needs at registration (register_one; a test). */
    public static function wire(string $name, array $needs): void {
        self::$wiring[$name] = [
            'attributes' => (array) ($needs['attributes'] ?? []),
            'parents'    => (array) ($needs['parents'] ?? []),
            'render'     => (string) ($needs['render'] ?? ''),
        ];
    }

    /** Tests start clean. */
    public static function forget_wiring(): void {
        self::$wiring = [];
    }

    /**
     * `block_type_metadata`: merge our generated attributes into block.json's —
     * preserving anything the author set manually — attach `gcb-lite` as the
     * editor script if the block doesn't bring its own (so it appears in the
     * inserter and gets the Inspector layer) and inject `parent` constraints
     * from any <Repeater allowedBlocks> declarations found in other blocks'
     * render.php files.
     *
     * @param array $metadata
     * @return array
     */
    public static function filter_metadata($metadata) {
        $name = is_array($metadata) ? ($metadata['name'] ?? null) : null;
        if (!is_string($name) || !isset(self::$wiring[$name])) {
            return $metadata;
        }
        $w = self::$wiring[$name];
        $metadata['attributes'] = array_merge(
            $metadata['attributes'] ?? [],
            $w['attributes']
        );
        // Editor-only: how a repeater's children are arranged for EDITING (the
        // RepeaterTag layout). Not used on the front end. Harmless on non-repeater
        // blocks. Default 'carousel' = the current WYSIWYG behaviour.
        if (!isset($metadata['attributes']['editLayout'])) {
            $metadata['attributes']['editLayout'] = ['type' => 'string', 'default' => 'carousel'];
        }
        // GCB's editor bundle always edits the block; a block may ADD its own
        // editor script (`"editorScript": "file:./editor.js"` — an overlay, via
        // window.gcbLiteEditor). It used to replace ours, which only worked because
        // the bundle is also enqueued globally (2026-10-07).
        $own = $metadata['editorScript'] ?? ($metadata['editor_script'] ?? []);
        $own = is_array($own) ? $own : [$own];
        $metadata['editorScript'] = array_values(array_unique(array_merge(['gcb-lite'], array_filter($own))));
        if (!empty($w['parents']) && empty($metadata['parent'])) {
            $metadata['parent'] = array_values(array_unique($w['parents']));
        }
        // SAFETY NET: instead of WP's native `render: file:./render.php` (a bare
        // require that white-screens the whole page if the template fatals), wire
        // a render_callback that try/catches the include. A fatal in one block
        // then renders empty on the front end (and a small note in the editor)
        // instead of taking down the page. Applies to every gcb/* block.
        if ($w['render'] !== '' && empty($metadata['render']) && empty($metadata['render_callback'])) {
            $metadata['render_callback'] = self::render_callback_for($w['render']);
        }
        return $metadata;
    }

    /**
     * `register_block_type_args` — WP 7.0 FIX: WordPress 7.0 no longer honours a
     * `render_callback` set via the `block_type_metadata` filter (above) — it's
     * discarded during registration, so every gcb/* block ends up with a NULL
     * callback and renders BLANK on the front end AND in the editor preview.
     * (Wasn't noticed because the AI builder renders via its own preview path,
     * not do_blocks().) This filter modifies the REGISTER ARGS, which WP 7.0 DOES
     * honour — so the same crash-safe render.php callback is wired here; harmless
     * alongside the metadata filter (whichever WP version honours its own path,
     * the callback is identical).
     *
     * @param array  $args
     * @param string $name
     * @return array
     */
    public static function filter_args($args, $name = '') {
        $render = is_string($name) && isset(self::$wiring[$name]) ? self::$wiring[$name]['render'] : '';
        if ($render !== '' && empty($args['render_callback'])) {
            $args['render_callback'] = self::render_callback_for($render);
        }
        if ($render !== '' && !isset($args['skip_inner_blocks'])) {
            // The children are rendered by safe_render (render_children), once, with their context.
            $args['skip_inner_blocks'] = true;
        }
        return $args;
    }

    /** The crash-safe render of one render.php (safe_render). */
    private static function render_callback_for(string $renderFile): callable {
        return static function ($attributes, $content, $block) use ($renderFile) {
            return self::safe_render($renderFile, $attributes, $content, $block);
        };
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

        // Third: with every block known, each field type's contract — what it
        // needs from the block around it (ContractChecks). Warns under WP_DEBUG.
        \GCBLite\Fields\ContractChecks::warn();
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

    /** @internal for tests: a registered block's stored config, without a folder on disk. */
    public static function remember_block(string $name, array $config): void {
        self::$blocks[$name] = $config;
    }

    /** @internal for tests: forget every remembered block. */
    public static function forget_blocks(): void {
        self::$blocks = [];
    }

    /** Names of every gcb/* block registered from a folder this request. */
    public static function block_names() {
        return array_keys(self::$blocks);
    }

    /**
     * The child blocks a block's <Repeater> markers allow (or its
     * `allowed_blocks`), in order — what a pin map places, what a layout lays out.
     *
     * @return string[]
     */
    public static function children_of($block_name) {
        if (isset(self::$blocks[$block_name]['children'])) {
            return (array) self::$blocks[$block_name]['children'];
        }
        $dir = self::$blocks[$block_name]['dir'] ?? '';
        return $dir !== '' ? self::discover_allowed_children($dir) : [];
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

        // What this block needs at registration, kept by its name: ONE callback on each
        // filter looks it up (filter_metadata, filter_args — added once, in init()). A
        // closure per block here meant every registration ran every block's closure:
        // N² checks for N blocks, 1.4 s of every request on a site with 2,923 drafts.
        self::wire($block_json['name'], [
            'attributes' => $generated_attributes,
            'parents'    => $parents,
            'render'     => $has_render_php ? $block_dir . '/render.php' : '',
        ]);

        // Register from directory. (render_callback wired via register_block_type_args for
        // WP 7.0 + the metadata filter for older WP; WP picks up everything else from block.json.)
        $block_type = register_block_type($block_dir);

        if ($block_type) {
            self::tune_assets($block_type, $block_dir);
            self::$blocks[$block_json['name']] = [
                'block_json' => $block_json,
                'dir'        => $block_dir,
                'fields'     => $fields_config,
                'attributes' => array_keys($generated_attributes),
            ];
        }
    }

    /**
     * A registered block's own files, tuned:
     *
     *   - VERSIONED BY THEIR MODIFIED TIME. WordPress versions a block's
     *     `file:` assets with the WP version, so browsers kept a stale
     *     style.css / view.js after every edit (2026-10-07; the Showman's Show
     *     theme carried a workaround).
     *   - THE BLOCK'S OWN EDITOR SCRIPT RUNS AFTER GCB'S, so window.gcbLiteEditor
     *     (the overlay bridge) is there when it does.
     */
    private static function tune_assets($block_type, string $block_dir): void {
        if (!function_exists('wp_scripts') || !function_exists('wp_styles')) {
            return;
        }
        $dir = wp_normalize_path(trailingslashit($block_dir));
        $groups = [
            [wp_scripts(), array_merge((array) $block_type->editor_script_handles, (array) $block_type->view_script_handles, (array) $block_type->script_handles)],
            [wp_styles(), array_merge((array) $block_type->style_handles, (array) $block_type->editor_style_handles, (array) $block_type->view_style_handles)],
        ];
        foreach ($groups as [$deps, $handles]) {
            foreach (array_unique($handles) as $handle) {
                $dep = $deps->registered[$handle] ?? null;
                if (!$dep || !is_string($dep->src) || $dep->src === '') {
                    continue;
                }
                $file = self::file_for_src($dep->src, $dir);
                if ($file === '') {
                    continue; // not one of this block's files (e.g. gcb-lite itself)
                }
                $dep->ver = (string) filemtime($file);
                if ($deps === wp_scripts() && in_array($handle, (array) $block_type->editor_script_handles, true) && $handle !== 'gcb-lite' && !in_array('gcb-lite', $dep->deps, true)) {
                    $dep->deps[] = 'gcb-lite';
                }
            }
        }
    }

    /** The block folder's file behind an asset URL, or '' when it isn't one. */
    private static function file_for_src(string $src, string $dir): string {
        $path = wp_parse_url($src, PHP_URL_PATH);
        if (!is_string($path) || $path === '') {
            return '';
        }
        $base = basename($path);
        $file = $dir . $base;
        // The asset is this block's when it sits in the block folder under that name
        // and the URL path ends with the folder's own name + file.
        if (is_file($file) && substr($path, -strlen(basename(rtrim($dir, '/')) . '/' . $base)) === basename(rtrim($dir, '/')) . '/' . $base) {
            return $file;
        }
        return '';
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

        /* THE CHILDREN, ONCE AND IN THEIR PLACE (2026-10-07, found giving cards their number — TODO "Parent ↔ child
           context"). A <Repeater> / <InnerBlocks> marker used to be filled by InnerBlocksReplacer rendering every
           child again on its own: no parent, so no context (core providesContext, BlockContext's gcb/index), and
           every child rendered twice — WP_Block::render had already rendered them into $content. Now the block type
           skips WordPress's pass (filter_args: skip_inner_blocks) and the children are rendered here, as core would
           render them: $content for a template that prints it (the saved whitespace between children included, as
           before), the children alone for the markers (as before). Not on the editor's own render path
           (RenderAPI), which hands its own $content and swaps markers itself. */
        $children = null;
        if ($block instanceof \WP_Block && $content === '' && !empty($block->block_type->skip_inner_blocks) && !empty($block->parsed_block['innerBlocks'])) {
            [$content, $children] = self::render_children($block);
        }

        try {
            $html = $run($renderFile, $attributes, $content, $block);
            if ($children !== null) {
                $html = \GCBLite\Rendering\InnerBlocksReplacer::replace($html, $children);
            }
            return $html;
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
     * A block's children rendered the way WP_Block::render renders them (the same filters, in the same order — so
     * render_block_context gives each its context), for a block type that skips that pass.
     *
     * @return array{0: string, 1: string} [$content — chunks and children, as WordPress builds it; the children alone]
     */
    private static function render_children(\WP_Block $block) {
        $content  = '';
        $children = '';
        $i        = 0;
        foreach ((array) $block->inner_content as $chunk) {
            if (is_string($chunk)) {
                $content .= $chunk;
                continue;
            }
            $inner = $block->inner_blocks[$i] ?? null;
            ++$i;
            if (!$inner instanceof \WP_Block) {
                continue;
            }
            $html = apply_filters('pre_render_block', null, $inner->parsed_block, $block);
            if ($html === null) {
                $source  = $inner->parsed_block;
                $context = $inner->context;
                $inner->parsed_block = apply_filters('render_block_data', $inner->parsed_block, $source, $block);
                $inner->context      = apply_filters('render_block_context', $inner->context, $inner->parsed_block, $block);
                if ($inner->context !== $context) {
                    $inner->refresh_context_dependents();
                } elseif ($inner->parsed_block !== $source) {
                    $inner->refresh_parsed_block_dependents();
                }
                $html = $inner->render();
            }
            $content  .= $html;
            $children .= $html;
        }
        return [$content, $children];
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
        return self::attributes_for($controls);
    }

    /**
     * Map controls → WP attribute definitions. Delegated to the wordpress-gcb/fields
     * SDK — the same block.fields.json → block attributes logic, extracted so
     * headless/standalone blocks can register typed attributes without this
     * plugin (the php-sdk repo). Types the SDK doesn't know are typed here: its
     * map has no entry for point, hotspots or background, so each came out
     * `string` — and the editor drops a string attribute that holds an object
     * when it parses the block (2026-10-03). Those types — Lite's own and any a
     * theme or plugin registers — come from the ControlTypes registry, typed as
     * the shape they were registered with (2026-10-07; this was a hard-coded list).
     */
    public static function attributes_for(array $controls): array {
        $attrs = \GCBFields\Schema::attributes($controls);
        foreach ($controls as $c) {
            $key   = (string) ($c['attributeKey'] ?? '');
            $shape = \GCBLite\Fields\ControlTypes::shape((string) ($c['type'] ?? ''));
            if ($key === '' || $shape === null || !isset($attrs[$key]) || ($attrs[$key]['type'] ?? '') === $shape) {
                continue;
            }
            $attrs[$key]['type'] = $shape;
            $attrs[$key]['default'] = self::default_for_shape($c['default'] ?? null, $shape);
        }
        return $attrs;
    }

    /** The control's own default when it has that shape, else the shape's empty value. */
    private static function default_for_shape($default, string $shape) {
        $fits = [
            'object'  => is_array($default) || is_object($default),
            'array'   => is_array($default),
            'string'  => is_string($default),
            'number'  => is_int($default) || is_float($default),
            'integer' => is_int($default),
            'boolean' => is_bool($default),
        ];
        if ($default !== null && !empty($fits[$shape])) {
            return $default;
        }
        return $shape === 'integer' ? 0 : \GCBFields\Schema::default_value($shape);
    }
}
