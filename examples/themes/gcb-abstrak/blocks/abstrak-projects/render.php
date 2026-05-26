<?php
/**
 * Abstrak Projects — grid of project cards.
 *
 * Resolves the source/count/post_ids attrs into a list of project posts
 * via Collection, extracts the typed-meta fields (cover, live_url) plus
 * the WP-native bits (title, excerpt), and emits both:
 *   1. A server-side preview list (visible in editor + raw WP).
 *   2. A `data-props` JSON island the React frontend reads to render
 *      the polished card grid.
 *
 * Project shape passed to the React side:
 *   {
 *     id, title, excerpt, url,
 *     cover: { url, alt, width, height } | null,
 *     liveUrl: { url, text, opensInNewTab } | null,
 *     categories: [{ id, name, slug }]
 *   }
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

use GCBLite\Blocks\Queries\Collection;

// Bail gracefully if the gcb-lite plugin isn't active. Without this the
// block fatals on Class-not-found during the_content rendering and
// white-screens any page using it.
if (!class_exists(Collection::class)) {
    return;
}

$heading_data = is_array($attributes['heading'] ?? null) ? $attributes['heading'] : [];
$intro        = (string) ($attributes['intro'] ?? '');

$projects = Collection::query($attributes, 'project', ['default_count' => 6]);

$items = array_map(static function (\WP_Post $p) {
    $cover   = get_post_meta($p->ID, 'cover',    true);
    $liveUrl = get_post_meta($p->ID, 'live_url', true);

    $terms = get_the_terms($p->ID, 'project_category');
    $categories = is_array($terms) ? array_map(static fn($t) => [
        'id'   => $t->term_id,
        'name' => $t->name,
        'slug' => $t->slug,
    ], $terms) : [];

    return [
        'id'         => $p->ID,
        'title'      => get_the_title($p),
        'excerpt'    => get_the_excerpt($p),
        'url'        => get_permalink($p),
        'cover'      => is_array($cover) ? [
            'url'    => $cover['url']    ?? '',
            'alt'    => $cover['alt']    ?? '',
            'width'  => $cover['width']  ?? null,
            'height' => $cover['height'] ?? null,
        ] : null,
        'liveUrl'    => is_array($liveUrl) ? $liveUrl : null,
        'categories' => $categories,
    ];
}, $projects);

$props = [
    'heading' => [
        'text'  => (string) ($heading_data['text']  ?? ''),
        'level' => (string) ($heading_data['level'] ?? 'h2'),
    ],
    'intro' => $intro,
    'items' => $items,
];

$wrap = get_block_wrapper_attributes([
    'class'           => 'gcb-abstrak-projects',
    'data-block-name' => 'abstrak-projects',
    'data-props'      => wp_json_encode($props),
]);

$heading_tag = in_array($props['heading']['level'], ['h1','h2','h3','h4','h5','h6'], true)
    ? $props['heading']['level']
    : 'h2';
?>
<section <?php echo $wrap; ?>>
    <?php if ($props['heading']['text']) : ?>
        <<?php echo esc_attr($heading_tag); ?> style="font-size:clamp(1.75rem,4vw,2.5rem);font-weight:700;margin:0 0 0.75rem;">
            <?php echo esc_html($props['heading']['text']); ?>
        </<?php echo esc_attr($heading_tag); ?>>
    <?php endif; ?>

    <?php if ($props['intro']) : ?>
        <p style="font-size:1.125rem;color:#525260;max-width:42rem;margin:0 0 2.5rem;">
            <?php echo esc_html($props['intro']); ?>
        </p>
    <?php endif; ?>

    <?php if (empty($items)) : ?>
        <p style="padding:2rem;border:1px dashed #C7C7D5;border-radius:8px;text-align:center;color:#757589;">
            <?php echo esc_html__('No projects to show yet — add some under Projects in the admin.', 'gcb'); ?>
        </p>
    <?php else : ?>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.5rem;">
            <?php foreach ($items as $project) : ?>
                <article style="border:1px solid #ECF2F6;border-radius:12px;overflow:hidden;background:#fff;">
                    <?php if (!empty($project['cover']['url'])) : ?>
                        <img
                            src="<?php echo esc_url($project['cover']['url']); ?>"
                            alt="<?php echo esc_attr($project['cover']['alt']); ?>"
                            style="display:block;width:100%;height:180px;object-fit:cover;"
                        />
                    <?php endif; ?>
                    <div style="padding:1.25rem;">
                        <h3 style="font-size:1.125rem;font-weight:600;margin:0 0 0.5rem;">
                            <a href="<?php echo esc_url($project['url']); ?>" style="color:#1a1a1a;text-decoration:none;"><?php echo esc_html($project['title']); ?></a>
                        </h3>
                        <?php if (!empty($project['categories'])) : ?>
                            <p style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#757589;margin:0 0 0.5rem;">
                                <?php echo esc_html(implode(', ', array_column($project['categories'], 'name'))); ?>
                            </p>
                        <?php endif; ?>
                        <?php if ($project['excerpt']) : ?>
                            <p style="font-size:0.875rem;color:#525260;margin:0;line-height:1.5;">
                                <?php echo esc_html(wp_trim_words($project['excerpt'], 18)); ?>
                            </p>
                        <?php endif; ?>
                    </div>
                </article>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</section>
