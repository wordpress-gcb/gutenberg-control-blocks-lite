<?php
/**
 * THE CONTROL-TYPE REGISTRY — one place a field type is declared, so a theme,
 * gcb-pro or a project can add its own without editing core (TODO.md,
 * "Extension points" 1; 2026-10-07: adding `pin-map` meant three edits in core —
 * the editor bundle, BlockLoader's object list and the validator).
 *
 *   add_action('gcblite_register_control_types', function () {   // init/4 — always in time
 *     gcblite_register_control_type('timeline', [
 *       'shape'  => 'array',                                  // the stored attribute type
 *       'doc'    => __DIR__ . '/fields/timeline.md',          // schemas/controls frontmatter format
 *       'script' => 'my-timeline-control',                    // editor JS that calls gcbLiteControls.register()
 *     ]);
 *   });
 *
 * What registering buys:
 *   - the attribute is typed as `shape` (BlockLoader::attributes_for), not the
 *     SDK's fallback `string` — the editor drops a string attribute holding an
 *     object when it parses the block;
 *   - the validator knows the name (BlockGcbValidator::known_types);
 *   - with a `doc`, the type joins the control vocabulary (ControlDocs, and so
 *     Contract\Fields::control_types()) — which is what gcb-pro hands its AI, so
 *     a registered type is offered with no edit on pro's side;
 *   - with a `script`, that handle loads wherever GCB's field editors do (the
 *     block editor, the post-fields meta box, the sidebar panel), after the
 *     `gcblite-control-hub` script it registers into.
 *
 * Lite's own object-valued fields register here too (LITE_TYPES), replacing the
 * hard-coded list BlockLoader used to keep. Built-in field types (text, image,
 * gallery, … — BlockGcbValidator::builtin_types()) cannot be registered over:
 * that would silently change what an existing field stores.
 *
 * @package GCBLite\Fields
 */

namespace GCBLite\Fields;

if (!defined('ABSPATH')) {
    exit;
}

final class ControlTypes {

    /** The editor script every field-registering script depends on (build/control-hub.js). */
    public const HUB_HANDLE = 'gcblite-control-hub';

    /** The stored shapes a field may declare — WordPress's attribute types. */
    public const SHAPES = ['string', 'number', 'integer', 'boolean', 'object', 'array'];

    /**
     * Lite's own field types the SDK does not type. Their docs are in
     * schemas/controls/ already (ControlDocs reads that folder), so no `doc`.
     */
    private const LITE_TYPES = [
        'point'      => 'object',
        'hotspots'   => 'object',
        'pin-map'    => 'object',
        'background' => 'object',
        'layout'     => 'object',
    ];

    /** @var array<string, array{shape: string, doc: string, script: string}> */
    private static $registered = [];

    /** True once blocks have been typed (BlockLoader registers them on `init` at 5). */
    private static $locked = false;

    public static function init() {
        // Early, so a plugin or theme registering its control script on `init`
        // can already name the hub as a dependency.
        add_action('init', [__CLASS__, 'register_hub_script'], 1);
        // THE PLACE TO REGISTER (2026-10-07, found registering one from a plugin on
        // plain `init`): BlockLoader types every block's attributes at init/5, so a
        // field type registered later is typed as a string — silently. Registering on
        // this action is always in time.
        add_action('init', [__CLASS__, 'fire_register_action'], 4);
        // Added before BlockLoader's init/5 (gcblite_services() order), so it runs first.
        add_action('init', [__CLASS__, 'lock'], 5);
    }

    /**
     * Fires on `init` at priority 4, just before blocks are registered and
     * typed — register field types here:
     *
     *   add_action('gcblite_register_control_types', function () {
     *       gcblite_register_control_type('timeline', [...]);
     *   });
     */
    public static function fire_register_action() {
        do_action('gcblite_register_control_types');
    }

    public static function lock() {
        self::$locked = true;
    }

    /**
     * Declare a field type. Returns false (and registers nothing) for a bad
     * name or shape, or a name GCB already ships.
     *
     * @param string $type 'my-field' — lowercase letters, digits and dashes.
     * @param array  $args shape (required), doc (absolute .md path), script (a registered handle).
     */
    public static function register($type, array $args) {
        $entry = self::normalise($type, $args);
        if ($entry === null || isset(self::LITE_TYPES[$type]) || self::is_builtin($type)) {
            return false;
        }
        if (self::$locked && function_exists('_doing_it_wrong')) {
            _doing_it_wrong(
                'gcblite_register_control_type',
                sprintf('Field type "%s" was registered after GCB typed its blocks, so blocks using it store a string until the next request registers it in time. Register field types on the gcblite_register_control_types action.', esc_html($type)),
                'gcb-lite 0.5'
            );
        }
        self::$registered[$type] = $entry;
        return true;
    }

