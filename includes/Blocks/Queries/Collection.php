<?php
/**
 * Resolve a "collection" block's source-mode attrs into a WP_Post array.
 *
 * Section blocks like saas-projects, saas-testimonials, etc.
 * follow the same pattern: pick a post type, decide whether to show
 * "the latest N" or "this specific list, in this order". This helper
 * runs the right WP_Query so each block doesn't reinvent the wheel.
 *
 * Block attrs shape (the controls snippet under
 * AGENTS.md → "Collection query attrs"):
 *
 *   {
 *     "source":   "latest" | "manual",
 *     "count":    6,                          // for latest
 *     "post_ids": [42, 19, 7]                 // for manual, ordered
 *   }
 *
 * Call from a render.php like:
 *
 *   use GCBLite\Blocks\Queries\Collection;
 *
 *   $posts = Collection::query($attributes, 'project', ['default_count' => 6]);
 *   foreach ($posts as $project) {
 *       echo '<article>' . esc_html($project->post_title) . '</article>';
 *   }
 *
 * Always returns an array (possibly empty) — render callers don't need
 * defensive ?: [] fallbacks.
 *
 * @package GCBLite\Blocks\Queries
 */

namespace GCBLite\Blocks\Queries;

if (!defined('ABSPATH')) {
    exit;
}

class Collection {

    /**
     * Resolve the attrs + post type into an ordered list of WP_Post.
     *
     * @param array  $attrs         The block attributes object.
     * @param string $post_type     The CPT slug to query.
     * @param array  $options       Optional defaults / caps.
     *                              - default_count: int   (default 6)
     *                              - max_count:     int   (default 100)
     * @return array<int, \WP_Post>
     */
    public static function query(array $attrs, $post_type, array $options = []) {
        if (!is_string($post_type) || $post_type === '') {
            return [];
        }

        $source = isset($attrs['source']) && $attrs['source'] === 'manual' ? 'manual' : 'latest';
        $max    = (int) ($options['max_count'] ?? 100);

        if ($source === 'manual') {
            return self::query_manual($attrs, $post_type, $max);
        }

        $default_count = (int) ($options['default_count'] ?? 6);
        return self::query_latest($attrs, $post_type, $default_count, $max);
    }

    private static function query_latest(array $attrs, $post_type, $default_count, $max) {
        $count = (int) ($attrs['count'] ?? $default_count);
        if ($count <= 0) return [];
        if ($count > $max) $count = $max;

        $q = new \WP_Query([
            'post_type'              => $post_type,
            'post_status'            => 'publish',
            'posts_per_page'         => $count,
            'orderby'                => 'date',
            'order'                  => 'DESC',
            'ignore_sticky_posts'    => true,
            'no_found_rows'          => true,           // skip SQL_CALC_FOUND_ROWS
            'update_post_meta_cache' => true,
            'update_post_term_cache' => false,          // only enable if the renderer needs taxonomies
        ]);

        return $q->posts;
    }

    private static function query_manual(array $attrs, $post_type, $max) {
        $ids = $attrs['post_ids'] ?? [];
        if (!is_array($ids) || empty($ids)) return [];

        // Coerce to ints, drop bad entries, cap at max.
        $ids = array_values(array_filter(array_map('intval', $ids), fn($id) => $id > 0));
        if (count($ids) > $max) {
            $ids = array_slice($ids, 0, $max);
        }
        if (empty($ids)) return [];

        $q = new \WP_Query([
            'post_type'              => $post_type,
            'post_status'            => 'publish',
            'post__in'               => $ids,
            'orderby'                => 'post__in',     // preserve author's order
            'posts_per_page'         => count($ids),
            'ignore_sticky_posts'    => true,
            'no_found_rows'          => true,
            'update_post_meta_cache' => true,
            'update_post_term_cache' => false,
        ]);

        return $q->posts;
    }
}
