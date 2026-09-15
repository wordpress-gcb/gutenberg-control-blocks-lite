<?php
/**
 * Icon list item — one <li>: registry icon + richtext.
 *
 * The icon field stores { source: 'wp', name: 'core/foo' }; only the name
 * is persisted — the SVG is resolved server-side at render time so
 * post_content stays small and registry updates propagate. Resolution
 * prefers wp_get_icon() (WP 7.1+, handles size/class/a11y attributes) and
 * falls back to WP_Icons_Registry directly on WP 7.0.
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

$icon_value = $attributes['icon'] ?? null;
$icon_name  = '';
if (is_array($icon_value)) {
    $icon_name = (string) ($icon_value['name'] ?? '');
} elseif (is_string($icon_value)) {
    $icon_name = $icon_value;
}

$svg = '';
if ($icon_name) {
    if (function_exists('wp_get_icon')) {
        $svg = wp_get_icon($icon_name, ['size' => null]);
    } elseif (class_exists('WP_Icons_Registry')) {
        $icon = \WP_Icons_Registry::get_instance()->get_registered_icon($icon_name);
        if ($icon && !empty($icon['content'])) {
            $svg = (string) $icon['content'];
        }
    }
}

$text = (string) ($attributes['text'] ?? '');

$wrap = get_block_wrapper_attributes([
    'class' => 'gcb-icon-list-item',
]);
?>
<li <?php echo $wrap; ?>>
    <?php if ($svg) : ?>
        <?php // SVG comes from the trusted server-side registry, not author
              // input — wp_kses_post would strip the svg namespace/viewbox,
              // so emit directly (same pattern as field-showcase). ?>
        <span class="gcb-icon-list-item__icon" <?php gcb_focus('icon'); ?>><?php echo $svg; ?></span>
    <?php elseif ($icon_name) : ?>
        <span class="gcb-icon-list-item__icon" <?php gcb_focus('icon'); ?> aria-hidden="true">•</span>
    <?php endif; ?>
    <span class="gcb-icon-list-item__text" <?php gcb_focus('text'); ?>><?php echo wp_kses_post($text); ?></span>
</li>
