<?php
/**
 * REST endpoint that renders a block's render.php with given attributes,
 * and returns the resulting HTML for the editor preview to parse.
 *
 * Endpoint: POST /gcblite/v1/preview
 *   body: { blockName: 'gcblite/cards', attributes: {...} }
 *   response: { html: '<div...>...</div>' }
 *
 * @package GCBLite\RestAPI
 */

namespace GCBLite\RestAPI;

if (!defined('ABSPATH')) {
    exit;
}

class PreviewAPI {

    public static function init() {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function register_routes() {
        register_rest_route('gcblite/v1', '/preview', [
            'methods'             => 'POST',
            'callback'            => [__CLASS__, 'render_preview'],
            'permission_callback' => function () {
                return current_user_can('edit_posts');
            },
            'args' => [
                'blockName' => [
                    'required' => true,
                    'type'     => 'string',
                ],
                'attributes' => [
                    'required' => false,
                    'type'     => 'object',
                    'default'  => [],
                ],
            ],
        ]);
    }

    public static function render_preview($request) {
        $block_name = $request->get_param('blockName');
        $attributes = $request->get_param('attributes') ?: [];

        if (!is_string($block_name) || strpos($block_name, 'gcb/') !== 0) {
            return new \WP_Error('invalid_block', 'blockName must be a gcb/ block.', ['status' => 400]);
        }

        $registry = \WP_Block_Type_Registry::get_instance();
        $block_type = $registry->get_registered($block_name);
        if (!$block_type) {
            return new \WP_Error('block_not_found', "Block {$block_name} is not registered.", ['status' => 404]);
        }
        if (!is_callable($block_type->render_callback)) {
            return new \WP_Error('no_render_callback', "Block {$block_name} has no render callback.", ['status' => 400]);
        }

        // Sanitise attributes against the block's declared attribute defaults.
        // WordPress' prepare_attributes_for_render does the type coercion.
        $prepared_attributes = $block_type->prepare_attributes_for_render(
            is_array($attributes) ? $attributes : []
        );

        // Build a synthetic WP_Block instance so the render callback gets the
        // same shape it gets in a real render. innerBlocks/innerHTML left empty —
        // the editor's <Repeater>/<InnerBlocks> tags don't depend on saved content.
        $parsed = [
            'blockName'    => $block_name,
            'attrs'        => $prepared_attributes,
            'innerBlocks'  => [],
            'innerHTML'    => '',
            'innerContent' => [],
        ];
        $block = new \WP_Block($parsed);

        // Set up the static so get_block_wrapper_attributes() works inside render.php.
        $previous = \WP_Block_Supports::$block_to_render ?? null;
        \WP_Block_Supports::$block_to_render = $parsed;

        try {
            $html = (string) call_user_func($block_type->render_callback, $prepared_attributes, '', $block);
        } catch (\Throwable $e) {
            \WP_Block_Supports::$block_to_render = $previous;
            return new \WP_Error('render_failed', $e->getMessage(), [
                'status' => 500,
                'file'   => $e->getFile(),
                'line'   => $e->getLine(),
            ]);
        }

        \WP_Block_Supports::$block_to_render = $previous;

        return rest_ensure_response([
            'html'      => $html,
            'blockName' => $block_name,
        ]);
    }
}
