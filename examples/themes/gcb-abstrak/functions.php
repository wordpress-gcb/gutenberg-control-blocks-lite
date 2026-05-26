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

/**
 * Theme-level dependency check.
 *
 * Everything below — CPT registration, the asset enqueue, even the
 * abstrak-* blocks themselves (via gcb-lite's BlockLoader which scans
 * this theme's blocks/ dir) — assumes the gcb-lite plugin is active.
 * Without it, the theme would white-screen the site the next time any
 * abstrak-* render.php runs.
 *
 * If gcb-lite is missing, register a single admin notice telling the
 * admin to install / activate it, then bail out so we don't register
 * CPTs, enqueue scripts, or do anything else that depends on the plugin.
 *
 * The render.php files in blocks/ also each guard individually, so even
 * if the plugin is deactivated mid-flight the worst case is empty
 * blocks, not fatals. Belt + braces.
 */
if (!function_exists('gcblite_register_post_fields')) {
    add_action('admin_notices', static function () {
        echo '<div class="notice notice-error"><p><strong>GCB Abstrak theme</strong> requires the <strong>GCB Lite</strong> plugin to be active. CPTs, fields, and the front-end block rendering all depend on it.</p></div>';
    });
    return;
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
 * Enqueue the React hydration bundle + Abstrak CSS on every frontend
 * page. The bundle scans for [data-block-name] wrappers emitted by the
 * abstrak-* block render.php files and replaces their SSR'd contents
 * with the matching React component, keeping the frontend visually 1:1
 * with the Vercel-hosted demo.
 *
 * Built from gcb-next-starter via `npm run build:theme` — see the
 * theme-bundle/ directory in that repo. The compiled artefacts live in
 * this theme's build/ directory (committed; not built on the server).
 *
 * Loaded ONLY on the frontend. The block editor doesn't need this —
 * gcb-lite's editor SSR loop calls render.php and pipes the HTML into
 * an iframe, and the iframe DOES include this enqueue via the standard
 * editor styles pipeline. Loading it twice would double-hydrate.
 */
add_action('wp_enqueue_scripts', static function () {
    $theme_dir = get_stylesheet_directory();
    $theme_uri = get_stylesheet_directory_uri();
    $js_path   = $theme_dir . '/build/theme.js';
    $css_path  = $theme_dir . '/build/theme.css';

    if (file_exists($css_path)) {
        wp_enqueue_style(
            'gcb-abstrak-theme',
            $theme_uri . '/build/theme.css',
            [],
            (string) filemtime($css_path),
        );
    }

    if (file_exists($js_path)) {
        wp_enqueue_script(
            'gcb-abstrak-theme',
            $theme_uri . '/build/theme.js',
            [],
            (string) filemtime($js_path),
            ['in_footer' => true, 'strategy' => 'defer'],
        );

        // Set the runtime image base so the bundled components route
        // their hardcoded `/images/foo.png` paths to this theme's
        // assets dir. Without this they'd 404 (Next.js serves them
        // from /public, WP doesn't).
        $image_base = esc_url($theme_uri . '/assets/images');
        wp_add_inline_script(
            'gcb-abstrak-theme',
            'window.__GCB_IMAGE_BASE__ = ' . wp_json_encode($image_base) . ';',
            'before',
        );
    }
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
