<?php
/**
 * Slide — one slide of a Carousel (blocks/carousel): any blocks inside.
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

$inset = isset($attributes['inset']) && is_numeric($attributes['inset']) ? max(0, min(64, (int) $attributes['inset'])) : 0;
$wrap  = get_block_wrapper_attributes([
    'class' => 'gcb-carousel__slide',
    'style' => $inset > 0 ? 'padding:' . $inset . 'px' : '',
    'role'  => 'group',
    'aria-roledescription' => 'slide',
]);
?>
<div <?php echo $wrap; ?>>
	<InnerBlocks template='[["core/paragraph",{"placeholder":"Anything goes on a slide: a picture, words, a block of yours."}]]' />
</div>
