<?php
/**
 * Saas Testimonials — quotes section.
 *
 * Mirrors SaasTestimonialsView.jsx markup. Editor + frontend render
 * identical styled HTML; React bundle hydrates on the frontend as
 * progressive enhancement only.
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

$posts = Collection::query($attributes, 'testimonial', ['default_count' => 3, 'max_count' => 12]);

$image_base = get_stylesheet_directory_uri() . '/assets/images';

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

// Sample fallback when CPT is empty — matches React SAMPLE_TESTIMONIALS.
if (empty($items)) {
    $items = [
        [
            'id' => 1,
            'quote' => '“ Donec metus lorem, vulputate at sapien sit amet, auctor iaculis lorem. In vel hendrerit nisi. Vestibulum eget risus velit. ”',
            'authorName' => 'Darrell Steward',
            'authorRole' => 'Executive Chairman',
            'authorImage' => ['url' => $image_base . '/testimonial/testimonial-1.png', 'alt' => 'Darrell Steward'],
            'fromLabel' => 'Yelp',
            'fromLogo' => ['url' => $image_base . '/icon/yelp-2.png', 'alt' => 'Yelp'],
        ],
        [
            'id' => 2,
            'quote' => '“ Donec metus lorem, vulputate at sapien sit amet, auctor iaculis lorem. In vel hendrerit nisi. Vestibulum eget risus velit. ”',
            'authorName' => 'Savannah Nguyen',
            'authorRole' => 'Executive Chairman',
            'authorImage' => ['url' => $image_base . '/testimonial/testimonial-2.png', 'alt' => 'Savannah Nguyen'],
            'fromLabel' => 'Google',
            'fromLogo' => ['url' => $image_base . '/icon/google-2.png', 'alt' => 'Google'],
        ],
        [
            'id' => 3,
            'quote' => '“ Donec metus lorem, vulputate at sapien sit amet, auctor iaculis lorem. In vel hendrerit nisi. Vestibulum eget risus velit. ”',
            'authorName' => 'Floyd Miles',
            'authorRole' => 'Executive Chairman',
            'authorImage' => ['url' => $image_base . '/testimonial/testimonial-3.png', 'alt' => 'Floyd Miles'],
            'fromLabel' => 'Facebook',
            'fromLogo' => ['url' => $image_base . '/icon/fb-2.png', 'alt' => 'Facebook'],
        ],
    ];
}

$props = [
    'heading' => [
        'text'  => (string) ($heading_data['text']  ?? 'What teams say after shipping with it'),
        'level' => (string) ($heading_data['level'] ?? 'h2'),
    ],
    'subtitle'    => 'Field reports',
    'description' => 'Frontend engineers and editors talking about the editor-frontend parity story and the typed-field workflow.',
    'items'       => $items,
];

$wrap = get_block_wrapper_attributes([
    'class'           => 'section section-padding gcb-saas-testimonials',
    'data-block-name' => 'saas-testimonials',
    'data-props'      => wp_json_encode($props),
]);

$heading_tag = in_array($props['heading']['level'], ['h1','h2','h3','h4','h5','h6'], true)
    ? $props['heading']['level']
    : 'h2';
?>
<div <?php echo $wrap; ?>>
    <div class="container">
        <div class="section-heading heading-left ">
            <div class="subtitle"><?php echo esc_html($props['subtitle']); ?></div>
            <<?php echo esc_attr($heading_tag); ?> class="title">
                <?php echo esc_html($props['heading']['text']); ?>
            </<?php echo esc_attr($heading_tag); ?>>
            <p><?php echo esc_html($props['description']); ?></p>
        </div>
        <div class="row">
            <?php foreach ($props['items'] as $t): ?>
                <div class="col-lg-4">
                    <div class="testimonial-grid">
                        <?php if (!empty($t['fromLogo']['url'])): ?>
                            <span class="social-media">
                                <img src="<?php echo esc_url($t['fromLogo']['url']); ?>" alt="<?php echo esc_attr($t['fromLabel'] ?? ''); ?>" />
                            </span>
                        <?php endif; ?>
                        <p><?php echo esc_html($t['quote']); ?></p>
                        <div class="author-info">
                            <?php if (!empty($t['authorImage']['url'])): ?>
                                <div class="thumb">
                                    <img src="<?php echo esc_url($t['authorImage']['url']); ?>" alt="<?php echo esc_attr($t['authorName']); ?>" />
                                </div>
                            <?php endif; ?>
                            <div class="content">
                                <span class="name"><?php echo esc_html($t['authorName']); ?></span>
                                <span class="designation"><?php echo esc_html($t['authorRole']); ?></span>
                            </div>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
    <ul class="shape-group-4 list-unstyled">
        <li class="shape-1">
            <img src="<?php echo esc_url($image_base); ?>/others/bubble-1.png" alt="" />
        </li>
    </ul>
</div>
