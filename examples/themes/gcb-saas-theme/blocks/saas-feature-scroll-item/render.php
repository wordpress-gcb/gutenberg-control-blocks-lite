<?php
/**
 * Saas Feature Scroll Item — one feature in the scroll-pin tour.
 *
 * Renders the LEFT column: title + InnerBlocks body. The image authored
 * on this item is shown:
 *
 *   - In the editor preview (gcb_is_editor_preview): rendered inline
 *     here, beside the copy, so authors can see + click to focus the
 *     image control. The parent's sticky stage is suppressed via the
 *     `is-editor-preview` modifier (see render.php on the parent).
 *
 *   - On the public frontend: NOT rendered here. The parent block's
 *     sticky stage owns the visible image — duplicating it inline
 *     would be confusing.
 *
 * Why this fork: the editor canvas can't replicate the scroll-pin
 * behaviour faithfully (canvas is a constrained iframe with its own
 * scroll container), so the swap-on-scroll effect just doesn't read.
 * Per-item inline images give the author something they can actually
 * see + click without scrolling around hunting for the right image.
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

$image = is_array($attributes['image'] ?? null) ? $attributes['image'] : [];
$title = (string) ($attributes['title'] ?? '');

$image_url = (string) ($image['url'] ?? '');
$image_alt = (string) ($image['alt'] ?? $title);

$ext      = strtolower(pathinfo(parse_url($image_url, PHP_URL_PATH) ?: '', PATHINFO_EXTENSION));
$is_video = in_array($ext, ['mp4', 'webm', 'mov', 'm4v', 'ogv'], true);

$props = [
    'title' => $title,
    'image' => [
        'url'     => $image_url,
        'alt'     => $image_alt,
        'isVideo' => $is_video,
    ],
];

$is_editor = gcb_is_editor_preview();

$wrap = get_block_wrapper_attributes([
    'class'           => 'gcb-feature-scroll__item' . ($is_editor ? ' is-editor-preview' : ''),
    'data-block-name' => 'saas-feature-scroll-item',
    'data-props'      => wp_json_encode($props),
    'data-image-url'  => $image_url,
]);

$body_template = wp_json_encode([
    ['core/paragraph', ['content' => 'Describe this feature in one or two sentences. Author can edit this paragraph inline — it\'s a normal Gutenberg paragraph block.']],
]);
$body_allowed = wp_json_encode([
    'core/paragraph', 'core/heading', 'core/list', 'core/buttons',
]);
?>
<div <?php echo $wrap; ?>>
    <div class="gcb-feature-scroll__item-copy">
        <h3 class="gcb-feature-scroll__item-title" <?php gcb_focus('title'); ?>>
            <?php echo esc_html($title); ?>
        </h3>
        <div class="gcb-feature-scroll__item-body">
            <innerblocks
                allowedblocks='<?php echo esc_attr($body_allowed); ?>'
                template='<?php echo esc_attr($body_template); ?>'
            ></innerblocks>
        </div>
    </div>

    <?php if ($is_editor) : ?>
        <div class="gcb-feature-scroll__item-media" <?php gcb_focus('image'); ?>>
            <?php if ($image_url) : ?>
                <?php if ($is_video) : ?>
                    <video
                        src="<?php echo esc_url($image_url); ?>"
                        autoplay muted loop playsinline preload="metadata"
                        aria-label="<?php echo esc_attr($image_alt); ?>"
                    ></video>
                <?php else : ?>
                    <img src="<?php echo esc_url($image_url); ?>" alt="<?php echo esc_attr($image_alt); ?>" />
                <?php endif; ?>
            <?php else : ?>
                <div class="gcb-feature-scroll__item-media-placeholder">
                    <?php esc_html_e('Pick an image or GIF for this feature.', 'gcb-saas-theme'); ?>
                </div>
            <?php endif; ?>
        </div>
    <?php endif; ?>
</div>
