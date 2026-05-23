<?php
/**
 * Expose registered gcb/* blocks' attribute definitions (type + default) so
 * a headless React frontend can apply the right defaults when no value was
 * saved.
 *
 * WordPress only persists attrs whose value differs from the default, so the
 * block-serialization parser yields a sparse attrs object. Without defaults
 * the React component falls back to its own destructuring defaults (or
 * undefined), which has to be kept in sync by hand. With this endpoint the
 * frontend can pull defaults straight from the registered block.
 *
 * Endpoint:
 *   GET /gcblite/v1/blocks
 *     → { blocks: { 'gcb/{slug}': { attributes: { key: { type, default } } } } }
 *
 * Public — block schemas aren't sensitive (they're already needed by the
 * editor JS via window.gcbLite.blocks).
 *
 * @package GCBLite\RestAPI
 */

namespace GCBLite\RestAPI;

if (!defined('ABSPATH')) {
    exit;
}

class BlocksAPI {

    public static function init() {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function register_routes() {
        register_rest_route('gcblite/v1', '/blocks', [
            'methods'             => 'GET',
            'callback'            => [__CLASS__, 'list_blocks'],
            'permission_callback' => '__return_true',
        ]);
    }

    public static function list_blocks() {
        return rest_ensure_response(['blocks' => self::get_blocks_data()]);
    }

    /**
     * Plain PHP version of list_blocks() for internal callers (e.g. the
     * Abilities API integration). Returns the same shape as the REST
     * endpoint's `blocks` field.
     *
     * @return array<string, array{ attributes: array }>
     */
    public static function get_blocks_data() {
        $registry = \WP_Block_Type_Registry::get_instance();
        $blocks   = [];

        foreach ($registry->get_all_registered() as $name => $type) {
            if (strpos($name, 'gcb/') !== 0) continue;

            $attributes = [];
            foreach ((array) $type->attributes as $key => $def) {
                $attributes[$key] = [
                    'type'    => $def['type'] ?? 'string',
                    'default' => array_key_exists('default', $def) ? $def['default'] : null,
                ];
            }

            $blocks[$name] = ['attributes' => $attributes];
        }

        return $blocks;
    }
}
