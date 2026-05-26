<?php
/**
 * Saas Projects — "Selected work" grid.
 *
 * Mirrors SaasProjectsView.jsx's markup so theme.css styles it
 * identically in the editor (where React doesn't hydrate) and on the
 * frontend (where React hydrates as progressive enhancement).
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists(\GCBLite\Blocks\Queries\Collection::class)) {
    return;
}
use GCBLite\Blocks\Queries\Collection;

// Bail gracefully if the gcb-lite plugin isn't active.
if (!class_exists(Collection::class)) {
    return;
}

$heading_data = is_array($attributes['heading'] ?? null) ? $attributes['heading'] : [];
$intro        = (string) ($attributes['intro'] ?? '');

$projects = Collection::query($attributes, 'project', ['default_count' => 6]);

$image_base = get_stylesheet_directory_uri() . '/assets/images';

$items = array_map(static function (\WP_Post $p) use ($image_base) {
    $cover   = get_post_meta($p->ID, 'cover',    true);
    $liveUrl = get_post_meta($p->ID, 'live_url', true);

    $terms = get_the_terms($p->ID, 'project_category');
    $categories = is_array($terms) ? array_map(static fn($t) => [
        'id'   => $t->term_id,
        'name' => $t->name,
        'slug' => $t->slug,
    ], $terms) : [];

    $cover_url = is_array($cover) && !empty($cover['url']) ? $cover['url'] : ($image_base . '/project/project-7.png');

    return [
        'id'         => $p->ID,
        'title'      => get_the_title($p),
        'excerpt'    => get_the_excerpt($p),
        'url'        => get_permalink($p),
        'cover'      => ['url' => $cover_url, 'alt' => $cover['alt'] ?? ''],
        'liveUrl'    => is_array($liveUrl) ? $liveUrl : null,
        'categories' => $categories,
    ];
}, $projects);

// Sample fallback when CPT is empty — matches the React SAMPLE_PROJECTS
// so editor + frontend look identical.
if (empty($items)) {
    $samples = [
        ['Postwave CMS Marketing', 'project-1.png', ['SaaS site', 'Next.js']],
        ['Beacon Analytics',       'project-4.png', ['Web app', 'React']],
        ['Glide Editorial',        'project-2.png', ['Publishing', 'Next.js']],
        ['Atlas Docs Hub',         'project-3.png', ['Docs', 'MDX']],
    ];
    $items = array_map(static function ($s) use ($image_base) {
        [$title, $img, $cats] = $s;
        return [
            'id'    => sanitize_title($title),
            'title' => $title,
            'url'   => '#',
            'cover' => ['url' => $image_base . '/project/' . $img, 'alt' => $title],
            'categories' => array_map(fn($c) => ['name' => $c], $cats),
        ];
    }, $samples);
}

$props = [
    'heading'    => [
        'text'  => (string) ($heading_data['text']  ?? 'Selected work'),
        'level' => (string) ($heading_data['level'] ?? 'h2'),
    ],
    'subtitle'   => 'Built with GCB',
    'intro'      => $intro ?: 'Real sites running typed-field Gutenberg blocks rendered through a React frontend. Same component in the editor and on the live page.',
    'items'      => $items,
];

$wrap = get_block_wrapper_attributes([
    'class'           => 'section section-padding-equal bg-color-dark gcb-saas-projects',
    'data-block-name' => 'saas-projects',
    'data-props'      => wp_json_encode($props),
]);

$heading_tag = in_array($props['heading']['level'], ['h1','h2','h3','h4','h5','h6'], true)
    ? $props['heading']['level']
    : 'h2';

$slugify = static function (string $s) {
    return strtolower(preg_replace(['/[^\w ]+/', '/ +/'], ['', '-'], $s));
};
?>
<div <?php echo $wrap; ?>>
    <div class="container">
        <div class="section-heading heading-light-left mb--90 ">
            <div class="subtitle"><?php echo esc_html($props['subtitle']); ?></div>
            <<?php echo esc_attr($heading_tag); ?> class="title">
                <?php echo esc_html($props['heading']['text']); ?>
            </<?php echo esc_attr($heading_tag); ?>>
            <p><?php echo esc_html($props['intro']); ?></p>
        </div>

        <div class="project-add-banner">
            <div class="content">
                <span class="subtitle">featured — built with GCB</span>
                <h3 class="title">This entire site is a GCB demo.</h3>
                <p style="color: var(--color-gray-1);">
                    Every section above is a typed-field block on a WordPress page,
                    rendered as React via the gcb-lite plugin and a Next.js frontend.
                </p>
            </div>
            <div class="thumbnail">
                <img src="<?php echo esc_url($image_base); ?>/project/mobile-mockup.png" alt="GCB demo mockup" />
            </div>
        </div>

        <div class="row row-45">
            <?php foreach ($props['items'] as $portfolio):
                $href = $portfolio['url'] ?? ('/project-details/' . $slugify($portfolio['title']));
                $cats = array_map(fn($c) => $c['name'] ?? '', $portfolio['categories'] ?? []);
            ?>
                <div class="col-md-6">
                    <div class="project-grid project-style-2">
                        <div class="thumbnail">
                            <a href="<?php echo esc_url($href); ?>">
                                <img src="<?php echo esc_url($portfolio['cover']['url'] ?? ''); ?>" alt="icon" />
                            </a>
                        </div>
                        <div class="content">
                            <span class="subtitle">
                                <?php foreach ($cats as $cat): ?>
                                    <span><?php echo esc_html($cat); ?></span>
                                <?php endforeach; ?>
                            </span>
                            <h3 class="title">
                                <a href="<?php echo esc_url($href); ?>">
                                    <?php echo esc_html($portfolio['title']); ?>
                                </a>
                            </h3>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>

        <div class="more-project-btn">
            <a href="#" class="axil-btn btn-fill-white">Discover More Projects</a>
        </div>
    </div>
</div>
