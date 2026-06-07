<?php
/**
 * BuilderAPI — REST surface for the wp-admin Schema Builder UI.
 *
 * Three endpoints under gcblite/v1/builder/:
 *
 *   GET  /blocks                 List every gcb-lite block discoverable in
 *                                 the active theme + plugin examples dir.
 *                                 Returns {name, slug, dir, has_fields,
 *                                 has_render_php, target_kind}.
 *
 *   POST /blocks                 Register a new block. Spec body matches
 *                                 BlockScaffolder::create. Caller can pass
 *                                 target_dir; defaults to active theme.
 *
 *   POST /blocks/{slug}/fields   Write block.fields.json for an existing
 *                                 block. Body: { content: { controls: [...] } }.
 *                                 Validates via BlockGcbValidator before
 *                                 touching disk.
 *
 * All write endpoints gated on `edit_themes` cap (the same capability
 * required to edit theme files in WP's built-in theme editor — anyone
 * who can do that should be allowed to use the builder).
 *
 * Writes can be disabled entirely with:
 *
 *   define('GCBLITE_BUILDER_DISABLE_WRITES', true);
 *
 * Useful on managed hosts where filesystem writes from wp-admin are
 * policy-disallowed. List endpoint stays available so the read-only
 * "what's there" view still works for inspection.
 *
 * @package GCBLite\RestAPI
 */

namespace GCBLite\RestAPI;

use GCBLite\Docs\ControlDocs;
use GCBLite\Scaffold\BlockScaffolder;
use GCBLite\Validation\BlockGcbValidator;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

if (!defined('ABSPATH')) {
    exit;
}

class BuilderAPI {

    const NAMESPACE = 'gcblite/v1';

