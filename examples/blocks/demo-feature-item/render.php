<?php
/**
 * Demo Feature Item — single card inside Demo: Feature Trio.
 *
 * @var array $attributes
 */

if (!defined('ABSPATH')) {
    exit;
}

$title = $attributes['title'] ?? '';
$body  = $attributes['body']  ?? '';

$wrap = get_block_wrapper_attributes([
    'class' => 'gcb-demo-feature-item',
    'style' => 'background:#fff;border:1px solid #e5e5e5;border-radius:0.75rem;padding:1.5rem;font-family:system-ui,-apple-system,sans-serif;',
]);
?>
<div <?php echo $wrap; ?>>
    <h3 style="font-size:1.25rem;font-weight:600;color:#171717;margin:0 0 0.5rem;">
        <?php echo $title ? esc_html($title) : '<span style="color:#a3a3a3;font-style:italic;">Untitled feature</span>'; ?>
    </h3>
    <?php if ($body) : ?>
        <p style="color:#525252;line-height:1.6;margin:0;">
            <?php echo esc_html($body); ?>
        </p>
    <?php endif; ?>
</div>
