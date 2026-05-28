<?php
/**
 * BlockScaffolder — create a gcb-lite block on disk from a normalised spec.
 *
 * Pure PHP — no CLI dependency, no REST dependency. Returns structured
 * results so callers (wp-cli, wp-admin builder REST, future MCP server)
 * can present errors however suits them.
 *
 * Spec shape:
 *   [
 *     'block_name' => 'team-grid',           // gcb/{block_name}
 *     'meta' => [
 *       'title'       => 'Team Grid',
 *       'description' => '',
 *       'icon'        => 'admin-users',
 *       'category'    => 'widgets',
 *     ],
 *     'gcb' => [
 *       'controls'        => [ ... ],         // optional — written to block.fields.json
 *       'allowed_blocks'  => null|[ ... ],
 *     ],
 *     'render_mode' => 'php' | 'react',       // optional, default 'php'
 *     'target_dir'  => '/abs/path/...',        // optional, defaults to active theme
 *   ]
 *
 * Result shape:
 *   [
 *     'ok'          => bool,
 *     'block_name'  => 'gcb/team-grid',
 *     'block_dir'   => '/abs/path/.../blocks/team-grid',
 *     'files'       => [ '/abs/path/.../block.json', ... ],
 *     'errors'      => [ ['path' => '...', 'message' => '...'], ... ],
 *   ]
 *
 * @package GCBLite\Scaffold
 */

namespace GCBLite\Scaffold;

use GCBLite\Validation\BlockGcbValidator;

if (!defined('ABSPATH')) {
    exit;
}

class BlockScaffolder {

    /**
     * Default block dir for the spec — active theme's blocks/{name}/.
     * Exposed so callers (e.g. the builder UI's "target picker") can
     * show this as the default before the author overrides it.
     */
    public static function default_target_dir($block_name) {
        return trailingslashit(get_stylesheet_directory()) . 'blocks/' . $block_name;
    }

    /**
     * Validate the spec against BlockGcbValidator and return a normalised
     * result. Doesn't touch disk — useful for "dry run" callers.
     *
     * @return array{ok: bool, errors: array<int, array{path: string, message: string}>}
     */
    public static function validate(array $spec) {
        if (empty($spec['block_name'])) {
            return [
                'ok'     => false,
                'errors' => [['path' => 'block_name', 'message' => '`block_name` is required.']],
            ];
        }
        if (!preg_match('/^[a-z][a-z0-9-]*$/', $spec['block_name'])) {
            return [
                'ok'     => false,
                'errors' => [['path' => 'block_name', 'message' => '`block_name` must be lowercase letters, digits, hyphens; starting with a letter.']],
            ];
        }
        return BlockGcbValidator::validate(array_merge(
            ['block_name' => $spec['block_name']],
            $spec['gcb'] ?? []
        ));
    }

    /**
     * Build the block.json structure from a spec without writing it.
     * Available so the wp-admin builder can preview the resolved JSON
     * before the author hits Save.
     */
    public static function build_block_json(array $spec) {
        $meta = $spec['meta'] ?? [];
        return [
            '$schema'     => 'https://schemas.wp.org/trunk/block.json',
            'apiVersion'  => 3,
            'name'        => 'gcb/' . $spec['block_name'],
            'title'       => $meta['title']       ?? self::humanise($spec['block_name']),
            'category'    => $meta['category']    ?? 'widgets',
            'icon'        => $meta['icon']        ?? 'core/layout',
            'description' => $meta['description'] ?? '',
            'textdomain'  => 'gcb',
            'attributes'  => (object) [],
            'supports'    => (object) [],
            'style'       => 'file:./style.css',
        ];
    }

    /**
     * Build a starter render.php body. Caller decides whether to
     * actually write it (React-mode blocks don't get one).
     */
    public static function build_default_render_php(array $spec) {
        $name  = $spec['block_name'];
        $class = 'gcblite-' . $name;
        return <<<PHP
<?php
/**
 * {$name} — render template.
 *
 * @var array \$attributes  Block attributes (declared in block.json's `gcb.controls`)
 * @var string \$content    Inner-block content
 */

\$wrapper_attributes = get_block_wrapper_attributes(['class' => '{$class}']);
?>
<div <?php echo \$wrapper_attributes; ?>>
    <?php echo \$content; ?>
</div>
PHP;
    }

