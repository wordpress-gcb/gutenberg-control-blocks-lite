<?php
/**
 * Abstrak Banner — hero section.
 *
 * Dual-purpose render:
 *   1. Server-side preview (editor + raw WP) — text content visible, no
 *      glamour. Authors see what they typed.
 *   2. Headless React frontend hydration — the `data-block-name` +
 *      `data-props` attributes on the wrapper let the React frontend
 *      recognise the block and substitute the polished component.
 *
 * data-props is a JSON-encoded copy of the resolved block data. The
 * React side reads it instead of making a second REST call per block
 * — saves a round-trip and means the SSR'd HTML is the source of
 * truth for the props.
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

$heading_data = is_array($attributes['heading'] ?? null) ? $attributes['heading'] : [];

$props = [
    'eyebrow'      => (string) ($attributes['eyebrow'] ?? ''),
    'heading'      => [
        'text'  => (string) ($heading_data['text']  ?? ''),
        'level' => (string) ($heading_data['level'] ?? 'h1'),
    ],
    'body'         => (string) ($attributes['body'] ?? ''),
    'primaryCta'   => is_array($attributes['primary_cta']   ?? null) ? $attributes['primary_cta']   : null,
    'secondaryCta' => is_array($attributes['secondary_cta'] ?? null) ? $attributes['secondary_cta'] : null,
    'image'        => is_array($attributes['image'] ?? null) ? $attributes['image'] : null,
];

$wrap = get_block_wrapper_attributes([
    'class'           => 'gcb-abstrak-banner',
    'data-block-name' => 'abstrak-banner',
    'data-props'      => wp_json_encode($props),
]);

$heading_tag = in_array($props['heading']['level'], ['h1','h2','h3','h4','h5','h6'], true)
    ? $props['heading']['level']
    : 'h1';
?>
<section <?php echo $wrap; ?>>
    <?php if ($props['eyebrow']) : ?>
        <p style="font-size:0.875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#5956E9;margin:0 0 0.75rem;">
            <?php echo esc_html($props['eyebrow']); ?>
        </p>
    <?php endif; ?>

    <?php if ($props['heading']['text']) : ?>
        <<?php echo esc_attr($heading_tag); ?> style="font-size:clamp(2rem,5vw,3.5rem);font-weight:700;line-height:1.1;margin:0 0 1rem;">
            <?php echo esc_html($props['heading']['text']); ?>
        </<?php echo esc_attr($heading_tag); ?>>
    <?php endif; ?>

    <?php if ($props['body']) : ?>
        <p style="font-size:1.125rem;line-height:1.6;color:#525260;max-width:38rem;margin:0 0 1.5rem;">
            <?php echo esc_html($props['body']); ?>
        </p>
    <?php endif; ?>

    <?php if (!empty($props['primaryCta']['url'])) : ?>
        <p>
            <a
                href="<?php echo esc_url($props['primaryCta']['url']); ?>"
                target="<?php echo !empty($props['primaryCta']['opensInNewTab']) ? '_blank' : '_self'; ?>"
                rel="<?php echo !empty($props['primaryCta']['opensInNewTab']) ? 'noopener noreferrer' : ''; ?>"
                style="display:inline-block;padding:0.875rem 1.75rem;background:#5956E9;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;"
            ><?php echo esc_html($props['primaryCta']['text'] ?: $props['primaryCta']['url']); ?></a>
        </p>
    <?php endif; ?>

    <?php if (!empty($props['image']['url'])) : ?>
        <p>
            <img
                src="<?php echo esc_url($props['image']['url']); ?>"
                alt="<?php echo esc_attr($props['image']['alt'] ?? ''); ?>"
                style="max-width:100%;height:auto;margin-top:2rem;border-radius:12px;"
            />
        </p>
    <?php endif; ?>
</section>
