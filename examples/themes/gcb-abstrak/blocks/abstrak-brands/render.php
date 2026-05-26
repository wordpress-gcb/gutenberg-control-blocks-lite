<?php
/**
 * Abstrak Brands strip — horizontal logo row.
 *
 * Brand shape:
 *   { id, name, logo: { url, alt } | null, website: { url, text, opensInNewTab } | null }
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
$posts = Collection::query($attributes, 'brand', ['default_count' => 6, 'max_count' => 24]);

$items = array_map(static function (\WP_Post $p) {
    $logo    = get_post_meta($p->ID, 'logo',    true);
    $website = get_post_meta($p->ID, 'website', true);
    return [
        'id'      => $p->ID,
        'name'    => get_the_title($p),
        'logo'    => is_array($logo) ? [
            'url' => $logo['url'] ?? '',
            'alt' => $logo['alt'] ?? '',
        ] : null,
        'website' => is_array($website) ? $website : null,
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
    'class'           => 'gcb-abstrak-brands',
    'data-block-name' => 'abstrak-brands',
    'data-props'      => wp_json_encode($props),
]);

$heading_tag = in_array($props['heading']['level'], ['h1','h2','h3','h4','h5','h6','p'], true)
    ? $props['heading']['level']
    : 'h2';
?>
<section <?php echo $wrap; ?>>
    <?php if ($props['heading']['text']) : ?>
        <<?php echo esc_attr($heading_tag); ?> style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#757589;margin:0 0 1.5rem;">
            <?php echo esc_html($props['heading']['text']); ?>
        </<?php echo esc_attr($heading_tag); ?>>
    <?php endif; ?>

    <?php if (empty($items)) : ?>
        <p style="padding:2rem;border:1px dashed #C7C7D5;border-radius:8px;color:#757589;">
            <?php echo esc_html__('No brands yet — add some under Brands in the admin.', 'gcb'); ?>
        </p>
    <?php else : ?>
        <div style="display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:2.5rem;">
            <?php foreach ($items as $brand) : ?>
                <?php if (!empty($brand['logo']['url'])) : ?>
                    <?php if (!empty($brand['website']['url'])) : ?>
                        <a href="<?php echo esc_url($brand['website']['url']); ?>" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;">
                            <img src="<?php echo esc_url($brand['logo']['url']); ?>" alt="<?php echo esc_attr($brand['logo']['alt'] ?: $brand['name']); ?>" style="max-height:36px;width:auto;opacity:0.6;filter:grayscale(100%);" />
                        </a>
                    <?php else : ?>
                        <img src="<?php echo esc_url($brand['logo']['url']); ?>" alt="<?php echo esc_attr($brand['logo']['alt'] ?: $brand['name']); ?>" style="max-height:36px;width:auto;opacity:0.6;filter:grayscale(100%);" />
                    <?php endif; ?>
                <?php endif; ?>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</section>
