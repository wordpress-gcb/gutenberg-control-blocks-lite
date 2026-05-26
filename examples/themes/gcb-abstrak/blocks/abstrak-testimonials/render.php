<?php
/**
 * Abstrak Testimonials — quotes section.
 *
 * Resolves source/count/post_ids via Collection, then extracts the
 * typed meta from each testimonial CPT post. Same data-props pattern
 * as the other abstrak-* blocks.
 *
 * Testimonial shape:
 *   {
 *     id, quote, authorName, authorRole,
 *     authorImage: { url, alt } | null,
 *     fromLabel, fromLogo: { url, alt } | null
 *   }
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

use GCBLite\Blocks\Queries\Collection;

// Bail gracefully if the gcb-lite plugin isn't active.
if (!class_exists(Collection::class)) {
    return;
}

$heading_data = is_array($attributes['heading'] ?? null) ? $attributes['heading'] : [];

$posts = Collection::query($attributes, 'testimonial', ['default_count' => 3, 'max_count' => 12]);

$items = array_map(static function (\WP_Post $p) {
    $author_image = get_post_meta($p->ID, 'author_image', true);
    $from_logo    = get_post_meta($p->ID, 'from_logo',    true);

    return [
        'id'          => $p->ID,
        'quote'       => (string) get_post_meta($p->ID, 'quote', true),
        'authorName'  => (string) get_post_meta($p->ID, 'author_name', true),
        'authorRole'  => (string) get_post_meta($p->ID, 'author_role', true),
        'authorImage' => is_array($author_image) ? [
            'url' => $author_image['url'] ?? '',
            'alt' => $author_image['alt'] ?? '',
        ] : null,
        'fromLabel'   => (string) get_post_meta($p->ID, 'from_label', true),
        'fromLogo'    => is_array($from_logo) ? [
            'url' => $from_logo['url'] ?? '',
            'alt' => $from_logo['alt'] ?? '',
        ] : null,
    ];
}, $posts);

$props = [
    'heading' => [
        'text'  => (string) ($heading_data['text']  ?? ''),
        'level' => (string) ($heading_data['level'] ?? 'h2'),
    ],
    'items' => $items,
];

$wrap = get_block_wrapper_attributes([
    'class'           => 'gcb-abstrak-testimonials',
    'data-block-name' => 'abstrak-testimonials',
    'data-props'      => wp_json_encode($props),
]);

$heading_tag = in_array($props['heading']['level'], ['h1','h2','h3','h4','h5','h6'], true)
    ? $props['heading']['level']
    : 'h2';
?>
<section <?php echo $wrap; ?>>
    <?php if ($props['heading']['text']) : ?>
        <<?php echo esc_attr($heading_tag); ?> style="font-size:clamp(1.75rem,4vw,2.5rem);font-weight:700;margin:0 0 2.5rem;text-align:center;">
            <?php echo esc_html($props['heading']['text']); ?>
        </<?php echo esc_attr($heading_tag); ?>>
    <?php endif; ?>

    <?php if (empty($items)) : ?>
        <p style="padding:2rem;border:1px dashed #C7C7D5;border-radius:8px;text-align:center;color:#757589;">
            <?php echo esc_html__('No testimonials yet — add some under Testimonials in the admin.', 'gcb'); ?>
        </p>
    <?php else : ?>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;">
            <?php foreach ($items as $t) : ?>
                <figure style="background:#fff;border:1px solid #ECF2F6;border-radius:12px;padding:1.5rem;margin:0;">
                    <blockquote style="font-size:1rem;line-height:1.6;color:#292930;margin:0 0 1rem;font-style:italic;">
                        <?php echo esc_html($t['quote']); ?>
                    </blockquote>
                    <figcaption style="display:flex;align-items:center;gap:0.75rem;">
                        <?php if (!empty($t['authorImage']['url'])) : ?>
                            <img src="<?php echo esc_url($t['authorImage']['url']); ?>" alt="<?php echo esc_attr($t['authorImage']['alt']); ?>" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
                        <?php endif; ?>
                        <div>
                            <?php if ($t['authorName']) : ?>
                                <div style="font-weight:600;font-size:0.875rem;"><?php echo esc_html($t['authorName']); ?></div>
                            <?php endif; ?>
                            <?php if ($t['authorRole']) : ?>
                                <div style="font-size:0.75rem;color:#757589;"><?php echo esc_html($t['authorRole']); ?></div>
                            <?php endif; ?>
                        </div>
                    </figcaption>
                </figure>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</section>
