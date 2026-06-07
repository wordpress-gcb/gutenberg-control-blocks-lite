<?php
/**
 * Registers gcb-lite operations as WordPress 7.0 Abilities.
 *
 * Abilities are typed, schema-validated actions that surface to:
 *   - The WP command palette (built-in editor UX).
 *   - MCP clients (e.g. Claude desktop) via the WordPress MCP adapter
 *     plugin — they discover registered abilities and can invoke them as
 *     LLM tools.
 *
 * We expose:
 *
 *   gcblite/list-blocks      → return every registered gcb/* block with its
 *                              attribute schema + defaults. Lets an AI agent
 *                              introspect what's available on the site.
 *
 *   gcblite/render-block     → render a block to HTML server-side. Same code
 *                              path as the REST /render endpoint. Lets an AI
 *                              agent (or a custom command) preview a block.
 *
 *   gcblite/get-control-docs → structured docs for a control type (or the
 *                              full list). Same source as the docs site.
 *
 *   gcblite/create-block     → create a new gcb/* block FROM TYPED FIELDS via
 *                              BlockScaffolder. This is the product-level guard
 *                              against AI agents hand-rolling blocks: the input
 *                              schema accepts only a list of typed fields — there
 *                              is no parameter for raw block.json or markup — so
 *                              any external AI that creates a block through GCB is
 *                              structurally forced down the typed-field pipeline
 *                              (block.fields.json), never a bare hand-written block.
 *
 * Both gated behind a WP version check: the Abilities API is WP 7.0+, so
 * on earlier WordPress versions this class is a no-op and the plugin
 * continues to work without it.
 *
 * REST contract (WP core's run controller):
 *
 *   POST /wp-json/wp-abilities/v1/abilities/{name}/run
 *   GET  /wp-json/wp-abilities/v1/abilities/{name}/run    (readonly abilities)
 *
 *   Body / query: { "input": <whatever-the-ability-schema-says> }
 *
 * Note the `input` key — the run controller wraps the ability's input in
 * an outer object. So an MCP client calling our render-block ability sends
 *
 *   { "input": { "blockName": "gcb/text-image", "attributes": {...} } }
 *
 * not the bare arguments at the top level. See
 * wp-includes/rest-api/endpoints/class-wp-rest-abilities-v1-run-controller.php
 * for the upstream contract.
 *
 * @package GCBLite\Abilities
 */

namespace GCBLite\Abilities;

use GCBLite\Docs\ControlDocs;
use GCBLite\RestAPI\BlocksAPI;
use GCBLite\RestAPI\RenderAPI;

if (!defined('ABSPATH')) {
    exit;
}

class AbilitiesRegistry {

    const CATEGORY_SLUG = 'gcblite';

    public static function init() {
        // The Abilities API only exists in WP 7.0+. Below that, do nothing —
        // the rest of the plugin still works the same.
        if (!function_exists('wp_register_ability')) {
            return;
        }

        add_action('wp_abilities_api_categories_init', [__CLASS__, 'register_category']);
        add_action('wp_abilities_api_init', [__CLASS__, 'register_abilities']);
    }

    public static function register_category() {
        wp_register_ability_category(self::CATEGORY_SLUG, [
            'label'       => __('GCB Lite', 'gcblite'),
            'description' => __('Introspect and render gcb-lite blocks.', 'gcblite'),
        ]);
    }

