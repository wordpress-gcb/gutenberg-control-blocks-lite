<?php
/**
 * Saas Section text — heading + body + CTA, designed to live in
 * one column of a two-column grid. Same data-props wrapper pattern
 * as the other saas-* blocks so the React frontend can substitute
 * the polished version.
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

$heading_data = is_array($attributes['heading'] ?? null) ? $attributes['heading'] : [];

$props = [
    'subtitle' => [
        'left'  => (string) ($attributes['subtitle_left']  ?? ''),
        'right' => (string) ($attributes['subtitle_right'] ?? ''),
    ],
    'heading' => [
        'text'  => (string) ($heading_data['text']  ?? ''),
        'level' => (string) ($heading_data['level'] ?? 'h3'),
    ],
    'body' => (string) ($attributes['body'] ?? ''),
    'cta'  => is_array($attributes['cta'] ?? null) ? $attributes['cta'] : null,
];

$wrap = get_block_wrapper_attributes([
    'class'           => 'gcb-saas-section-text',
    'data-block-name' => 'saas-section-text',
    'data-props'      => wp_json_encode($props),
]);

$heading_tag = in_array($props['heading']['level'], ['h2','h3','h4'], true)
    ? $props['heading']['level']
    : 'h3';
?>
<div <?php echo $wrap; ?>>
    <?php if ($props['subtitle']['left'] || $props['subtitle']['right']) : ?>
        <p style="display:inline-flex;gap:0.5rem;margin:0 0 1rem;font-size:0.875rem;text-transform:uppercase;letter-spacing:0.05em;color:#5956E9;font-weight:600;">
            <?php if ($props['subtitle']['left']) : ?>
                <span <?php gcb_focus('subtitle_left'); ?>><?php echo esc_html($props['subtitle']['left']); ?></span>
            <?php endif; ?>
            <?php if ($props['subtitle']['right']) : ?>
                <span <?php gcb_focus('subtitle_right'); ?>><?php echo esc_html($props['subtitle']['right']); ?></span>
            <?php endif; ?>
        </p>
    <?php endif; ?>

    <?php if ($props['heading']['text']) : ?>
        <<?php echo esc_attr($heading_tag); ?> style="font-size:2rem;font-weight:700;line-height:1.2;margin:0 0 1.5rem;" <?php gcb_focus('heading'); ?>>
            <?php echo esc_html($props['heading']['text']); ?>
        </<?php echo esc_attr($heading_tag); ?>>
    <?php endif; ?>

    <?php if ($props['body']) : ?>
        <div style="font-size:1rem;line-height:1.6;color:#525260;margin:0 0 2rem;" <?php gcb_focus('body'); ?>>
            <?php echo wp_kses_post($props['body']); ?>
        </div>
    <?php endif; ?>

    <?php if (!empty($props['cta']['url'])) : ?>
        <p style="margin:0;" <?php gcb_focus('cta'); ?>>
            <a
                href="<?php echo esc_url($props['cta']['url']); ?>"
                target="<?php echo !empty($props['cta']['opensInNewTab']) ? '_blank' : '_self'; ?>"
                rel="<?php echo !empty($props['cta']['opensInNewTab']) ? 'noopener noreferrer' : ''; ?>"
                style="display:inline-block;padding:0.875rem 1.75rem;background:#5956E9;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;"
            ><?php echo esc_html($props['cta']['text'] ?: $props['cta']['url']); ?></a>
        </p>
    <?php endif; ?>
</div>