    public static function init() {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function register_routes() {
        register_rest_route(self::NAMESPACE, '/builder/blocks', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [__CLASS__, 'list_blocks'],
                'permission_callback' => [__CLASS__, 'permission_read'],
            ],
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [__CLASS__, 'create_block'],
                'permission_callback' => [__CLASS__, 'permission_write'],
            ],
        ]);

        // Per-control docs — read from the same schemas/controls/{type}.md
        // files the docs site reads. Drives the right-pane help panel
        // in the Edit Fields view.
        register_rest_route(self::NAMESPACE, '/builder/control-docs/(?P<type>[a-z][a-z0-9-]*)', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [__CLASS__, 'control_docs'],
            'permission_callback' => [__CLASS__, 'permission_read'],
            'args'                => [
                'type' => ['type' => 'string'],
            ],
        ]);

        register_rest_route(self::NAMESPACE, '/builder/blocks/(?P<slug>[a-z][a-z0-9-]*)/fields', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [__CLASS__, 'read_fields'],
                'permission_callback' => [__CLASS__, 'permission_read'],
                'args'                => [
                    'slug' => ['type' => 'string'],
                ],
            ],
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [__CLASS__, 'write_fields'],
                'permission_callback' => [__CLASS__, 'permission_write'],
                'args'                => [
                    'slug' => ['type' => 'string'],
                ],
            ],
        ]);

        // Structured fields — JSON schemas autoloaded by
        // StructuredFields\Autoloader. List endpoint enumerates all four
        // kinds; per-item read/write endpoints mirror the block-fields
        // shape so the React side can reuse the EditFields view.
        register_rest_route(self::NAMESPACE, '/builder/structured-fields', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [__CLASS__, 'list_structured_fields'],
            'permission_callback' => [__CLASS__, 'permission_read'],
        ]);

        register_rest_route(
            self::NAMESPACE,
            '/builder/structured-fields/(?P<kind>post|taxonomy|user|options)(?:/(?P<id>[a-z][a-z0-9_-]*))?',
            [
                [
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => [__CLASS__, 'read_structured_fields'],
                    'permission_callback' => [__CLASS__, 'permission_read'],
                ],
                [
                    'methods'             => WP_REST_Server::CREATABLE,
                    'callback'            => [__CLASS__, 'write_structured_fields'],
                    'permission_callback' => [__CLASS__, 'permission_write'],
                ],
            ]
        );

        // Design tokens — read the live theme.json token tree for the field
        // token-picker, and (write) append a custom token to the theme.
        register_rest_route(self::NAMESPACE, '/builder/tokens', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [__CLASS__, 'read_tokens'],
            'permission_callback' => [__CLASS__, 'permission_read'],
        ]);

        register_rest_route(self::NAMESPACE, '/builder/tokens/custom', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [__CLASS__, 'write_custom_token'],
            'permission_callback' => [__CLASS__, 'permission_write'],
            'args'                => [
                'category' => ['type' => 'string', 'required' => true],
                'slug'     => ['type' => 'string', 'required' => true],
                'value'    => ['type' => 'string', 'required' => true],
                'name'     => ['type' => 'string', 'default' => ''],
            ],
        ]);

        // Custom post types — config-driven (PostTypes\PostTypeRegistrar).
        register_rest_route(self::NAMESPACE, '/builder/post-types', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [__CLASS__, 'list_post_types'],
                'permission_callback' => [__CLASS__, 'permission_read'],
            ],
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [__CLASS__, 'write_post_type'],
                'permission_callback' => [__CLASS__, 'permission_write'],
                'args'                => [
                    'config' => ['type' => 'object', 'required' => true],
                ],
            ],
        ]);
    }

    // --------------------------------------------------------------------
    // Tokens
    // --------------------------------------------------------------------

    /** GET /builder/tokens — the live theme.json token tree (colours, type, spacing, custom). */
    public static function read_tokens() {
        return rest_ensure_response([
            'tokens' => \GCBLite\Tokens\TokenParser::tokens_for_editor(),
        ]);
    }

    /** POST /builder/tokens/custom — append a custom token to the theme's theme.json. */
    public static function write_custom_token(WP_REST_Request $request) {
        $res = \GCBLite\Tokens\CustomTokenWriter::add(
            (string) $request->get_param('category'),
            (string) $request->get_param('slug'),
            (string) $request->get_param('value'),
            (string) $request->get_param('name')
        );
        if (empty($res['ok'])) {
            // 409 — the write couldn't happen (not writable, bad input); the
            // client falls back to a one-off token.
            return new WP_Error('gcblite_token_write_failed', $res['error'] ?? 'Could not add the token.', ['status' => 409]);
        }
        return rest_ensure_response($res);
    }

    // --------------------------------------------------------------------
    // Custom post types (config-driven)
    // --------------------------------------------------------------------

    /** GET /builder/post-types — the CPTs GCB registers from config in this theme. */
    public static function list_post_types() {
        $out = [];
        foreach (\GCBLite\PostTypes\PostTypeRegistrar::configs() as $slug => $cfg) {
            $out[] = [
                'post_type'  => $slug,
                'label'      => $cfg['args']['label'] ?? $slug,
                'fields'     => count($cfg['fields']['controls'] ?? []),
                'taxonomies' => array_values(array_filter(array_map(
                    static fn($t) => is_array($t) ? ($t['taxonomy'] ?? null) : null,
                    $cfg['taxonomies'] ?? []
                ))),
            ];
        }
        return rest_ensure_response(['post_types' => $out]);
    }

    /** POST /builder/post-types — write a CPT config (registers on next load). */
    public static function write_post_type(WP_REST_Request $request) {
        $config = $request->get_param('config');
        if (!is_array($config)) {
            return new WP_Error('gcblite_bad_request', 'A `config` object is required.', ['status' => 400]);
        }
        $res = \GCBLite\PostTypes\PostTypeRegistrar::write($config);
        if (empty($res['ok'])) {
            return new WP_Error('gcblite_cpt_write_failed', $res['error'] ?? 'Could not create the post type.', ['status' => 422]);
        }
        return rest_ensure_response([
            'ok'        => true,
            'post_type' => $res['post_type'],
            'message'   => sprintf('Created post type “%s”.', $res['post_type']),
        ]);
    }

    // --------------------------------------------------------------------
    // Permissions
    // --------------------------------------------------------------------

    /**
     * Read endpoints need `edit_posts` — enough to ensure unauthenticated
     * users can't enumerate blocks (a low-risk fact but still meta).
     */
    public static function permission_read() {
        return current_user_can('edit_posts');
    }

    /**
     * Write endpoints need `edit_themes` — same cap that gates the
     * built-in theme file editor. Mirrors how invasive these writes
     * are: they create / modify files in the active theme dir.
     *
     * Hosts that disabled `edit_themes` on principle (DISALLOW_FILE_EDIT)
     * automatically block this. Hosts that didn't get a deliberate
     * second switch via GCBLITE_BUILDER_DISABLE_WRITES.
     */
    public static function permission_write() {
        if (defined('GCBLITE_BUILDER_DISABLE_WRITES') && GCBLITE_BUILDER_DISABLE_WRITES) {
            return new WP_Error(
                'gcblite_builder_writes_disabled',
                'Builder writes have been disabled on this site via GCBLITE_BUILDER_DISABLE_WRITES.',
                ['status' => 403]
            );
        }
        if (defined('DISALLOW_FILE_EDIT') && DISALLOW_FILE_EDIT) {
            return new WP_Error(
                'gcblite_builder_file_edit_disallowed',
                'File edits are disabled (DISALLOW_FILE_EDIT). The Schema Builder can list blocks but not write to disk.',
                ['status' => 403]
            );
        }
        return current_user_can('edit_themes');
    }

    // --------------------------------------------------------------------
    // GET /builder/blocks — discover what exists.
    // --------------------------------------------------------------------

    public static function list_blocks(WP_REST_Request $request) {
        $blocks = [];

        // Scan the active theme. Each subdir of `blocks/` that has a
        // block.json is a registered block. We don't trust block.json
        // to set name correctly — for routing purposes the dir name is
        // the slug; the file's `name` field is just informational.
        $theme_blocks_dir = trailingslashit(get_stylesheet_directory()) . 'blocks';
        if (is_dir($theme_blocks_dir)) {
            foreach (glob($theme_blocks_dir . '/*', GLOB_ONLYDIR) ?: [] as $dir) {
                $info = self::block_info_from_dir($dir, 'theme');
                if ($info) $blocks[] = $info;
            }
        }

        // Plugin examples dir — only surfaced when the plugin is loaded
        // with GCBLITE_LOAD_EXAMPLES enabled. Marked separately so the
        // UI can render them with a different affordance (read-only-ish).
        if (defined('GCBLITE_LOAD_EXAMPLES') && GCBLITE_LOAD_EXAMPLES) {
            $examples_dir = GCBLITE_PLUGIN_DIR . 'examples/blocks';
            if (is_dir($examples_dir)) {
                foreach (glob($examples_dir . '/*', GLOB_ONLYDIR) ?: [] as $dir) {
                    $info = self::block_info_from_dir($dir, 'plugin-examples');
                    if ($info) $blocks[] = $info;
                }
            }
        }

        // Sort alphabetically by slug for stable order across requests.
        usort($blocks, fn($a, $b) => strcmp($a['slug'], $b['slug']));

        return new WP_REST_Response([
            'blocks'         => $blocks,
            'writes_enabled' => self::permission_write() === true,
            'default_target' => trailingslashit(get_stylesheet_directory()) . 'blocks',
        ]);
    }

    /**
     * Return a normalised description of one block dir, or null if it
     * doesn't look like a gcb-lite block (missing block.json, etc.).
     */
    private static function block_info_from_dir($dir, $target_kind) {
        $block_json_path = $dir . '/block.json';
        if (!file_exists($block_json_path)) return null;
        $block_json = json_decode((string) file_get_contents($block_json_path), true);
        if (!is_array($block_json) || empty($block_json['name'])) return null;

        return [
            'name'           => $block_json['name'],
            'slug'           => basename($dir),
            'title'          => $block_json['title'] ?? basename($dir),
            'category'       => $block_json['category'] ?? 'widgets',
            'icon'           => $block_json['icon'] ?? null,
            'description'    => $block_json['description'] ?? '',
            'dir'            => $dir,
            'has_fields'     => file_exists($dir . '/block.fields.json'),
            'has_render_php' => file_exists($dir . '/render.php'),
            'target_kind'    => $target_kind, // 'theme' | 'plugin-examples'
        ];
    }

    // --------------------------------------------------------------------
    // POST /builder/blocks — create a new block.
    // --------------------------------------------------------------------

    public static function create_block(WP_REST_Request $request) {
        $spec = $request->get_json_params();
        if (!is_array($spec)) {
            return new WP_Error('gcblite_bad_request', 'Body must be a JSON object.', ['status' => 400]);
        }

        // Default the target_dir to the active theme's blocks/{slug}/
        // when the caller doesn't supply one. BlockScaffolder also does
        // this defaulting but here so the response can echo the resolved
        // path back to the UI even on validation failure.
        if (empty($spec['target_dir']) && !empty($spec['block_name'])) {
            $spec['target_dir'] = BlockScaffolder::default_target_dir($spec['block_name']);
        }

        $result = BlockScaffolder::create($spec, [
            'force'   => !empty($spec['force']),
            'dry_run' => !empty($spec['dry_run']),
        ]);

        if (!$result['ok']) {
            return new WP_Error(
                'gcblite_scaffold_failed',
                'Block scaffolder returned errors.',
                ['status' => 422, 'errors' => $result['errors']]
            );
        }

        return new WP_REST_Response($result, $request->get_method() === 'POST' ? 201 : 200);
    }

    // --------------------------------------------------------------------
    // GET /builder/blocks/{slug}/fields — current block.fields.json.
    // --------------------------------------------------------------------

    public static function read_fields(WP_REST_Request $request) {
        $slug = (string) $request->get_param('slug');
        $dir  = self::resolve_block_dir($slug);
        if (!$dir) {
            return new WP_Error('gcblite_not_found', "Block `{$slug}` not found in the active theme.", ['status' => 404]);
        }

        // Always pull block.json metadata too — the editor now shows it
        // in the header strip and saves it alongside fields.
        $block_json = self::read_block_json($dir);
        $meta = self::extract_meta($block_json);

        $path = $dir . '/block.fields.json';
        if (!file_exists($path)) {
            return new WP_REST_Response([
                'slug'    => $slug,
                'path'    => $path,
                'exists'  => false,
                'content' => null,
                'meta'    => $meta,
            ]);
        }

        $raw = (string) file_get_contents($path);
        $parsed = json_decode($raw, true);

        return new WP_REST_Response([
            'slug'    => $slug,
            'path'    => $path,
            'exists'  => true,
            'content' => is_array($parsed) ? $parsed : null,
            'raw'     => $raw,
            'meta'    => $meta,
        ]);
    }

    // --------------------------------------------------------------------
    // POST /builder/blocks/{slug}/fields — write block.fields.json.
    // --------------------------------------------------------------------

    public static function write_fields(WP_REST_Request $request) {
        $slug = (string) $request->get_param('slug');
        $dir  = self::resolve_block_dir($slug);
        if (!$dir) {
            return new WP_Error('gcblite_not_found', "Block `{$slug}` not found in the active theme.", ['status' => 404]);
        }

        $body = $request->get_json_params();
        if (!is_array($body) || !isset($body['content']) || !is_array($body['content'])) {
            return new WP_Error(
                'gcblite_bad_request',
                'Body must be `{ content: { controls: [...] } }`.',
                ['status' => 400]
            );
        }
        $content = $body['content'];

        // Validate before writing. The fields-config validator wants the
        // block_name folded in so error paths can reference the block.
        $validation = BlockGcbValidator::validate(array_merge(
            ['block_name' => $slug],
            $content
        ));
        if (!$validation['ok']) {
            return new WP_Error(
                'gcblite_invalid_fields',
                'block.fields.json failed validation.',
                ['status' => 422, 'errors' => $validation['errors']]
            );
        }

        $path = $dir . '/block.fields.json';
        $json = wp_json_encode($content, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            return new WP_Error('gcblite_encode_failed', 'wp_json_encode failed.', ['status' => 500]);
        }

        $written = file_put_contents($path, $json . "\n");
        if ($written === false) {
            return new WP_Error(
                'gcblite_write_failed',
                "Couldn't write to {$path}. Check filesystem permissions.",
                ['status' => 500]
            );
        }

        // Optionally update block.json metadata in the same round-trip.
        // Keeps the UI single-Save and avoids partial-save states.
        $meta_written = null;
        if (isset($body['meta']) && is_array($body['meta'])) {
            $meta_written = self::merge_block_meta($dir, $body['meta']);
            if (is_wp_error($meta_written)) return $meta_written;
        }

        return new WP_REST_Response([
            'slug'         => $slug,
            'path'         => $path,
            'bytes'        => $written,
            'meta_written' => $meta_written,
        ]);
    }

    /**
     * Read block.json from a block dir. Returns [] on missing/invalid so
     * callers don't have to null-check.
     */
    private static function read_block_json($dir) {
        $path = $dir . '/block.json';
        if (!file_exists($path)) return [];
        $parsed = json_decode((string) file_get_contents($path), true);
        return is_array($parsed) ? $parsed : [];
    }

    /**
     * Project block.json into the meta-shape the React editor uses.
     * Title / category / icon / render-mode are the only keys the UI
     * exposes; everything else stays untouched on write.
     */
    private static function extract_meta($block_json) {
        return [
            'title'       => $block_json['title']       ?? '',
            'category'    => $block_json['category']    ?? 'widgets',
            'icon'        => $block_json['icon']        ?? null,
            'description' => $block_json['description'] ?? '',
            // render_mode is derived: a render.php file in the block dir →
            // 'php', otherwise 'react'. Surface the file presence too so
            // the UI can confirm before flipping modes.
        ];
    }

    /**
     * Merge UI-editable fields into block.json without disturbing keys
     * we don't manage (apiVersion, supports, attributes-defaults, etc.).
     */
    private static function merge_block_meta($dir, array $meta) {
        $path = $dir . '/block.json';
        $current = self::read_block_json($dir);
        if (empty($current)) {
            return new WP_Error('gcblite_no_block_json', "block.json missing in {$dir}", ['status' => 500]);
        }
        foreach (['title', 'category', 'description'] as $k) {
            if (array_key_exists($k, $meta)) $current[$k] = (string) $meta[$k];
        }
        if (array_key_exists('icon', $meta)) {
            $current['icon'] = $meta['icon']; // can be string slug or {source,name} object
        }
        $json = wp_json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($json === false) return new WP_Error('gcblite_encode_failed', 'wp_json_encode failed.', ['status' => 500]);
        $written = file_put_contents($path, $json . "\n");
        if ($written === false) {
            return new WP_Error('gcblite_write_failed', "Couldn't write to {$path}.", ['status' => 500]);
        }
        return ['bytes' => $written, 'path' => $path];
    }

    // --------------------------------------------------------------------
    // GET /builder/control-docs/{type} — for the right-pane help panel.
    // --------------------------------------------------------------------

    public static function control_docs(WP_REST_Request $request) {
        $type = (string) $request->get_param('type');
        $docs = ControlDocs::get($type);
        if (!$docs) {
            return new WP_Error(
                'gcblite_no_docs',
                "No docs found for control type `{$type}`.",
                ['status' => 404]
            );
        }
        return new WP_REST_Response($docs);
    }

    // --------------------------------------------------------------------
    // Helpers
    // --------------------------------------------------------------------

    /**
     * Resolve a block slug to an absolute directory in the active theme.
     * Returns null when the dir doesn't exist or doesn't contain a
     * block.json. Deliberately scoped to the THEME — we don't let the
     * builder modify plugin-bundled examples (they're shipped read-only
     * with the plugin and would be clobbered by the next update).
     */
    private static function resolve_block_dir($slug) {
        $dir = trailingslashit(get_stylesheet_directory()) . 'blocks/' . $slug;
        if (!is_dir($dir) || !file_exists($dir . '/block.json')) {
            return null;
        }
        return $dir;
    }

    // --------------------------------------------------------------------
    // Structured fields — post / taxonomy / user / options.
    // --------------------------------------------------------------------

    /**
     * Enumerate every structured-field JSON file in the active theme.
     * Returns one array per kind so the UI can group them in tabs.
     */
    public static function list_structured_fields(WP_REST_Request $request) {
        $theme = trailingslashit(get_stylesheet_directory());

        // PHP-side registries (filled at init by gcblite_register_*_fields).
        // We merge these alongside disk-discovered JSON files so the
        // Schema Builder list shows the full picture — file-based schemas
        // are editable, PHP-registered ones are surfaced as read-only with
        // a `source: 'php'` marker so the UI can label/disable them.
        $php_post     = method_exists(\GCBLite\PostFields\Registrar::class, 'get_registered')
            ? \GCBLite\PostFields\Registrar::get_registered() : [];
        $php_taxonomy = method_exists(\GCBLite\Taxonomy\Registrar::class, 'get_registered')
            ? \GCBLite\Taxonomy\Registrar::get_registered() : [];
        $php_options  = method_exists(\GCBLite\Options\Registrar::class, 'get_registered')
            ? \GCBLite\Options\Registrar::get_registered() : [];
        $php_user     = method_exists(\GCBLite\User\Registrar::class, 'get_config')
            ? \GCBLite\User\Registrar::get_config() : null;

        $user_file = $theme . 'user-fields.fields.json';

        return new WP_REST_Response([
            'post'     => self::list_kind($theme . 'post-fields', $php_post),
            'taxonomy' => self::list_kind($theme . 'taxonomy-fields', $php_taxonomy),
            'options'  => self::list_kind($theme . 'options-fields', $php_options),
            'user'     => [
                'exists' => file_exists($user_file) || !empty($php_user),
                'path'   => $user_file,
                'source' => file_exists($user_file)
                    ? 'file'
                    : (!empty($php_user) ? 'php' : 'none'),
            ],
            'writes_enabled' => self::permission_write() === true,
            'theme_dir'      => $theme,
        ]);
    }

    /**
     * Merge file-based + PHP-registered schemas for one kind into a
     * single sorted list, each row tagged with its source so the UI can
     * disable/decorate PHP-only entries (they can't be edited).
     */
    private static function list_kind($dir, array $php_registry) {
        $items = [];
        $seen  = [];

        if (is_dir($dir)) {
            foreach (glob($dir . '/*.fields.json') ?: [] as $file) {
                $id = basename($file, '.fields.json');
                $items[] = [
                    'id'     => $id,
                    'path'   => $file,
                    'source' => 'file',
                ];
                $seen[$id] = true;
            }
        }

        foreach (array_keys($php_registry) as $id) {
            if (isset($seen[$id])) continue;
            $items[] = [
                'id'     => $id,
                'path'   => '(PHP-registered)',
                'source' => 'php',
            ];
        }

        usort($items, fn($a, $b) => strcmp($a['id'], $b['id']));
        return $items;
    }

    public static function read_structured_fields(WP_REST_Request $request) {
        $resolved = self::resolve_structured_path($request);
        if (is_wp_error($resolved)) return $resolved;
        [$kind, $id, $path] = $resolved;

        if (!file_exists($path)) {
            return new WP_REST_Response([
                'kind'    => $kind,
                'id'      => $id,
                'path'    => $path,
                'exists'  => false,
                'content' => null,
            ]);
        }

        $raw    = (string) file_get_contents($path);
        $parsed = json_decode($raw, true);

        return new WP_REST_Response([
            'kind'    => $kind,
            'id'      => $id,
            'path'    => $path,
            'exists'  => true,
            'content' => is_array($parsed) ? $parsed : null,
            'raw'     => $raw,
        ]);
    }

    public static function write_structured_fields(WP_REST_Request $request) {
        $resolved = self::resolve_structured_path($request);
        if (is_wp_error($resolved)) return $resolved;
        [$kind, $id, $path] = $resolved;

        $body = $request->get_json_params();
        if (!is_array($body) || !isset($body['content']) || !is_array($body['content'])) {
            return new WP_Error(
                'gcblite_bad_request',
                'Body must be `{ content: { controls: [...] } }`.',
                ['status' => 400]
            );
        }
        $content = $body['content'];

        // Structured-field schemas share the block-fields validator:
        // identical `controls` shape, identical per-control config keys.
        // Synthesise a block_name so error messages have a meaningful
        // breadcrumb ("structured-fields/post/project").
        $synthetic_name = "structured-fields/{$kind}/" . ($id ?: 'user');
        $validation = BlockGcbValidator::validate(array_merge(
            ['block_name' => $synthetic_name],
            $content
        ));
        if (!$validation['ok']) {
            return new WP_Error(
                'gcblite_invalid_fields',
                'Structured-field schema failed validation.',
                ['status' => 422, 'errors' => $validation['errors']]
            );
        }

        // Make sure the parent dir exists. For per-kind dirs this means
        // creating `post-fields/` etc. on first save.
        $parent = dirname($path);
        if (!is_dir($parent)) {
            if (!wp_mkdir_p($parent)) {
                return new WP_Error(
                    'gcblite_mkdir_failed',
                    "Couldn't create directory {$parent}.",
                    ['status' => 500]
                );
            }
        }

        $json = wp_json_encode($content, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            return new WP_Error('gcblite_encode_failed', 'wp_json_encode failed.', ['status' => 500]);
        }

        $written = file_put_contents($path, $json . "\n");
        if ($written === false) {
            return new WP_Error(
                'gcblite_write_failed',
                "Couldn't write to {$path}. Check filesystem permissions.",
                ['status' => 500]
            );
        }

        return new WP_REST_Response([
            'kind'  => $kind,
            'id'    => $id,
            'path'  => $path,
            'bytes' => $written,
        ]);
    }

    /**
     * Map a (kind, id) pair to its on-disk path. `user` is the special
     * case — a single file at the theme root, not per-id.
     *
     * Returns either [kind, id, abs-path] or WP_Error.
     */
    private static function resolve_structured_path(WP_REST_Request $request) {
        $kind  = (string) $request->get_param('kind');
        $id    = (string) ($request->get_param('id') ?? '');
        $theme = trailingslashit(get_stylesheet_directory());

        if ($kind === 'user') {
            // user-fields are global. Ignore id even if one was passed.
            return ['user', '', $theme . 'user-fields.fields.json'];
        }

        if ($id === '') {
            return new WP_Error(
                'gcblite_bad_request',
                "Structured-field kind `{$kind}` requires an id (post-type / taxonomy / options-page slug).",
                ['status' => 400]
            );
        }

        $dir_map = [
            'post'     => 'post-fields',
            'taxonomy' => 'taxonomy-fields',
            'options'  => 'options-fields',
        ];
        if (!isset($dir_map[$kind])) {
            return new WP_Error(
                'gcblite_bad_request',
                "Unknown structured-field kind `{$kind}`.",
                ['status' => 400]
            );
        }

        return [$kind, $id, $theme . $dir_map[$kind] . '/' . $id . '.fields.json'];
    }
}
