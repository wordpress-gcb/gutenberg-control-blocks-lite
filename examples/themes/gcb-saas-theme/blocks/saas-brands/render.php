<?php
/**
 * Saas Brands strip — logo wall.
 *
 * Mirrors SaasBrandsView.jsx markup.
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
$posts = Collection::query($attributes, 'brand', ['default_count' => 6, 'max_count' => 24]);

$image_base = get_stylesheet_directory_uri() . '/assets/images';

$items = array_map(static function (\WP_Post $p) {
    $logo    = get_post_meta($p->ID, 'logo',    true);
    $website = get_post_meta($p->ID, 'website', true);
    return [
        'id'      => $p->ID,
        'name'    => get_the_title($p),
        'image'   => is_array($logo) ? ($logo['url'] ?? '') : '',
        'website' => is_array($website) ? $website : null,
    ];
}, $posts);

// Sample fallback when CPT is empty.
if (empty($items)) {
    $items = array_map(static function ($i) use ($image_base) {
        return [
            'id'    => $i,
            'name'  => 'Brand ' . $i,
            'image' => $image_base . '/brand/brand-' . $i . '.png',
            'website' => null,
        ];
    }, range(1, 8));
}

$props = [
    'heading' => [
        'text'  => (string) ($heading_data['text']  ?? 'Used by teams building with GCB.'),
        'level' => (string) ($heading_data['level'] ?? 'h2'),
    ],
    'subtitle'    => 'In production',
    'description' => 'Marketing sites, SaaS dashboards, editorial publications — all rendering from the same typed Gutenberg blocks.',
    'items'       => $items,
];

$wrap = get_block_wrapper_attributes([
    'class'           => 'section section-padding-2 bg-color-dark gcb-saas-brands',
    'data-block-name' => 'saas-brands',
    'data-props'      => wp_json_encode($props),
]);

$heading_tag = in_array($props['heading']['level'], ['h1','h2','h3','h4','h5','h6'], true)
    ? $props['heading']['level']
    : 'h2';
?>
<div <?php echo $wrap; ?>>
    <div class="container">
        <div class="section-heading heading-light-left ">
            <div class="subtitle"><?php echo esc_html($props['subtitle']); ?></div>
            <<?php echo esc_attr($heading_tag); ?> class="title">
                <?php echo esc_html($props['heading']['text']); ?>
            </<?php echo esc_attr($heading_tag); ?>>
            <p><?php echo esc_html($props['description']); ?></p>
        </div>
        <div class="row">
            <?php foreach ($props['items'] as $brand):
                if (empty($brand['image'])) continue;
                $logo_img = '<div class="brand-grid"><img src="' . esc_url($brand['image']) . '" alt="' . esc_attr($brand['name']) . '" /></div>';
            ?>
                <div class="col-lg-3 col-6">
                    <?php if (!empty($brand['website']['url'])):
                        $target = !empty($brand['website']['opensInNewTab']) ? ' target="_blank" rel="noopener noreferrer"' : '';
                    ?>
                        <a href="<?php echo esc_url($brand['website']['url']); ?>"<?php echo $target; ?>>
                            <?php echo $logo_img; ?>
                        </a>
                    <?php else: ?>
                        <?php echo $logo_img; ?>
                    <?php endif; ?>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
    <ul class="list-unstyled shape-group-10">
        <li class="shape shape-1">
            <img src="<?php echo esc_url($image_base); ?>/others/line-9.png" alt="Circle" />
        </li>
    </ul>
</div>
