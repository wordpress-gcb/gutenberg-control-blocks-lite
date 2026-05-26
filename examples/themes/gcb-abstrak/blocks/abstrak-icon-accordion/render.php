<?php
/**
 * Abstrak Icon Accordion — heading + Repeater of accordion items.
 *
 * Authors add abstrak-icon-accordion-item children via the Repeater UI
 * the editor JS substitutes for the <repeater> marker tag below.
 * Children render via the standard InnerBlocks pipeline.
 *
 * The React frontend reads data-block-name + data-props for the heading
 * shell, then the BlockRenderer recurses into innerBlocks to render
 * each item via the AbstrakIconAccordionItem component.
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

$heading_data = is_array($attributes['heading'] ?? null) ? $attributes['heading'] : [];

// Walk inner blocks and bake their attrs into the parent's data-props.
// The React accordion owns open/close state across items, so the parent
// needs to render all children itself — hydrating each child wrapper
// independently would give us 5 independent toggles instead of one
// single-open accordion.
//
// $block->parsed_block is the parser tree node — see WP_Block::__construct.
$inner_items = [];
if (isset($block->parsed_block['innerBlocks']) && is_array($block->parsed_block['innerBlocks'])) {
    foreach ($block->parsed_block['innerBlocks'] as $child) {
        if (($child['blockName'] ?? '') !== 'gcb/abstrak-icon-accordion-item') continue;
        $attrs = is_array($child['attrs'] ?? null) ? $child['attrs'] : [];
        $inner_items[] = [
            'blockName' => $child['blockName'],
            'attrs'     => $attrs,
        ];
    }
}

$props = [
    'heading' => [
        'text'  => (string) ($heading_data['text']  ?? ''),
        'level' => (string) ($heading_data['level'] ?? 'h3'),
    ],
    'intro'       => (string) ($attributes['intro'] ?? ''),
    'innerBlocks' => $inner_items,
];

$wrap = get_block_wrapper_attributes([
    'class'           => 'gcb-abstrak-icon-accordion',
    'data-block-name' => 'abstrak-icon-accordion',
    'data-props'      => wp_json_encode($props),
]);

$heading_tag = in_array($props['heading']['level'], ['h2','h3','h4'], true)
    ? $props['heading']['level']
    : 'h3';
?>
<div <?php echo $wrap; ?>>
    <?php if ($props['heading']['text']) : ?>
        <<?php echo esc_attr($heading_tag); ?> style="font-size:1.75rem;font-weight:700;line-height:1.2;margin:0 0 0.75rem;">
            <?php echo esc_html($props['heading']['text']); ?>
        </<?php echo esc_attr($heading_tag); ?>>
    <?php endif; ?>

    <?php if ($props['intro']) : ?>
        <p style="font-size:1rem;line-height:1.6;color:#525260;margin:0 0 1.5rem;">
            <?php echo esc_html($props['intro']); ?>
        </p>
    <?php endif; ?>

    <div style="display:flex;flex-direction:column;gap:0.75rem;">
        <repeater allowedblocks='["gcb/abstrak-icon-accordion-item"]' addbuttonlabel="Add item">
        </repeater>
    </div>
</div>
