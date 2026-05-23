<?php
/**
 * `wp gcblite scaffold` — generate a new block in the active theme.
 *
 * Writes block.json, block.fields.json (controls), render.php, style.css.
 * Validates against BlockGcbValidator before writing anything.
 *
 * @package GCBLite\CLI
 */

namespace GCBLite\CLI;

use GCBLite\Validation\BlockGcbValidator;
use WP_CLI;

if (!defined('ABSPATH')) {
    exit;
}

class ScaffoldCommand {

    /**
     * Generate a GCB Lite block.
     *
     * ## OPTIONS
     *
     * [<name>]
     * : Block slug (lowercase, hyphenated). Required unless --spec or --stdin.
     *
     * [--title=<title>]
     * : Display title. Defaults to a title-cased version of <name>.
     *
     * [--description=<description>]
     * : Block description.
     *
     * [--icon=<icon>]
     * : Dashicon name. Default: admin-generic.
     *
     * [--category=<category>]
     * : Block category. Default: widgets.
     *
     * [--controls=<csv>]
     * : Control definitions as attributeKey:type[:Label] pairs joined by commas.
     *
     * [--spec=<file>]
     * : Path to a JSON spec describing the block.
     *
     * [--stdin]
     * : Read a JSON spec from stdin (for AI agents).
     *
     * [--force]
     * : Overwrite an existing block directory.
     *
     * [--dry-run]
     * : Print the resolved block.json without writing files.
     *
     * ## EXAMPLES
     *
     *     wp gcblite scaffold team-grid --title="Team Grid" --controls="heading:text,intro:textarea"
     *     wp gcblite scaffold --spec=./team-grid.json
     *     cat team-grid.json | wp gcblite scaffold --stdin
     *
     * @when after_wp_load
     */
    public function __invoke($args, $assoc_args) {
        $spec = $this->resolve_spec($args, $assoc_args);

        // Validate before doing anything else.
        $validation = BlockGcbValidator::validate(array_merge(
            ['block_name' => $spec['block_name']],
            $spec['gcb'] ?? []
        ));
        if (!$validation['ok']) {
            $this->report_validation_errors($validation['errors']);
            return;
        }

        $block_json = $this->build_block_json($spec);

        if (!empty($assoc_args['dry-run'])) {
            WP_CLI::line(json_encode($block_json, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
            return;
        }

        $block_dir = trailingslashit(get_stylesheet_directory()) . 'blocks/' . $spec['block_name'];

        if (file_exists($block_dir) && empty($assoc_args['force'])) {
            WP_CLI::error("Block directory already exists: {$block_dir}\nUse --force to overwrite.");
        }

        if (!file_exists($block_dir)) {
            wp_mkdir_p($block_dir);
        }

        file_put_contents(
            $block_dir . '/block.json',
            json_encode($block_json, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n"
        );

        // Controls live in a sibling block.fields.json — that's what
        // BlockLoader::load_fields_config() reads. Skip the file if the spec
        // has no controls; the plugin treats absence as "no Inspector UI".
        $fields_config = $spec['gcb'] ?? [];
        if (!empty($fields_config['controls'])) {
            file_put_contents(
                $block_dir . '/block.fields.json',
                json_encode($fields_config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n"
            );
        }

        file_put_contents($block_dir . '/render.php', $this->default_render_php($spec));
        file_put_contents($block_dir . '/style.css', "/* {$spec['block_name']} — frontend + editor styles */\n");

        WP_CLI::success("Block created: gcb/{$spec['block_name']}");
        WP_CLI::line("  Directory: {$block_dir}");
    }

    /**
     * Build the spec from CLI args, --spec, or stdin. Returns a normalised
     * shape: ['block_name', 'meta', 'gcb'].
     */
    private function resolve_spec(array $args, array $assoc_args) {
        if (!empty($assoc_args['stdin'])) {
            return $this->spec_from_json(file_get_contents('php://stdin'), 'stdin');
        }
        if (!empty($assoc_args['spec'])) {
            $path = $assoc_args['spec'];
            if (!file_exists($path)) {
                WP_CLI::error("Spec file not found: {$path}");
            }
            return $this->spec_from_json(file_get_contents($path), $path);
        }
        if (empty($args[0])) {
            WP_CLI::error('Block name is required (or pass --spec / --stdin).');
        }

        $name = $args[0];
        return [
            'block_name' => $name,
            'meta' => [
                'title'       => $assoc_args['title']       ?? $this->humanise($name),
                'description' => $assoc_args['description'] ?? '',
                'icon'        => $assoc_args['icon']        ?? 'admin-generic',
                'category'    => $assoc_args['category']    ?? 'widgets',
            ],
            'gcb' => [
                'controls' => $this->parse_controls_csv($assoc_args['controls'] ?? ''),
            ],
        ];
    }

    private function spec_from_json($json, $source) {
        $decoded = json_decode($json, true);
        if (!is_array($decoded)) {
            WP_CLI::error("Invalid JSON in {$source}: " . json_last_error_msg());
        }
        if (empty($decoded['block_name'])) {
            WP_CLI::error("Spec from {$source} missing `block_name`.");
        }
        return [
            'block_name' => $decoded['block_name'],
            'meta'       => $decoded['meta'] ?? [],
            'gcb'        => $decoded['gcb']  ?? [],
        ];
    }

    private function parse_controls_csv($csv) {
        if (!is_string($csv) || trim($csv) === '') {
            return [];
        }
        $controls = [];
        foreach (explode(',', $csv) as $i => $entry) {
            $entry = trim($entry);
            if ($entry === '') continue;
            $parts    = array_map('trim', explode(':', $entry));
            $attr_key = $parts[0] ?? '';
            $type     = $parts[1] ?? 'text';
            $label    = $parts[2] ?? $this->humanise($attr_key);
            if ($attr_key === '') {
                WP_CLI::warning("Skipping malformed --controls entry #{$i}: `{$entry}`");
                continue;
            }
            $controls[] = [
                'id'           => 'ctrl_' . $attr_key,
                'type'         => $type,
                'label'        => $label,
                'attributeKey' => $attr_key,
            ];
        }
        return $controls;
    }

    private function build_block_json(array $spec) {
        $meta = $spec['meta'] ?? [];
        // block.json holds only standard WordPress block metadata. Controls
        // live in a sibling block.fields.json. Attributes are auto-generated
        // from those controls at registration time (see
        // BlockLoader::generate_attributes), so we leave `attributes: {}` —
        // hand-writing them here would shadow the generated set.
        return [
            '$schema'     => 'https://schemas.wp.org/trunk/block.json',
            'apiVersion'  => 3,
            'name'        => 'gcb/' . $spec['block_name'],
            'title'       => $meta['title']       ?? $this->humanise($spec['block_name']),
            'category'    => $meta['category']    ?? 'widgets',
            'icon'        => $meta['icon']        ?? 'admin-generic',
            'description' => $meta['description'] ?? '',
            'textdomain'  => 'gcb',
            'attributes'  => (object) [],
            'supports'    => (object) [],
            'style'       => 'file:./style.css',
        ];
    }

    private function default_render_php(array $spec) {
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

    private function humanise($slug) {
        return ucwords(str_replace(['-', '_'], ' ', (string) $slug));
    }

    private function report_validation_errors(array $errors) {
        WP_CLI::warning('Block spec failed validation:');
        foreach ($errors as $err) {
            $path = $err['path'] !== '' ? "[{$err['path']}] " : '';
            WP_CLI::line('  ✗ ' . $path . $err['message']);
        }
        WP_CLI::error('Aborted.');
    }
}
