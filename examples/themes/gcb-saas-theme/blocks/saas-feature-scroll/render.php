<?php
/**
 * Saas Feature Scroll — sticky-image feature tour.
 *
 * Layout: two columns inside .gcb-feature-scroll__layout (CSS grid).
 *   - Left: rail of items, each one title + InnerBlocks body. Items are
 *     rendered via the standard <repeater> → InnerBlocks pipeline so
 *     authors can add / remove / reorder in the canvas.
 *   - Right: a SINGLE sticky stage that holds every item's image
 *     stacked on top of each other. Position:sticky lives in pure CSS
 *     so the scroll behaviour works identically on the React frontend
 *     AND in the editor canvas / no-JS PHP render. The first image is
 *     active by default; React's only job after hydration is to swap
 *     which image has .is-active as the user scrolls.
 *
 * Image URLs in the sticky stage come from the parent walking
 * $block->parsed_block['innerBlocks'] — there's no live re-render when
 * the author adds an item in the canvas (the static markup wouldn't see
 * it until save+reload), but that's fine: sticky cross-fade doesn't
 * need to be live for authoring.
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

$heading_data = is_array($attributes['heading'] ?? null) ? $attributes['heading'] : [];

// Walk inner blocks once. Used for both the React data-props payload AND
// the PHP-side sticky stage on the right column below.
$inner_items = [];
if (isset($block->parsed_block['innerBlocks']) && is_array($block->parsed_block['innerBlocks'])) {
    foreach ($block->parsed_block['innerBlocks'] as $child) {
        if (($child['blockName'] ?? '') !== 'gcb/saas-feature-scroll-item') continue;
        $attrs = is_array($child['attrs'] ?? null) ? $child['attrs'] : [];
        $inner_items[] = [
            'blockName' => $child['blockName'],
            'attrs'     => $attrs,
        ];
    }
}

$props = [
    'eyebrow' => (string) ($attributes['eyebrow'] ?? ''),
    'heading' => [
        'text'  => (string) ($heading_data['text']  ?? ''),
        'level' => (string) ($heading_data['level'] ?? 'h2'),
    ],
    'intro'       => (string) ($attributes['intro'] ?? ''),
    'innerBlocks' => $inner_items,
];

$wrap = get_block_wrapper_attributes([
    'class'           => 'section section-padding gcb-saas-feature-scroll',
    'data-block-name' => 'saas-feature-scroll',
    'data-props'      => wp_json_encode($props),
]);

$heading_tag = in_array($props['heading']['level'], ['h2','h3'], true)
    ? $props['heading']['level']
    : 'h2';

$video_exts = ['mp4', 'webm', 'mov', 'm4v', 'ogv'];
$is_editor  = gcb_is_editor_preview();

// In the editor preview each item renders its own inline image (see
// the item's render.php). The sticky stage stays off so authors don't
// see a duplicated image floating beside the canvas while editing —
// the scroll choreography can't be replicated faithfully inside the
// editor iframe anyway.
//
// On the public PHP frontend the sticky stage IS rendered: it's the
// no-JS baseline (first image shown, no swap). On the React frontend
// SaasFeatureScroll.jsx renders the same structure plus swaps which
// image has .is-active as the user scrolls.
?>
<div <?php echo $wrap; ?>>
    <div class="container">
        <?php if ($props['eyebrow'] || $props['heading']['text'] || $props['intro']) : ?>
            <div class="section-heading heading-left mb--60">
                <?php if ($props['eyebrow']) : ?>
                    <span class="subtitle" <?php gcb_focus('eyebrow'); ?>>
                        <?php echo esc_html($props['eyebrow']); ?>
                    </span>
                <?php endif; ?>
                <?php if ($props['heading']['text']) : ?>
                    <<?php echo esc_attr($heading_tag); ?> class="title" <?php gcb_focus('heading'); ?>>
                        <?php echo esc_html($props['heading']['text']); ?>
                    </<?php echo esc_attr($heading_tag); ?>>
                <?php endif; ?>
                <?php if ($props['intro']) : ?>
                    <p <?php gcb_focus('intro'); ?>>
                        <?php echo esc_html($props['intro']); ?>
                    </p>
                <?php endif; ?>
            </div>
        <?php endif; ?>

        <div class="gcb-feature-scroll__layout<?php echo $is_editor ? ' is-editor-preview' : ''; ?>">
            <div class="gcb-feature-scroll__rail">
                <repeater
                    allowedblocks='["gcb/saas-feature-scroll-item"]'
                    addbuttonlabel="Add feature"
                ></repeater>
            </div>

            <?php if (!$is_editor) : ?>
                <div class="gcb-feature-scroll__stage" aria-hidden="true">
                    <?php foreach ($inner_items as $idx => $item):
                        $image     = is_array($item['attrs']['image'] ?? null) ? $item['attrs']['image'] : [];
                        $image_url = (string) ($image['url'] ?? '');
                        if (!$image_url) continue;
                        $image_alt = (string) ($image['alt'] ?? '');
                        $ext       = strtolower(pathinfo(parse_url($image_url, PHP_URL_PATH) ?: '', PATHINFO_EXTENSION));
                        $is_video  = in_array($ext, $video_exts, true);
                        $active    = $idx === 0 ? ' is-active' : '';
                    ?>
                        <?php if ($is_video) : ?>
                            <video
                                class="gcb-feature-scroll__stage-frame<?php echo esc_attr($active); ?>"
                                src="<?php echo esc_url($image_url); ?>"
                                autoplay muted loop playsinline preload="auto"
                                aria-label="<?php echo esc_attr($image_alt); ?>"
                            ></video>
                        <?php else : ?>
                            <img
                                class="gcb-feature-scroll__stage-frame<?php echo esc_attr($active); ?>"
                                src="<?php echo esc_url($image_url); ?>"
                                alt="<?php echo esc_attr($image_alt); ?>"
                            />
                        <?php endif; ?>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>
    </div>
</div>