    public static function register_abilities() {
        wp_register_ability('gcblite/list-blocks', [
            'label'               => __('List GCB Lite blocks', 'gcblite'),
            'description'         => __(
                'Returns every registered gcb/* block on the site, with each block\'s attribute schema and default values. Useful for discovering what blocks are available before composing or rendering one.',
                'gcblite'
            ),
            'category'            => self::CATEGORY_SLUG,
            'input_schema'        => [
                // No required inputs — but the WP 7 ability validator
                // rejects a literal `null` if we declare `type: object`.
                // Allow both, so callers can pass `null`, `{}`, or omit.
                'type'                 => ['object', 'null'],
                'properties'           => new \stdClass(),
                'additionalProperties' => false,
            ],
            'output_schema'       => [
                'type'       => 'object',
                'properties' => [
                    'blocks' => [
                        'type'        => 'object',
                        'description' => 'Map of block name → { attributes: { key: { type, default } } }.',
                    ],
                ],
                'required'   => ['blocks'],
            ],
            'execute_callback'    => function () {
                return ['blocks' => BlocksAPI::get_blocks_data()];
            },
            // Read-only listing; no capability gate needed. The data is the
            // same schema the editor already exposes to logged-in authors,
            // and the registered block list is not sensitive.
            'permission_callback' => '__return_true',
            'meta'                => [
                'annotations'  => [
                    'readonly' => true,
                ],
                // show_in_rest lives under meta in WP 7. Opt in so MCP
                // adapters and other tools can discover the ability via
                // /wp-abilities/v1/abilities.
                'show_in_rest' => true,
            ],
        ]);

        wp_register_ability('gcblite/render-block', [
            'label'               => __('Render a GCB Lite block', 'gcblite'),
            'description'         => __(
                'Renders a single gcb/* block to HTML server-side using the same path as the editor preview. Either runs the block\'s render.php (if the theme defines one) or fetches the component-server\'s React output. Returns the rendered HTML plus any wrapper attributes the renderer asked for.',
                'gcblite'
            ),
            'category'            => self::CATEGORY_SLUG,
            'input_schema'        => [
                'type'       => 'object',
                'properties' => [
                    'blockName'   => [
                        'type'        => 'string',
                        'description' => 'Full block name, e.g. "gcb/text-image".',
                    ],
                    'attributes'  => [
                        'type'        => 'object',
                        'description' => 'Attribute values. Use gcblite/list-blocks to discover the available keys + defaults.',
                    ],
                    'innerBlocks' => [
                        'type'        => 'array',
                        'description' => 'Nested blocks in parser shape ({ blockName, attrs, innerBlocks }). Only required for blocks that have inner content.',
                    ],
                ],
                'required'   => ['blockName'],
            ],
            'output_schema'       => [
                'type'       => 'object',
                'properties' => [
                    'html'              => [ 'type' => 'string' ],
                    'wrapperAttributes' => [ 'type' => 'object' ],
                    'blockName'         => [ 'type' => 'string' ],
                ],
                'required'   => ['html', 'blockName'],
            ],
            'execute_callback'    => function ($input) {
                $name   = isset($input['blockName']) ? (string) $input['blockName'] : '';
                $attrs  = isset($input['attributes']) && is_array($input['attributes']) ? $input['attributes'] : [];
                $inners = isset($input['innerBlocks']) && is_array($input['innerBlocks']) ? $input['innerBlocks'] : [];

                $result = RenderAPI::render_block($name, $attrs, $inners);
                if (is_wp_error($result)) {
                    return $result;
                }
                return $result;
            },
            // Render performs an outbound HTTP call to the component server
            // and writes a transient cache. Require edit_posts so anonymous
            // abusers can't turn this into a free HTTP proxy.
            'permission_callback' => function () {
                return current_user_can('edit_posts');
            },
            'meta'                => [
                // No `readonly` annotation here on purpose: WP 7's REST
                // adapter forces readonly abilities to GET-only, but our
                // input has nested `attributes` and `innerBlocks` objects
                // that don't survive query-string flattening. POST-only is
                // both correct (this has side effects: HTTP fetch + cache)
                // and friendlier to the input shape MCP clients use.
                'show_in_rest' => true,
            ],
        ]);

        wp_register_ability('gcblite/create-block', [
            'label'               => __('Create a GCB block (typed fields)', 'gcblite'),
            'description'         => __(
                // This wording matters: it's the description an external AI agent
                // reads when deciding how to make a block. It steers them HERE
                // instead of hand-writing files.
                'Create a new gcb/* block the GCB way — from a list of typed fields. '
                . 'This is THE correct way for an AI agent to add a block to a GCB site: '
                . 'do NOT hand-write block.json or hardcode markup in a render template. '
                . 'You provide a block name, a title, and the fields the block should expose '
                . '(each with a key, a control type, and a label); GCB generates a validated '
                . 'block.json, a block.fields.json (the typed-field schema), a render.php that '
                . 'reads those fields, and a style.css via GCBLite\\Scaffold\\BlockScaffolder. '
                . 'Use gcblite/get-control-docs to discover the available control types first. '
                . 'For interactive front-end behaviour (search/filter/sort/tabs), use the Pro '
                . 'AI builder\'s view.js generation — this ability scaffolds the structure.',
                'gcblite'
            ),
            'category'            => self::CATEGORY_SLUG,
            // NOTE: there is intentionally NO `blockJson`, `markup`, `renderPhp`,
            // or `html` input here. The only way to describe a block through this
            // ability is as TYPED FIELDS. That is the whole point — an external AI
            // cannot use this ability to hand-roll a bare block; it can only ever
            // produce a real GCB typed-field block.
            'input_schema'        => [
                'type'                 => 'object',
                'properties'           => [
                    'name'        => [
                        'type'        => 'string',
                        'pattern'     => '^[a-z][a-z0-9-]*$',
                        'description' => 'Block slug (no "gcb/" prefix): lowercase letters, digits, hyphens, starting with a letter. E.g. "team-card".',
                    ],
                    'title'       => [
                        'type'        => 'string',
                        'description' => 'Human-readable block title shown in the editor inserter. E.g. "Team Card".',
                    ],
                    'description' => [
                        'type'        => 'string',
                        'description' => 'Optional one-line description of the block.',
                    ],
                    'icon'        => [
                        'type'        => 'string',
                        'description' => 'Optional dashicon or core block icon. Defaults to "core/layout".',
                    ],
                    'category'    => [
                        'type'        => 'string',
                        'description' => 'Optional editor category (e.g. "widgets", "media", "design"). Defaults to "widgets".',
                    ],
                    'fields'      => [
                        'type'        => 'array',
                        'description' => 'The typed fields this block exposes. THIS is how block content is modelled in GCB — not as hardcoded markup. Each field becomes an editor control + an attribute the render template reads.',
                        'items'       => [
                            'type'       => 'object',
                            'properties' => [
                                'key'   => [
                                    'type'        => 'string',
                                    'description' => 'Attribute key (lowercase, e.g. "heading", "image", "items").',
                                ],
                                'type'  => [
                                    'type'        => 'string',
                                    'description' => 'Control type. Call gcblite/get-control-docs (no args) for the full list — e.g. text, textarea, richtext, image, color, url, toggle, select, repeater.',
                                ],
                                'label' => [
                                    'type'        => 'string',
                                    'description' => 'Editor label for the control. Defaults to a humanised key.',
                                ],
                            ],
                            'required'   => ['key', 'type'],
                        ],
                    ],
                    'force'       => [
                        'type'        => 'boolean',
                        'description' => 'Overwrite an existing block directory of the same name. Defaults to false.',
                    ],
                    'dryRun'      => [
                        'type'        => 'boolean',
                        'description' => 'If true, validate + return the files that WOULD be written without touching disk.',
                    ],
                ],
                'required'   => ['name', 'fields'],
            ],
            'output_schema'       => [
                'type'       => 'object',
                'properties' => [
                    'ok'        => ['type' => 'boolean'],
                    'blockName' => ['type' => 'string'],
                    'blockDir'  => ['type' => 'string'],
                    'files'     => ['type' => 'array', 'items' => ['type' => 'string']],
                    'errors'    => ['type' => 'array'],
                ],
                'required'   => ['ok', 'blockName'],
            ],
            'execute_callback'    => function ($input) {
                $name = isset($input['name']) ? (string) $input['name'] : '';

                // Map each typed field into a scaffolder control. We deliberately
                // accept ONLY the typed-field description and translate it — there's
                // no path here for raw block.json / markup.
                $controls = [];
                $fields   = (isset($input['fields']) && is_array($input['fields'])) ? $input['fields'] : [];
                foreach ($fields as $field) {
                    if (!is_array($field) || empty($field['key'])) {
                        continue;
                    }
                    $key  = (string) $field['key'];
                    $type = isset($field['type']) ? (string) $field['type'] : 'text';
                    // BlockGcbValidator requires each non-structural control to
                    // carry id + type + label + attributeKey. Derive them from the
                    // single typed-field description the agent gave us.
                    $controls[] = [
                        'id'           => $key,
                        'type'         => $type,
                        'label'        => isset($field['label']) && $field['label'] !== ''
                            ? (string) $field['label']
                            : \GCBLite\Scaffold\BlockScaffolder::humanise($key),
                        'attributeKey' => $key,
                    ];
                }

                if ($controls === []) {
                    return new \WP_Error(
                        'gcblite_create_block_no_fields',
                        'A GCB block needs at least one typed field. Describe the block as fields (key + control type), not as markup. Use gcblite/get-control-docs to see the available control types.',
                        ['status' => 400]
                    );
                }

                $meta = [];
                if (!empty($input['title']))       { $meta['title']       = (string) $input['title']; }
                if (!empty($input['description']))  { $meta['description'] = (string) $input['description']; }
                if (!empty($input['icon']))         { $meta['icon']        = (string) $input['icon']; }
                if (!empty($input['category']))     { $meta['category']    = (string) $input['category']; }

                $spec = [
                    'block_name' => $name,
                    'meta'       => $meta,
                    'gcb'        => ['controls' => $controls],
                ];

                $result = \GCBLite\Scaffold\BlockScaffolder::create($spec, [
                    'force'   => !empty($input['force']),
                    'dry_run' => !empty($input['dryRun']),
                ]);

                if (empty($result['ok'])) {
                    return new \WP_Error(
                        'gcblite_create_block_failed',
                        'Block could not be created — see errors.',
                        ['status' => 422, 'errors' => $result['errors'] ?? []]
                    );
                }

                return [
                    'ok'        => true,
                    'blockName' => $result['block_name'],
                    'blockDir'  => $result['block_dir'],
                    'files'     => $result['files'],
                    'errors'    => $result['errors'] ?? [],
                ];
            },
            // Writes files into the active theme. Gate behind the same capability
            // WordPress requires to edit theme files, so an anonymous caller can't
            // scaffold blocks onto the site.
            'permission_callback' => function () {
                return current_user_can('edit_themes') || current_user_can('edit_theme_options');
            },
            'meta'                => [
                // Has side effects (writes files) — not readonly, POST-only.
                'show_in_rest' => true,
            ],
        ]);

        wp_register_ability('gcblite/get-control-docs', [
            'label'               => __('Get control type docs', 'gcblite'),
            'description'         => __(
                'Returns the structured documentation for a single gcb-lite control type — description, stored shape, supports list, config options, gotchas, and an example snippet. Same canonical source as the docs site (gcb-lite/schemas/controls/{type}.md). When called without a `type`, returns the full list of available control types.',
                'gcblite'
            ),
            'category'            => self::CATEGORY_SLUG,
            'input_schema'        => [
                'type'                 => ['object', 'null'],
                'properties'           => [
                    'type' => [
                        'type'        => 'string',
                        'description' => 'Control type slug, e.g. "color" or "image". Omit to list every control type that has docs.',
                    ],
                ],
                'additionalProperties' => false,
            ],
            'output_schema'       => [
                'type'       => 'object',
                'properties' => [
                    'types' => [
                        'type'        => 'array',
                        'items'       => ['type' => 'string'],
                        'description' => 'Set when called without a `type` — lists every documented control.',
                    ],
                    'docs' => [
                        'type'        => 'object',
                        'description' => 'Set when called with a `type` — the parsed frontmatter for that control.',
                    ],
                ],
            ],
            'execute_callback'    => function ($input) {
                $type = isset($input['type']) ? (string) $input['type'] : '';
                if ($type === '') {
                    return ['types' => ControlDocs::list_types()];
                }
                $docs = ControlDocs::get($type);
                if (!$docs) {
                    return new \WP_Error(
                        'gcblite_control_docs_not_found',
                        sprintf('No docs found for control type "%s".', $type),
                        ['status' => 404]
                    );
                }
                return ['docs' => $docs];
            },
            // Read-only data. Same exposure level as the docs site —
            // the markdown is already published, no permission gate
            // makes sense here.
            'permission_callback' => '__return_true',
            'meta'                => [
                'annotations'  => [ 'readonly' => true ],
                'show_in_rest' => true,
            ],
        ]);
    }
}
