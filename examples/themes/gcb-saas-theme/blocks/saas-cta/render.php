<?php
/**
 * Saas CTA — closing call-to-action section. Same dual-purpose
 * render pattern as saas-banner: server-side text preview + data-
 * props island for the React frontend.
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

$heading_data = is_array($attributes['heading'] ?? null) ? $attributes['heading'] : [];

$props = [
    'heading' => [
        'text'  => (string) ($heading_data['text']  ?? ''),
        'level' => (string) ($heading_data['level'] ?? 'h2'),
    ],
    'body' => (string) ($attributes['body'] ?? ''),
    'cta'  => is_array($attributes['cta'] ?? null) ? $attributes['cta'] : null,
];

$wrap = get_block_wrapper_attributes([
    'class'           => 'gcb-saas-cta',
    'data-block-name' => 'saas-cta',
    'data-props'      => wp_json_encode($props),
]);

$heading_tag = in_array($props['heading']['level'], ['h1','h2','h3','h4','h5','h6'], true)
    ? $props['heading']['level']
    : 'h2';
?>
<section <?php echo $wrap; ?>>
    <?php if ($props['heading']['text']) : ?>
        <<?php echo esc_attr($heading_tag); ?> style="font-size:clamp(1.5rem,3vw,2.5rem);font-weight:700;margin:0 0 1rem;">
            <?php echo esc_html($props['heading']['text']); ?>
        </<?php echo esc_attr($heading_tag); ?>>
    <?php endif; ?>

    <?php if ($props['body']) : ?>
        <p style="font-size:1.125rem;opacity:0.85;max-width:32rem;margin:0 auto 2rem;">
            <?php echo esc_html($props['body']); ?>
        </p>
    <?php endif; ?>

    <?php if (!empty($props['cta']['url'])) : ?>
        <p style="margin:0;">
            <a
                href="<?php echo esc_url($props['cta']['url']); ?>"
                target="<?php echo !empty($props['cta']['opensInNewTab']) ? '_blank' : '_self'; ?>"
                rel="<?php echo !empty($props['cta']['opensInNewTab']) ? 'noopener noreferrer' : ''; ?>"
                style="display:inline-block;padding:0.875rem 1.75rem;background:#5956E9;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;"
            ><?php echo esc_html($props['cta']['text'] ?: $props['cta']['url']); ?></a>
        </p>
    <?php endif; ?>
</section>