    /**
     * Every registered type: Lite's own, then the theme's / plugins' (through
     * register() and the `gcblite_control_types` filter).
     *
     * @return array<string, array{shape: string, doc: string, script: string}>
     */
    public static function all() {
        $types = [];
        foreach (self::LITE_TYPES as $type => $shape) {
            $types[$type] = ['shape' => $shape, 'doc' => '', 'script' => ''];
        }

        /**
         * Add field types without calling gcblite_register_control_type().
         * Same entry shape: type => ['shape' => …, 'doc' => …, 'script' => …].
         * Entries for built-in types are ignored.
         *
         * @param array $registered The types registered so far.
         */
        $extra = apply_filters('gcblite_control_types', self::$registered);
        if (!is_array($extra)) {
            $extra = self::$registered;
        }
        foreach ($extra as $type => $args) {
            if (isset($types[$type]) || self::is_builtin($type) || !is_array($args)) {
                continue;
            }
            $entry = self::normalise($type, $args);
            if ($entry !== null) {
                $types[$type] = $entry;
            }
        }
        return $types;
    }

    /** The stored shape of a registered type, or null when it isn't one. */
    public static function shape($type) {
        $all = self::all();
        return isset($all[$type]) ? $all[$type]['shape'] : null;
    }

    /** The doc file of a registered type, or '' (Lite's own docs live in schemas/controls/). */
    public static function doc_path($type) {
        $all = self::all();
        return isset($all[$type]) ? $all[$type]['doc'] : '';
    }

    /** Registered types that bring their own doc file — they join the vocabulary. */
    public static function documented() {
        $out = [];
        foreach (self::all() as $type => $entry) {
            if ($entry['doc'] !== '') {
                $out[$type] = $entry['doc'];
            }
        }
        return $out;
    }

    /** Script handles of registered types, for GCB's field-editor bundles to depend on. */
    public static function scripts() {
        $handles = [];
        foreach (self::all() as $entry) {
            if ($entry['script'] !== '') {
                $handles[] = $entry['script'];
            }
        }
        return array_values(array_unique($handles));
    }

    /**
     * The dependencies a GCB field-editor bundle adds to its own: the hub, then
     * every registered control script (each made to depend on the hub, so it
     * can register whichever bundle loads first).
     *
     * @param string[] $deps The bundle's own dependencies.
     * @return string[]
     */
    public static function bundle_deps(array $deps) {
        $scripts = function_exists('wp_scripts') ? wp_scripts() : null;
        foreach (self::scripts() as $handle) {
            if ($scripts && isset($scripts->registered[$handle]) && !in_array(self::HUB_HANDLE, $scripts->registered[$handle]->deps, true)) {
                $scripts->registered[$handle]->deps[] = self::HUB_HANDLE;
            }
        }
        return array_values(array_unique(array_merge($deps, [self::HUB_HANDLE], self::scripts())));
    }

    /** Add the hub and the registered control scripts to an already-registered bundle. */
    public static function attach_to($handle) {
        if (!function_exists('wp_scripts')) {
            return;
        }
        $scripts = wp_scripts();
        if (isset($scripts->registered[$handle])) {
            $scripts->registered[$handle]->deps = self::bundle_deps($scripts->registered[$handle]->deps);
        }
    }

    public static function register_hub_script() {
        $asset = GCBLITE_PLUGIN_DIR . 'build/control-hub.asset.php';
        $info  = file_exists($asset) ? include $asset : ['dependencies' => [], 'version' => GCBLITE_VERSION];
        wp_register_script(self::HUB_HANDLE, GCBLITE_PLUGIN_URL . 'build/control-hub.js', $info['dependencies'], $info['version'], false);
    }

    /** @internal for tests: forget everything registered. */
    public static function reset() {
        self::$registered = [];
        self::$locked = false;
    }

    /**
     * A name GCB already ships — a built-in field (the validator's list, which
     * ControlVocabularyDerivedTest keeps equal to the docs) or a structural
     * type. Not ours to redefine: it would silently change what an existing
     * field stores.
     */
    private static function is_builtin($type) {
        return in_array($type, \GCBLite\Validation\BlockGcbValidator::builtin_types(), true)
            || in_array($type, \GCBLite\Validation\BlockGcbValidator::STRUCTURAL_TYPES, true);
    }

    /** A valid registry entry from caller args, or null. */
    private static function normalise($type, $args) {
        if (!is_string($type) || !preg_match('/^[a-z][a-z0-9-]*$/', $type)) {
            return null;
        }
        $shape = is_array($args) ? ($args['shape'] ?? null) : null;
        if (!in_array($shape, self::SHAPES, true)) {
            return null;
        }
        $doc    = (string) ($args['doc'] ?? '');
        $script = (string) ($args['script'] ?? '');
        return [
            'shape'  => $shape,
            'doc'    => ($doc !== '' && is_readable($doc)) ? $doc : '',
            'script' => preg_match('/^[a-zA-Z0-9_.-]+$/', $script) ? $script : '',
        ];
    }
}
