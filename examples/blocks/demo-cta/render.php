<?php
/**
 * Demo CTA — full-width call-to-action band.
 *
 * @var array $attributes
 */

if (!defined('ABSPATH')) {
    exit;
}

$heading = $attributes['heading'] ?? '';
$body    = $attributes['body']    ?? '';
$link    = is_array($attributes['link'] ?? null) ? $attributes['link'] : [];

$wrap = get_block_wrapper_attributes([
    'class' => 'gcb-demo-cta',
    'style' => 'background:linear-gradient(135deg,#1e40af,#4338ca);color:#fff;padding:4rem 1.5rem;margin:3rem 0;font-family:system-ui,-apple-system,sans-serif;text-align:center;',
]);
?>
<section <?php echo $wrap; ?>>
    <div style="max-width:42rem;margin:0 auto;">
        <?php if ($heading) : ?>
            <h2 style="font-size:2rem;font-weight:700;margin:0 0 1rem;">
                <?php echo esc_html($heading); ?>
            </h2>
        <?php endif; ?>
        <?php if ($body) : ?>
            <p style="font-size:1.125rem;opacity:0.9;margin:0 0 2rem;">
                <?php echo esc_html($body); ?>
            </p>
        <?php endif; ?>
        <?php if (!empty($link['url'])) :
            $label  = !empty($link['text']) ? $link['text'] : $link['url'];
            $target = !empty($link['opensInNewTab']) ? ' target="_blank" rel="noopener noreferrer"' : '';
        ?>
            <a href="<?php echo esc_url($link['url']); ?>"<?php echo $target; ?>
               style="display:inline-block;padding:0.875rem 2rem;background:#fff;color:#1e40af;text-decoration:none;border-radius:0.375rem;font-weight:600;">
                <?php echo esc_html($label); ?>
            </a>
        <?php endif; ?>
    </div>
</section>
