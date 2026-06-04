<?php
/**
 * Server-side save guard for block validation.
 *
 * The editor (useRepeaterValidation) POSTs a post's validation state here on
 * every save attempt; we stash it in a short-lived transient. A
 * rest_pre_insert_{post,page} filter then reads that transient and rejects the
 * save with `gcblite_validation_error` when any block is invalid — so a
 * repeater under its `min` (or any future block-level rule) can't be saved,
 * not just nagged about.
 *
 * Why a transient and not post meta: writing meta during the save would itself
 * trigger saves / dirty the post. The transient is keyed by post id, written
 * just-in-time by the editor, and read once by the guard.
 *
 * The error message is intentionally empty — the editor already shows a far
 * better notice (with a "Fix" button). The WP_Error exists purely to block the
 * write; the data payload tells the client which block to jump to.
 *
 * @package GCBLite\RestAPI
 */

namespace GCBLite\RestAPI;

if (!defined('ABSPATH')) {
    exit;
}

class ValidationAPI {

    const ROUTE_NAMESPACE = 'gcblite/v1';
    const TRANSIENT_PREFIX = 'gcblite_validation_';
    const TTL = 300; // 5 minutes — long enough to bridge edit→save.

    public static function init() {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);

        // Block the REST write across the surfaces the block editor saves
        // through. Posts + pages cover the classic editor; wp_template and
        // wp_template_part cover the Site Editor in block themes (where the
        // "post id" is a slug like "twentytwentyfive//home", not a number).
        // Each fires rest_pre_insert_{post_type} (WP_REST_Templates_Controller
        // included), so one callback handles them all.
        foreach (['post', 'page', 'wp_template', 'wp_template_part'] as $type) {
            add_filter("rest_pre_insert_{$type}", [__CLASS__, 'validate_before_save'], 10, 2);
        }

        // Let CPTs / custom surfaces opt in: apply_filters('gcblite_validation_post_types', [...]).
        $extra = apply_filters('gcblite_validation_post_types', []);
        if (is_array($extra)) {
            foreach ($extra as $type) {
                add_filter("rest_pre_insert_{$type}", [__CLASS__, 'validate_before_save'], 10, 2);
            }
        }
    }

    public static function register_routes() {
        register_rest_route(self::ROUTE_NAMESPACE, '/validation-state', [
            'methods'             => 'POST',
            'callback'            => [__CLASS__, 'update_validation_state'],
            'permission_callback' => function () {
                return current_user_can('edit_posts');
            },
            'args' => [
                // String, not integer: the Site Editor's getCurrentPostId()
                // returns a template slug ("theme//home"), not a number.
                'post_id'    => ['type' => 'string', 'required' => true],
                'has_errors' => ['type' => 'boolean'],
                'errors'     => ['type' => 'object'],
            ],
        ]);
    }

    /**
     * Normalise the editor's "current post id" into a transient-safe key
     * fragment. Numeric ids pass through; template slugs ("theme//home")
     * have their non-alphanumerics hashed so the key stays valid + bounded.
     */
    private static function key_for($post_id) {
        $post_id = (string) $post_id;
        if ($post_id === '') return '';
        if (ctype_digit($post_id)) return $post_id;
        return 'tpl_' . md5($post_id);
    }

    /**
     * Editor → server: persist the current validation state for a post or
     * template. has_errors=false clears it (the author fixed everything).
     */
    public static function update_validation_state($request) {
        $raw_id = (string) $request->get_param('post_id');
        if ($raw_id === '') {
            return new \WP_Error('missing_post_id', 'Post ID is required', ['status' => 400]);
        }
        // Editing templates requires edit_theme_options; posts/pages,
        // edit_post on the specific id. The route already gated edit_posts;
        // this is the per-object check where we can do one.
        if (ctype_digit($raw_id) && !current_user_can('edit_post', (int) $raw_id)) {
            return new \WP_Error('forbidden', 'Cannot edit this post', ['status' => 403]);
        }

        $key = self::TRANSIENT_PREFIX . self::key_for($raw_id);

        if ($request->get_param('has_errors')) {
            set_transient($key, [
                'has_errors' => true,
                'errors'     => $request->get_param('errors') ?: [],
                'timestamp'  => time(),
            ], self::TTL);
        } else {
            delete_transient($key);
        }

        return [
            'success'    => true,
            'post_id'    => $raw_id,
            'has_errors' => (bool) $request->get_param('has_errors'),
        ];
    }

    /**
     * rest_pre_insert filter: reject the save when the stashed state says this
     * post has validation errors. Returns the prepared post untouched
     * otherwise.
     *
     * @param \stdClass        $prepared_post
     * @param \WP_REST_Request $request
     * @return \stdClass|\WP_Error
     */
    public static function validate_before_save($prepared_post, $request) {
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return $prepared_post;
        }

        // Resolve the same identifier the editor used as getCurrentPostId():
        //  - posts/pages: numeric ID (on $prepared_post->ID, or $request['id'])
        //  - templates:   slug string like "theme//home" ($request['id'])
        $raw_id = '';
        if (isset($request['id']) && $request['id'] !== '') {
            $raw_id = (string) $request['id'];           // templates + updates
        } elseif (isset($prepared_post->ID) && $prepared_post->ID) {
            $raw_id = (string) $prepared_post->ID;        // numeric posts/pages
        }
        if ($raw_id === '') {
            // New, unsaved post with no id yet — nothing stashed to check.
            return $prepared_post;
        }

        $state = get_transient(self::TRANSIENT_PREFIX . self::key_for($raw_id));
        if (!$state || empty($state['has_errors'])) {
            return $prepared_post;
        }

        $errors   = is_array($state['errors'] ?? null) ? $state['errors'] : [];
        $total    = 0;
        $first    = null;
        $messages = [];
        foreach ($errors as $client_id => $block_errors) {
            if (!is_array($block_errors)) {
                $block_errors = [$block_errors];
            }
            $total += count($block_errors);
            if ($first === null && !empty($block_errors)) {
                $first = $client_id;
            }
            foreach ($block_errors as $msg) {
                if (is_string($msg) && $msg !== '') {
                    $messages[] = $msg;
                }
            }
        }

        // The reason rides in the DATA payload, not the WP_Error message. Our
        // apiFetch middleware reads it and publishes a single notice (under
        // WP's own "editor-save" id, so it replaces rather than duplicates)
        // with the reason + a "Find the block" action. We keep the message
        // EMPTY so that if WP's generic fallback notice ever wins the race it
        // reads just "Updating failed." — no duplicated reason text.
        $reason = $messages
            ? implode(' ', array_unique($messages))
            : __('A block on this page has validation errors.', 'gcblite');

        return new \WP_Error(
            'gcblite_validation_error',
            '',
            [
                'status'              => 400,
                'gcblite_reason'      => $reason,
                'gcblite_error_count' => $total,
                'gcblite_first_block' => $first,
                'gcblite_all_blocks'  => array_keys($errors),
            ]
        );
    }
}
