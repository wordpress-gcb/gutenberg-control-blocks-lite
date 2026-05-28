<?php
/**
 * `wp gcblite scaffold` — generate a new block in the active theme.
 *
 * Thin wrapper over GCBLite\Scaffold\BlockScaffolder — same code path
 * the wp-admin schema-builder REST endpoint uses, so any improvement
 * to scaffolding semantics applies to both surfaces automatically.
 *
 * @package GCBLite\CLI
 */

namespace GCBLite\CLI;

use GCBLite\Scaffold\BlockScaffolder;
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

        $result = BlockScaffolder::create($spec, [
            'force'   => !empty($assoc_args['force']),
            'dry_run' => !empty($assoc_args['dry-run']),
        ]);

        if (!$result['ok']) {
            WP_CLI::warning('Block spec failed validation:');
            foreach ($result['errors'] as $err) {
                $path = $err['path'] !== '' ? "[{$err['path']}] " : '';
                WP_CLI::line('  ✗ ' . $path . $err['message']);
            }
            WP_CLI::error('Aborted.');
            return;
        }

        if (!empty($assoc_args['dry-run'])) {
            WP_CLI::line(json_encode($result['block_json'] ?? null, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
            WP_CLI::line('');
            WP_CLI::line('Files that would be written:');
            foreach ($result['files'] as $f) {
                WP_CLI::line('  • ' . $f);
            }
            return;
        }

        WP_CLI::success("Block created: {$result['block_name']}");
        WP_CLI::line("  Directory: {$result['block_dir']}");
        foreach ($result['files'] as $f) {
            WP_CLI::line('  • ' . basename($f));
        }
    }

    /**
     * Build a normalised spec from CLI args, --spec, or --stdin.
     * The BlockScaffolder works on this same shape.
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
                'title'       => $assoc_args['title']       ?? BlockScaffolder::humanise($name),
                'description' => $assoc_args['description'] ?? '',
                'icon'        => $assoc_args['icon']        ?? 'admin-generic',
                'category'    => $assoc_args['category']    ?? 'widgets',
            ],
            'gcb' => [
                'controls' => BlockScaffolder::parse_controls_csv($assoc_args['controls'] ?? ''),
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
}
