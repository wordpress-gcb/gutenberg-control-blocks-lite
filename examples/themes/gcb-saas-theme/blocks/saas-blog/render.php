<?php
/**
 * Saas Blog — "From the blog" 2-up list.
 *
 * Mirrors SaasBlogView.jsx markup.
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

$heading_data = is_array($attributes['heading'] ?? null) ? $attributes['heading'] : [];
$intro        = (string) ($attributes['intro'] ?? '');

$posts = Collection::query($attributes, 'post', ['default_count' => 2, 'max_count' => 12]);

$image_base = get_stylesheet_directory_uri() . '/assets/images';

$items = array_map(static function (\WP_Post $p) use ($image_base) {
    $thumb_id  = get_post_thumbnail_id($p->ID);
    $thumb_src = $thumb_id ? wp_get_attachment_image_src($thumb_id, 'medium_large') : null;
    return [
        'id'      => $p->ID,
        'title'   => get_the_title($p),
        'excerpt' => get_the_excerpt($p),
        'link'    => get_permalink($p),
        'thumb'   => $thumb_src ? $thumb_src[0] : ($image_base . '/blog/thumb_5.png'),
    ];
}, $posts);

// Sample fallback — matches React SAMPLE_POSTS.
if (empty($items)) {
    $items = [
        [
            'id' => 1,
            'title' => 'Follow your own design process, whatever gets you to the outcome.',
            'excerpt' => 'Want to know the one thing that every successful digital marketer does first to ensure they get the biggest return on their marketing budget?',
            'thumb' => $image_base . '/blog/thumb_5.png',
            'link' => '#',
        ],
        [
            'id' => 2,
            'title' => 'How To Use a Remarketing Strategy To Get More',
            'excerpt' => 'Want to know the one thing that every successful digital marketer does first to ensure they get the biggest return on their marketing budget?',
            'thumb' => $image_base . '/blog/thumb_1.png',
            'link' => '#',
        ],
    ];
}

$props = [
    'heading' => [
        'text'  => (string) ($heading_data['text']  ?? 'From the blog'),
        'level' => (string) ($heading_data['level'] ?? 'h2'),
    ],
    'subtitle'    => 'Latest writing',
    'description' => $intro ?: 'Tips, patterns, and release notes from the team building GCB and the headless Gutenberg stack around it.',
    'items'       => $items,
];

$wrap = get_block_wrapper_attributes([
    'class'           => 'section section-padding-equal gcb-saas-blog',
    'data-block-name' => 'saas-blog',
    'data-props'      => wp_json_encode($props),
]);

$heading_tag = in_array($props['heading']['level'], ['h1','h2','h3','h4','h5','h6'], true)
    ? $props['heading']['level']
    : 'h2';
?>
<div <?php echo $wrap; ?>>
    <div class="container">
        <div class="section-heading  ">
            <div class="subtitle"><?php echo wp_kses_post($props['subtitle']); ?></div>
            <<?php echo esc_attr($heading_tag); ?> class="title" <?php gcb_focus('heading'); ?>>
                <?php echo wp_kses_post($props['heading']['text']); ?>
            </<?php echo esc_attr($heading_tag); ?>>
            <p <?php gcb_focus('intro'); ?>><?php echo wp_kses_post($props['description']); ?></p>
        </div>
        <div class="row g-0">
            <?php foreach ($props['items'] as $idx => $post):
                $border = $idx % 2 === 1 ? 'border-start' : '';
            ?>
                <div class="col-xl-6">
                    <div class="blog-list <?php echo esc_attr($border); ?>">
                        <div class="post-thumbnail">
                            <a href="<?php echo esc_url($post['link']); ?>">
                                <img src="<?php echo esc_url($post['thumb']); ?>" alt="<?php echo esc_attr($post['title'] ?: 'Blog post'); ?>" />
                            </a>
                        </div>
                        <div class="post-content">
                            <h5 class="title">
                                <a href="<?php echo esc_url($post['link']); ?>"><?php echo esc_html($post['title']); ?></a>
                            </h5>
                            <p><?php echo esc_html($post['excerpt']); ?></p>
                            <a href="<?php echo esc_url($post['link']); ?>" class="more-btn">
                                Learn more &rsaquo;
                            </a>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
    <ul class="shape-group-1 list-unstyled">
        <li class="shape shape-1"><img src="<?php echo esc_url($image_base); ?>/others/bubble-1.png" alt="bubble" /></li>
        <li class="shape shape-2"><img src="<?php echo esc_url($image_base); ?>/others/line-1.png"   alt="bubble" /></li>
        <li class="shape shape-3"><img src="<?php echo esc_url($image_base); ?>/others/line-2.png"   alt="bubble" /></li>
        <li class="shape shape-4"><img src="<?php echo esc_url($image_base); ?>/others/bubble-2.png" alt="bubble" /></li>
    </ul>
</div>