    /**
     * Do the actual filesystem work. Validates first; bails on validation
     * failure with a populated errors array (no partial writes).
     *
     * Options:
     *   - force    : overwrite an existing block dir (default false)
     *   - dry_run  : skip all disk writes (default false). 'files' in the
     *                result will list what WOULD be written.
     */
    public static function create(array $spec, array $options = []) {
        $force   = !empty($options['force']);
        $dry_run = !empty($options['dry_run']);

        $validation = self::validate($spec);
        if (!$validation['ok']) {
            return [
                'ok'         => false,
                'block_name' => 'gcb/' . ($spec['block_name'] ?? ''),
                'block_dir'  => '',
                'files'      => [],
                'errors'     => $validation['errors'],
            ];
        }

        $block_dir = $spec['target_dir'] ?? self::default_target_dir($spec['block_name']);
        $block_dir = untrailingslashit($block_dir);

        if (!$dry_run && is_dir($block_dir) && !$force) {
            return [
                'ok'         => false,
                'block_name' => 'gcb/' . $spec['block_name'],
                'block_dir'  => $block_dir,
                'files'      => [],
                'errors'     => [[
                    'path'    => 'target_dir',
                    'message' => "Block directory already exists: {$block_dir}. Pass force: true to overwrite.",
                ]],
            ];
        }

        $block_json    = self::build_block_json($spec);
        $fields_config = $spec['gcb'] ?? [];
        $render_mode   = $spec['render_mode'] ?? 'php';

        $files = [];
        $files[] = $block_dir . '/block.json';
        if (!empty($fields_config['controls'])) {
            $files[] = $block_dir . '/block.fields.json';
        }
        if ($render_mode !== 'react') {
            $files[] = $block_dir . '/render.php';
        }
        $files[] = $block_dir . '/style.css';

        if ($dry_run) {
            return [
                'ok'         => true,
                'block_name' => 'gcb/' . $spec['block_name'],
                'block_dir'  => $block_dir,
                'files'      => $files,
                'errors'     => [],
                'block_json' => $block_json,
            ];
        }

        if (!is_dir($block_dir)) {
            wp_mkdir_p($block_dir);
        }

        $written = [];

        $path = $block_dir . '/block.json';
        file_put_contents($path, wp_json_encode($block_json, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
        $written[] = $path;

        if (!empty($fields_config['controls'])) {
            $path = $block_dir . '/block.fields.json';
            file_put_contents($path, wp_json_encode($fields_config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
            $written[] = $path;
        }

        if ($render_mode !== 'react') {
            $path = $block_dir . '/render.php';
            file_put_contents($path, self::build_default_render_php($spec));
            $written[] = $path;
        }

        $path = $block_dir . '/style.css';
        file_put_contents($path, "/* {$spec['block_name']} — frontend + editor styles */\n");
        $written[] = $path;

        return [
            'ok'         => true,
            'block_name' => 'gcb/' . $spec['block_name'],
            'block_dir'  => $block_dir,
            'files'      => $written,
            'errors'     => [],
        ];
    }

    /**
     * Parse the CLI's `--controls=foo:text,bar:textarea:Bar` shorthand
     * into a controls[] array. Kept in the scaffolder rather than the
     * CLI so the same parser is available to any caller wanting the
     * shorthand syntax (e.g. an MCP tool input).
     */
    public static function parse_controls_csv($csv) {
        if (!is_string($csv) || trim($csv) === '') {
            return [];
        }
        $controls = [];
        foreach (explode(',', $csv) as $entry) {
            $entry = trim($entry);
            if ($entry === '') continue;
            $parts    = array_map('trim', explode(':', $entry));
            $attr_key = $parts[0] ?? '';
            $type     = $parts[1] ?? 'text';
            $label    = $parts[2] ?? self::humanise($attr_key);
            if ($attr_key === '') continue;
            $controls[] = [
                'id'           => 'ctrl_' . $attr_key,
                'type'         => $type,
                'label'        => $label,
                'attributeKey' => $attr_key,
            ];
        }
        return $controls;
    }

    /**
     * "team-grid" → "Team Grid". Used for default titles + labels when
     * the caller didn't supply one.
     */
    public static function humanise($slug) {
        return ucwords(str_replace(['-', '_'], ' ', (string) $slug));
    }
}
