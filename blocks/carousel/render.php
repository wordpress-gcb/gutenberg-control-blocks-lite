<?php
/**
 * Carousel — slides a person fills with any blocks (Mark, 2026-10-09: "include some default blocks as well like the
 * grid block"). The slides are the block's children (gcb/slide); the track is a scroll-snap row the kit's own small
 * script drives (arrows, dots, autoplay) — no library, nothing of gcb-pro's kit, so it works on the free plugin alone.
 *
 * A PERSON'S BLOCK, NOT THE AI'S: like gcb/layout it is not in the register the chat reads.
 *
 * @var array    $attributes
 * @var string   $content
 * @var WP_Block $block
 */

if (!defined('ABSPATH')) {
    exit;
}

$per      = isset($attributes['perView']) && is_numeric($attributes['perView']) ? max(1, min(4, (int) $attributes['perView'])) : 1;
$gap      = isset($attributes['gap']) && is_numeric($attributes['gap']) ? max(0, min(64, (int) $attributes['gap'])) : 24;
$arrows   = !array_key_exists('arrows', $attributes) || !empty($attributes['arrows']);
$dots     = !array_key_exists('dots', $attributes) || !empty($attributes['dots']);
$autoplay = isset($attributes['autoplay']) && is_numeric($attributes['autoplay']) ? max(0, min(15, (int) $attributes['autoplay'])) : 0;

$wrap = get_block_wrapper_attributes([
    'class'              => 'gcb-carousel',
    'style'              => '--gcb-carousel-per:' . $per . ';--gcb-carousel-gap:' . $gap . 'px',
    'data-gcb-carousel'  => '',
    'data-autoplay'      => (string) $autoplay,
]);
?>
<div <?php echo $wrap; ?>>
	<div class="gcb-carousel__track" tabindex="0" aria-roledescription="carousel">
		<Repeater
			allowedBlocks='["gcb/slide"]'
			addButtonLabel="Add slide"
			min="1"
			max="24"
			template='[["gcb/slide"],["gcb/slide"],["gcb/slide"]]'
			editLayout="carousel"
		/>
	</div>
	<?php if ($arrows) : ?>
	<div class="gcb-carousel__arrows">
		<button type="button" class="gcb-carousel__arrow" data-dir="-1" aria-label="<?php esc_attr_e('Previous slide', 'gcblite'); ?>">&#8592;</button>
		<button type="button" class="gcb-carousel__arrow" data-dir="1" aria-label="<?php esc_attr_e('Next slide', 'gcblite'); ?>">&#8594;</button>
	</div>
	<?php endif; ?>
	<?php if ($dots) : ?>
	<div class="gcb-carousel__dots" role="tablist" aria-label="<?php esc_attr_e('Slides', 'gcblite'); ?>"></div>
	<?php endif; ?>
</div>
