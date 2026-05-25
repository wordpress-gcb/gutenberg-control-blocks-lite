<?php
/**
 * Abstrak Blog — recent posts section. Uses WP's standard `post` type
 * (not a CPT) so cover image comes from the featured image rather than
 * a typed-meta field.
 *
 * Post shape:
 *   { id, title, excerpt, url, date, cover: { url, alt } | null, author: string }
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

use GCBLite\Blocks\Queries\Collection;

$heading_data = is_array($attributes['heading'] ?? null) ? $attributes['heading'] : [];
$intro        = (string) ($attributes['intro'] ?? '');

$posts = Collection::query($attributes, 'post', ['default_count' => 3, 'max_count' => 12]);

$items = array_map(static function (\WP_Post $p) {
    $thumb_id  = get_post_thumbnail_id($p->ID);
    $thumb_src = $thumb_id ? wp_get_attachment_image_src($thumb_id, 'medium_large') : null;

    return [
        'id'      => $p->ID,
        'title'   => get_the_title($p),
        'excerpt' => get_the_excerpt($p),
        'url'     => get_permalink($p),
        'date'    => mysql2date('c', $p->post_date_gmt, false),
        'cover'   => $thumb_src ? [
            'url' => $thumb_src[0],
            'alt' => (string) get_post_meta($thumb_id, '_wp_attachment_image_alt', true),
        ] : null,
        'author'  => (string) get_the_author_meta('display_name', (int) $p->post_author),
    ];
}, $posts);

$props = [
    'heading' => [
        'text'  => (string) ($heading_data['text']  ?? ''),
        'level' => (string) ($heading_data['level'] ?? 'h2'),
    ],
    'intro' => $intro,
    'items' => $items,
];

$wrap = get_block_wrapper_attributes([
    'class'           => 'gcb-abstrak-blog',
    'data-block-name' => 'abstrak-blog',
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
            <?php echo esc_html__('No blog posts yet — write some under Posts in the admin.', 'gcb'); ?>
        </p>
    <?php else : ?>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.5rem;">
            <?php foreach ($items as $post_item) : ?>
                <article style="border:1px solid #ECF2F6;border-radius:12px;overflow:hidden;background:#fff;">
                    <?php if (!empty($post_item['cover']['url'])) : ?>
                        <img src="<?php echo esc_url($post_item['cover']['url']); ?>" alt="<?php echo esc_attr($post_item['cover']['alt']); ?>" style="display:block;width:100%;height:180px;object-fit:cover;" />
                    <?php endif; ?>
                    <div style="padding:1.25rem;">
                        <h3 style="font-size:1.125rem;font-weight:600;margin:0 0 0.5rem;">
                            <a href="<?php echo esc_url($post_item['url']); ?>" style="color:#1a1a1a;text-decoration:none;"><?php echo esc_html($post_item['title']); ?></a>
                        </h3>
                        <?php if ($post_item['author']) : ?>
                            <p style="font-size:0.75rem;color:#757589;margin:0 0 0.5rem;">
                                By <?php echo esc_html($post_item['author']); ?>
                            </p>
                        <?php endif; ?>
                        <?php if ($post_item['excerpt']) : ?>
                            <p style="font-size:0.875rem;color:#525260;margin:0;line-height:1.5;">
                                <?php echo esc_html(wp_trim_words($post_item['excerpt'], 22)); ?>
                            </p>
                        <?php endif; ?>
                    </div>
                </article>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</section>
