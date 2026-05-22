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
     */
    private static function scan_block_dirs() {
        $blocks_root = trailingslashit(get_stylesheet_directory()) . 'blocks';
        if (!is_dir($blocks_root)) {
            return [];
        }
        return array_filter(
            glob($blocks_root . '/*', GLOB_ONLYDIR) ?: [],
            fn($dir) => file_exists($dir . '/block.json')
        );
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

        add_filter('block_type_metadata', function ($metadata) use ($block_json, $generated_attributes, $parents, $has_render_php) {
            if (($metadata['name'] ?? null) !== $block_json['name']) {
                return $metadata;
            }
            $metadata['attributes'] = array_merge(
                $metadata['attributes'] ?? [],
                $generated_attributes
            );
            if (empty($metadata['editorScript']) && empty($metadata['editor_script'])) {
                $metadata['editorScript'] = 'gcb-lite';
            }
            if (!empty($parents) && empty($metadata['parent'])) {
                $metadata['parent'] = array_values(array_unique($parents));
            }
            if ($has_render_php && empty($metadata['render'])) {
                $metadata['render'] = 'file:./render.php';
            }
            return $metadata;
        });

        // Register from directory — WP picks up render: file:./render.php natively.
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
        $attributes = [];

        foreach ($controls as $control) {
            // Structural controls (group / panel / tools-panel) render an
            // Inspector panel header and produce no attribute.
            if (in_array($control['type'] ?? null, BlockGcbValidator::STRUCTURAL_TYPES, true)) {
                continue;
            }

            $key = $control['attributeKey'] ?? null;
            if (!is_string($key) || $key === '') {
                continue;
            }

            $attribute_type = $control['attributeType'] ?? self::default_attribute_type($control['type'] ?? '');
            $attributes[$key] = [
                'type'    => $attribute_type,
                'default' => $control['default'] ?? self::default_value($attribute_type),
            ];
        }

        return $attributes;
    }

    private static function default_attribute_type($control_type) {
        $map = [
            'number'         => 'number',
            'range'          => 'number',
            'toggle'         => 'boolean',
            'checkbox'       => 'boolean',
            'checkbox-group' => 'array',
            'image'          => 'object',
            'gallery'        => 'array',
            'file'           => 'object',
            'post-object'    => 'object',
            'taxonomy'       => 'array',
            'user'           => 'object',
            'relationship'   => 'array',
            'icon'           => 'object',
            'url'            => 'object',
            'google-map'    => 'object',
            'repeater'       => 'array',
        ];
        return $map[$control_type] ?? 'string';
    }

    private static function default_value($attribute_type) {
        switch ($attribute_type) {
            case 'number':  return 0;
            case 'boolean': return false;
            case 'array':   return [];
            case 'object':  return (object) [];
            default:        return '';
        }
    }
}
