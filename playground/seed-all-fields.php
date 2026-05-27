<?php
/**
 * Seed the /all-fields demo page + the supporting fixtures it
 * references (sample post, two categories). Idempotent: re-running
 * updates existing rows instead of duplicating them.
 *
 * Usage:
 *   - Bundled into the Playground blueprint's runPHP step (so a
 *     fresh Playground session is pre-seeded)
 *   - Or run standalone against any GCB-installed WP via wp-cli:
 *
 *       wp eval-file path/to/seed-all-fields.php
 *
 *     A wrapper script (seed-all-fields.sh) handles that for remote
 *     servers (Kinsta etc.) — it ships the file over SSH first.
 *
 * Returns nothing; prints a one-line summary so callers know what
 * happened.
 *
 * @package GCBLite\Playground
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Upsert by a marker stored on post-meta. Same pattern the
 * Playground blueprint uses for the saas-* CPTs — keeps the script
 * safe to re-run.
 */
if (!function_exists('gcb_seed_upsert')) {
    function gcb_seed_upsert($post_type, $marker, array $data, array $meta = []) {
        $existing = get_posts([
            'post_type'   => $post_type,
            'meta_key'    => '_gcblite_seed_marker',
            'meta_value'  => $marker,
            'post_status' => 'any',
            'numberposts' => 1,
        ]);
        if ($existing) {
            wp_update_post(array_merge(['ID' => $existing[0]->ID], $data));
            $id = $existing[0]->ID;
        } else {
            $id = wp_insert_post(array_merge($data, [
                'post_type'   => $post_type,
                'post_status' => 'publish',
            ]));
            update_post_meta($id, '_gcblite_seed_marker', $marker);
        }
        foreach ($meta as $k => $v) {
            update_post_meta($id, $k, $v);
        }
        return $id;
    }
}

// --- Reference fixtures ----------------------------------------

$sample_post_id = gcb_seed_upsert('post', 'all-fields-sample-post', [
    'post_title'   => 'Sample post for reference fields',
    'post_name'    => 'sample-post',
    'post_content' => '<p>Used by the all-fields showcase to demonstrate the post-object and relationship controls.</p>',
]);

$cat_a = wp_create_category('Editorial');
$cat_b = wp_create_category('Engineering');
if (!is_wp_error($cat_a) && !is_wp_error($cat_b)) {
    wp_set_post_categories($sample_post_id, [$cat_a, $cat_b]);
}

$admin       = get_user_by('login', 'admin');
$admin_id    = $admin ? (int) $admin->ID : 1;
$image_base  = get_stylesheet_directory_uri() . '/assets/images';

// --- Showcase attributes ---------------------------------------

// Resolve a home page id if one exists so the page-link field
// has something real to point at. Falls back to the sample post.
$home_page  = get_page_by_path('home');
$page_link  = $home_page ? (int) $home_page->ID : $sample_post_id;

$showcase_attrs = [
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

$content = '<!-- wp:gcb/field-showcase ' . wp_json_encode($showcase_attrs) . ' /-->';

kses_remove_filters();
$page_id = gcb_seed_upsert('page', 'all-fields-page', [
    'post_title'   => 'All fields',
    'post_name'    => 'all-fields',
    'post_content' => $content,
]);
kses_init_filters();

echo sprintf(
    "[gcb-seed] all-fields page id=%d, sample post id=%d, categories=[%d, %d]\n",
    $page_id,
    $sample_post_id,
    is_wp_error($cat_a) ? 0 : (int) $cat_a,
    is_wp_error($cat_b) ? 0 : (int) $cat_b
);
