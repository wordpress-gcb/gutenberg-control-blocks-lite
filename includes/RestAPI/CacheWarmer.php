<?php
/**
 * Cache warmer — refreshes the component-server render cache on save.
 *
 * Why this exists: render_component_server() writes a transient on every
 * fetch (see RenderAPI.php), but the cache is only READ as a fallback
 * on Vercel error. Every editor preview and every public page render
 * still pays the Vercel round-trip.
 *
 * This hook flips that: when a post is saved, we walk every gcb/* block
 * in the new post_content and pre-render it via render_one(). The
 * transient writes happen as a side-effect. After save, the cache is
 * authoritative — readers can short-circuit the network hop entirely.
 *
 * Save-driven invalidation is good enough because the cache key is
 * (block-name + attrs). If a save changed the attrs, the new key has
 * no entry → re-render fires anyway via the normal render path.
 *
 * @package GCBLite\RestAPI
 */

namespace GCBLite\RestAPI;

if (!defined('ABSPATH')) {
    exit;
}

class CacheWarmer {

    public static function init() {
        // Priority 20: after gcb-lite's post-fields save (priority 10) so
        // the meta fields are written before we read attrs from them.
        // Late enough that other plugins' save_post handlers don't
        // interfere with our render calls.
        add_action('save_post', [__CLASS__, 'warm_post'], 20, 2);
    }

    /**
     * Walk every gcb/* block in the saved post and pre-render it through
     * the component-server path. The render side-effects the transient
     * cache, so subsequent reads are instant.
     *
     * Skips:
     *   - autosaves / revisions (no real content change worth pre-rendering)
     *   - posts with empty content
     *   - posts whose content contains no gcb/* blocks (nothing to warm)
     */
    public static function warm_post($post_id, $post) {
        if (wp_is_post_autosave($post_id) || wp_is_post_revision($post_id)) {
            return;
        }
        if (!$post || empty($post->post_content)) {
            return;
        }
        // Cheap pre-filter — bail before parse_blocks if no gcb/* markers.
        if (strpos($post->post_content, '<!-- wp:gcb/') === false) {
            return;
        }

        // Only warm if the component-server path is active. If the active
        // theme has render.php for every block, render_one() routes to PHP
        // and the warm is a no-op anyway — but the work-walk costs us
        // nothing to skip.
        if (\GCBLite\Frontend\Url::get() === '') {
            return;
        }

        $blocks = parse_blocks($post->post_content);
        self::warm_block_tree($blocks);
    }

    /**
     * Recurse through a block tree, warming each gcb/* block's cache.
     * Inner blocks are also walked — abstrak-icon-accordion-item etc.
     * have their own cache keys and benefit from the same warm.
     */
    private static function warm_block_tree(array $blocks) {
        foreach ($blocks as $block) {
            $name = $block['blockName'] ?? '';
            if ($name === '' || strpos($name, 'gcb/') !== 0) {
                if (!empty($block['innerBlocks'])) {
                    self::warm_block_tree($block['innerBlocks']);
                }
                continue;
            }

            // Use the same dispatcher the REST endpoint and render_block
            // filter use. It writes the transient as part of its happy
            // path; that's the side-effect we want.
            //
            // Errors are swallowed — a Vercel-down save shouldn't block
            // the post update. Next page-view will retry through the
            // normal render path.
            try {
                RenderAPI::render_for_cache(
                    $name,
                    is_array($block['attrs'] ?? null) ? $block['attrs'] : [],
                    is_array($block['innerBlocks'] ?? null) ? $block['innerBlocks'] : []
                );
            } catch (\Throwable $e) {
                if (defined('WP_DEBUG') && WP_DEBUG) {
                    error_log("[gcb-lite cache warm] {$name}: " . $e->getMessage());
                }
            }

            if (!empty($block['innerBlocks'])) {
                self::warm_block_tree($block['innerBlocks']);
            }
        }
    }
}
