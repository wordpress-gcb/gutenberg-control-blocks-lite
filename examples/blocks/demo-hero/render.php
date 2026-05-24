<?php
/**
 * Demo Hero — bundled with the plugin for showcases (Playground, etc.).
 *
 * Inline styles on purpose: the plugin doesn't bundle a stylesheet, and
 * we want these demo blocks to render reasonably with zero setup.
 *
 * @var array  $attributes  block attributes
 * @var string $content     inner-block content (unused here)
 */

if (!defined('ABSPATH')) {
    exit;
}

$eyebrow = $attributes['eyebrow'] ?? '';
$heading = $attributes['heading'] ?? '';
$body    = $attributes['body']    ?? '';
$cta     = is_array($attributes['cta'] ?? null) ? $attributes['cta'] : [];

$wrap = get_block_wrapper_attributes([
    'class' => 'gcb-demo-hero',
    'style' => 'max-width:48rem;margin:4rem auto;padding:0 1.5rem;font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;',
]);
?>
<section <?php echo $wrap; ?>>
    <?php if ($eyebrow) : ?>
        <p style="font-size:0.875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#2563eb;margin:0 0 0.75rem;">
            <?php echo esc_html($eyebrow); ?>
        </p>
    <?php endif; ?>
    <?php if ($heading) : ?>
        <h1 style="font-size:2.5rem;font-weight:700;line-height:1.1;margin:0 0 1.5rem;">
            <?php echo esc_html($heading); ?>
        </h1>
    <?php endif; ?>
    <?php if ($body) : ?>
        <p style="font-size:1.125rem;line-height:1.6;color:#404040;margin:0 0 2rem;">
            <?php echo esc_html($body); ?>
        </p>
    <?php endif; ?>
    <?php if (!empty($cta['url'])) :
        $label  = !empty($cta['text']) ? $cta['text'] : $cta['url'];
        $target = !empty($cta['opensInNewTab']) ? ' target="_blank" rel="noopener noreferrer"' : '';
    ?>
        <a href="<?php echo esc_url($cta['url']); ?>"<?php echo $target; ?>
           style="display:inline-block;padding:0.75rem 1.5rem;background:#2563eb;color:#fff;text-decoration:none;border-radius:0.375rem;font-weight:500;">
            <?php echo esc_html($label); ?>
        </a>
    <?php endif; ?>
</section>
