<?php
/**
 * GCB Abstrak — theme bootstrap.
 *
 * Registers the three content types the Abstrak SaaS demo lives on
 * (project, testimonial, brand) and attaches typed gcb-lite fields to
 * each. Each CPT is REST-exposed so the headless React frontend can
 * query them at /wp/v2/{slug}.
 *
 * No layout / template work happens here — the theme intentionally
 * defers all rendering to the React frontend. WP's only job in this
 * setup is to author content and expose it via REST.
 *
 * @package GCB_Abstrak
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('after_setup_theme', static function () {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', ['search-form', 'comment-form', 'comment-list', 'gallery', 'caption']);
    add_theme_support('responsive-embeds');
    add_theme_support('align-wide');
    // theme.json already handles editor styles + colour palette + typography
    // so we don't enqueue an editor stylesheet here. Anything that needs
    // a CSS variable can reference --wp--preset--color--{slug} directly.
});

/**
 * Project — a portfolio / case-study item.
 *
 * Field set mirrors the original Abstrak JSON fixture at
 * src/data/project/projectData.json so the React frontend's existing
 * components can consume it without changes:
 *   { id, image, title, category, excerpt, body[] }
 *
 * - title:    WP post title (no custom field needed)
 * - image:    'cover' image field
 * - category: a real WP taxonomy ('project_category') so it inherits the
 *             full taxonomy admin UI and REST surface. Authors get
 *             tag-style chip entry rather than a free-text field.
 * - excerpt:  WP native excerpt (post supports 'excerpt')
 * - body:     WP native editor (longer prose) — the original JSON
 *             splits this into paragraphs; the React frontend can do
 *             the same split server-side if it cares about per-paragraph
 *             control.
 */
add_action('init', static function () {
    register_post_type('project', [
        'label'        => __('Projects', 'gcb-abstrak'),
        'public'       => true,
        'show_in_rest' => true,
        'menu_icon'    => 'dashicons-portfolio',
        'supports'     => ['title', 'editor', 'excerpt', 'thumbnail'],
        'has_archive'  => true,
        'rewrite'      => ['slug' => 'projects'],
    ]);

    register_taxonomy('project_category', 'project', [
        'label'        => __('Project Categories', 'gcb-abstrak'),
        'public'       => true,
        'show_in_rest' => true,
        'hierarchical' => false,
        'rewrite'      => ['slug' => 'project-category'],
    ]);

    if (function_exists('gcblite_register_post_fields')) {
        gcblite_register_post_fields('project', [
            'has_body' => true, // we kept editor support for the long body
            'controls' => [
                ['type'  => 'image',
                 'attributeKey' => 'cover',
                 'label' => __('Cover image', 'gcb-abstrak'),
                 'validation' => ['required' => true]],
                ['type'  => 'url',
                 'attributeKey' => 'live_url',
                 'label' => __('Live URL', 'gcb-abstrak'),
                 'helpText' => __('Optional — link to the live project.', 'gcb-abstrak')],
            ],
        ]);
    }
});

/**
 * Testimonial — a single customer quote.
 *
 * Mirrors src/data/testimonial/TestimonialData.json:
 *   { fromtext, from, description, authorimg, authorname, authordesig }
 *
 * Quote (description) is required; everything else is optional but the
 * React frontend has fallbacks for missing fields.
 */
add_action('init', static function () {
    register_post_type('testimonial', [
        'label'        => __('Testimonials', 'gcb-abstrak'),
        'public'       => true,
        'show_in_rest' => true,
        'menu_icon'    => 'dashicons-format-quote',
        'supports'     => ['title'], // 'editor' stripped by gcb-lite (fields-only)
    ]);

    if (function_exists('gcblite_register_post_fields')) {
        gcblite_register_post_fields('testimonial', [
            'controls' => [
                ['type'  => 'textarea',
                 'attributeKey' => 'quote',
                 'label' => __('Quote', 'gcb-abstrak'),
                 'placeholder' => __('“ Donec metus lorem… ”', 'gcb-abstrak'),
                 'validation' => ['required' => true, 'minLength' => 10]],
                ['type'  => 'text',
                 'attributeKey' => 'author_name',
                 'label' => __('Author name', 'gcb-abstrak'),
                 'validation' => ['required' => true]],
                ['type'  => 'text',
                 'attributeKey' => 'author_role',
                 'label' => __('Author role', 'gcb-abstrak')],
                ['type'  => 'image',
                 'attributeKey' => 'author_image',
                 'label' => __('Author headshot', 'gcb-abstrak')],
                ['type'  => 'text',
                 'attributeKey' => 'from_label',
                 'label' => __('Source label', 'gcb-abstrak'),
                 'placeholder' => __('e.g. Google, Yelp', 'gcb-abstrak')],
                ['type'  => 'image',
                 'attributeKey' => 'from_logo',
                 'label' => __('Source logo', 'gcb-abstrak')],
            ],
        ]);
    }
});

/**
 * Brand — a logo strip entry.
 *
 * Title = brand name. Logo = the only field we need.
 */
add_action('init', static function () {
    register_post_type('brand', [
        'label'        => __('Brands', 'gcb-abstrak'),
        'public'       => true,
        'show_in_rest' => true,
        'menu_icon'    => 'dashicons-awards',
        'supports'     => ['title'],
    ]);

    if (function_exists('gcblite_register_post_fields')) {
        gcblite_register_post_fields('brand', [
            'controls' => [
                ['type'  => 'image',
                 'attributeKey' => 'logo',
                 'label' => __('Logo', 'gcb-abstrak'),
                 'validation' => ['required' => true]],
                ['type'  => 'url',
                 'attributeKey' => 'website',
                 'label' => __('Website', 'gcb-abstrak')],
            ],
        ]);
    }
});

/**
 * Light heads-up if the gcb-lite plugin isn't active. We could harder-
 * gate by die()ing in functions.php, but that locks out admins who are
 * mid-setup. An admin notice is enough nudge.
 */
add_action('admin_notices', static function () {
    if (function_exists('gcblite_register_post_fields')) {
        return;
    }
    echo '<div class="notice notice-warning"><p>'
        . esc_html__(
            'GCB Abstrak needs the GCB Lite plugin to register CPT fields. Install + activate it from the Plugins screen.',
            'gcb-abstrak'
        )
        . '</p></div>';
});
