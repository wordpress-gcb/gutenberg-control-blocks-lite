<?php
/**
 * Saas Icon Accordion Item — a single row of the parent accordion.
 *
 * Public-side: collapsed by default; click the title button to expand.
 * Editor side: rendered as a static (always-visible) row so authors can
 * see all items at once while editing.
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

$props = [
    'icon'  => (string) ($attributes['icon']  ?? ''),
    'title' => (string) ($attributes['title'] ?? ''),
    'body'  => (string) ($attributes['body']  ?? ''),
];

$wrap = get_block_wrapper_attributes([
    'class'           => 'gcb-saas-icon-accordion-item',
    'data-block-name' => 'saas-icon-accordion-item',
    'data-props'      => wp_json_encode($props),
]);
?>
<div <?php echo $wrap; ?>>
    <p style="display:flex;align-items:center;gap:0.5rem;margin:0 0 0.5rem;font-weight:600;color:#292930;">
        <?php if ($props['icon']) : ?>
            <span style="display:inline-block;padding:2px 6px;font-size:0.625rem;background:#ECF2F6;border-radius:3px;color:#5956E9;">[<?php echo esc_html($props['icon']); ?>]</span>
        <?php endif; ?>
        <span><?php echo esc_html($props['title']); ?></span>
    </p>
    <?php if ($props['body']) : ?>
        <p style="margin:0;font-size:0.875rem;line-height:1.5;color:#525260;">
            <?php echo esc_html($props['body']); ?>
        </p>
    <?php endif; ?>
</div>
