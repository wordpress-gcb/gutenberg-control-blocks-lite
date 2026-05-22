<?php
/**
 * Exposes a post's raw block markup (the source with block comments) as a
 * public REST field on pages and posts.
 *
 * The core WP API only returns `content.rendered` to unauthenticated callers
 * — useful for embedding, useless for a headless front-end that needs to
 * walk the block tree and map gcb/* blocks to React components.
 *
 * After bootstrap, the response from `/wp-json/wp/v2/pages?slug=foo` includes:
 *   { ..., content: { rendered, ... }, blocks_raw: "<!-- wp:gcb/hero {...} -->..." }
 *
 * This is by design public: block content is already published, and the raw
 * source contains only what `content.rendered` shows in a different shape.
 *
 * @package GCBLite\RestAPI
 */

namespace GCBLite\RestAPI;

if (!defined('ABSPATH')) {
    exit;
}

class RawBlocksField {

    const FIELD_NAME = 'blocks_raw';
    const POST_TYPES = ['post', 'page'];

    public static function init() {
        add_action('rest_api_init', [__CLASS__, 'register']);
    }

    public static function register() {
        foreach (self::POST_TYPES as $type) {
            register_rest_field($type, self::FIELD_NAME, [
                'get_callback' => [__CLASS__, 'get_value'],
                'schema' => [
                    'description' => __('Raw block markup (post_content as stored, with block comments).', 'gcblite'),
                    'type'        => 'string',
                    'context'     => ['view', 'edit'],
                    'readonly'    => true,
                ],
            ]);
        }
    }

    public static function get_value($post) {
        $id = is_array($post) ? ($post['id'] ?? 0) : 0;
        if (!$id) return '';

        $post_obj = get_post($id);
        return $post_obj ? (string) $post_obj->post_content : '';
    }
}
