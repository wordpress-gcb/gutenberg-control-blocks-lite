<?php
/**
 * `wp gcblite seed-showcase` — populate the /all-fields demo page on
 * any GCB-installed WP install.
 *
 * Doubles as the seed body the Playground blueprint runs (via the
 * `run()` static method), so blueprint and CLI stay in lockstep.
 *
 * Idempotent — re-runs update existing rows rather than duplicating.
 *
 * @package GCBLite\CLI
 */

namespace GCBLite\CLI;

use WP_CLI;

if (!defined('ABSPATH')) {
    exit;
}

class SeedShowcaseCommand {

    /**
     * Seed the /all-fields demo page + supporting fixtures.
     *
     * Creates (or updates) a sample post, two demo categories, and an
     * /all-fields page containing a single gcb/field-showcase block
     * with realistic media + reference attributes. Used by the
     * Playground blueprint and as a one-shot setup for staging /
     * Kinsta installs that want the same demo content.
     *
     * ## OPTIONS
     *
     * [--quiet]
     * : Suppress the success summary. Useful for blueprint scripts that
     *   echo their own output.
     *
     * ## EXAMPLES
     *
     *     # Local site with wp-cli on $PATH
     *     wp gcblite seed-showcase
     *
     *     # SSH'd into a remote (Kinsta, staging) — same command
     *     wp gcblite seed-showcase
     *
     *     # As part of a larger setup script
     *     wp gcblite seed-showcase --quiet
     *
     * @when after_wp_load
     */
    public function __invoke($args, $assoc_args) {
        $quiet = !empty($assoc_args['quiet']);
        $result = self::run();
        if ($quiet) {
            return;
        }
        WP_CLI::success(sprintf(
            'Seeded: all-fields page #%d, sample post #%d, categories [%d, %d].',
            $result['page_id'],
            $result['sample_post_id'],
            $result['cat_a'],
            $result['cat_b']
        ));
    }

    /**
     * Do the actual seeding. Shared between the CLI command and the
     * Playground blueprint (which `runPHP`s an include of this file).
     *
     * @return array{
     *     page_id: int,
     *     sample_post_id: int,
     *     cat_a: int,
     *     cat_b: int,
     * }
     */
    public static function run() {
        $sample_post_id = self::upsert('post', 'all-fields-sample-post', [
            'post_title'   => 'Sample post for reference fields',
            'post_name'    => 'sample-post',
            'post_content' => '<p>Used by the all-fields showcase to demonstrate the post-object and relationship controls.</p>',
        ]);

        $cat_a = wp_create_category('Editorial');
        $cat_b = wp_create_category('Engineering');
        if (!is_wp_error($cat_a) && !is_wp_error($cat_b)) {
            wp_set_post_categories($sample_post_id, [$cat_a, $cat_b]);
        }

        $admin      = get_user_by('login', 'admin');
        $admin_id   = $admin ? (int) $admin->ID : 1;
        $image_base = get_stylesheet_directory_uri() . '/assets/images';

        // Resolve a home page id if one exists so the page-link field
        // has something real to point at. Falls back to the sample post.
        $home_page = get_page_by_path('home');
        $page_link = $home_page ? (int) $home_page->ID : $sample_post_id;

        $attrs = [
            'image_field' => [
                'url'         => $image_base . '/project/project-3.png',
                'alt'         => 'Sample image',
                'width'       => 800,
                'height'      => 500,
                'focalPoint'  => ['x' => 0.5, 'y' => 0.35],
                'size'        => 'cover',
                'customWidth' => '',
            ],
            'gallery_field' => [
                ['id' => 1, 'url' => $image_base . '/project/project-1.png', 'alt' => 'Tile 1', 'width' => 800, 'height' => 500],
                ['id' => 2, 'url' => $image_base . '/project/project-2.png', 'alt' => 'Tile 2', 'width' => 800, 'height' => 500],
                ['id' => 3, 'url' => $image_base . '/project/project-4.png', 'alt' => 'Tile 3', 'width' => 800, 'height' => 500],
                ['id' => 4, 'url' => $image_base . '/project/project-5.png', 'alt' => 'Tile 4', 'width' => 800, 'height' => 500],
            ],
            'file_field' => [
                'url'      => $image_base . '/project/mobile-mockup.png',
                'filename' => 'mobile-mockup.png',
                'title'    => 'Mobile mockup',
            ],
            'google_map_field'  => ['lat' => -33.8688, 'lng' => 151.2093, 'zoom' => 12, 'address' => 'Sydney, NSW'],
            'post_object_field' => $sample_post_id,
            'page_link_field'   => $page_link,
            'taxonomy_field'    => array_values(array_filter([
                is_wp_error($cat_a) ? null : (int) $cat_a,
                is_wp_error($cat_b) ? null : (int) $cat_b,
            ])),
            'user_field'         => $admin_id,
            'relationship_field' => [$sample_post_id],
        ];

        $content = '<!-- wp:gcb/field-showcase ' . wp_json_encode($attrs) . ' /-->';

        kses_remove_filters();
        $page_id = self::upsert('page', 'all-fields-page', [
            'post_title'   => 'All fields',
            'post_name'    => 'all-fields',
            'post_content' => $content,
        ]);
        kses_init_filters();

        return [
            'page_id'        => (int) $page_id,
            'sample_post_id' => (int) $sample_post_id,
            'cat_a'          => is_wp_error($cat_a) ? 0 : (int) $cat_a,
            'cat_b'          => is_wp_error($cat_b) ? 0 : (int) $cat_b,
        ];
    }

    /**
     * Upsert a post by a sticky marker stored in post-meta. Same pattern
     * the Playground blueprint uses elsewhere — keeps re-runs safe.
     */
    private static function upsert($post_type, $marker, array $data) {
        $existing = get_posts([
            'post_type'   => $post_type,
            'meta_key'    => '_gcblite_seed_marker',
            'meta_value'  => $marker,
            'post_status' => 'any',
            'numberposts' => 1,
        ]);
        if ($existing) {
            wp_update_post(array_merge(['ID' => $existing[0]->ID], $data));
            return (int) $existing[0]->ID;
        }
        $id = wp_insert_post(array_merge($data, [
            'post_type'   => $post_type,
            'post_status' => 'publish',
        ]));
        update_post_meta($id, '_gcblite_seed_marker', $marker);
        return (int) $id;
    }
}
