<?php
/**
 * Demo Feature Trio — parent for demo-feature-item children.
 *
 * Uses the <Repeater> marker pattern: the editor swaps it for an
 * InnerBlocks UI; the frontend swaps it for the rendered children
 * (gcb-lite's InnerBlocksReplacer handles both directions).
 *
 * @var array  $attributes
 * @var string $content   pre-rendered inner blocks (substituted into <Repeater>)
 */

if (!defined('ABSPATH')) {
    exit;
}

$heading = $attributes['heading'] ?? '';
$intro   = $attributes['intro']   ?? '';

$wrap = get_block_wrapper_attributes([
    'class' => 'gcb-demo-feature-trio',
    'style' => 'max-width:64rem;margin:4rem auto;padding:0 1.5rem;font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;',
]);
?>
<section <?php echo $wrap; ?>>
    <?php if ($heading || $intro) : ?>
        <div style="text-align:center;max-width:36rem;margin:0 auto 3rem;">
            <?php if ($heading) : ?>
                <h2 style="font-size:2rem;font-weight:700;margin:0 0 1rem;">
                    <?php echo esc_html($heading); ?>
                </h2>
            <?php endif; ?>
            <?php if ($intro) : ?>
                <p style="font-size:1.125rem;color:#525252;margin:0;">
                    <?php echo esc_html($intro); ?>
                </p>
            <?php endif; ?>
        </div>
    <?php endif; ?>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:2rem;">
        <Repeater
            allowedBlocks='["gcb/demo-feature-item"]'
            addButtonLabel="Add feature"
            min="1"
            defaultChildren="3"
        />
    </div>
</section>
