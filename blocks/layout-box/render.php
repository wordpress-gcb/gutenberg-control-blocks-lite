<?php
/**
 * Box — one box of a Layout (blocks/layout): any blocks inside. Where it sits and how big it is are the Layout's
 * (its layout field places its children by order).
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

$inset = isset($attributes['inset']) && is_numeric($attributes['inset']) ? max(0, min(64, (int) $attributes['inset'])) : 0;
$wrap  = get_block_wrapper_attributes([
    'class' => 'gcb-layout__box',
    'style' => $inset > 0 ? 'padding:' . $inset . 'px' : '',
]);
?>
<div <?php echo $wrap; ?>>
	<InnerBlocks template='[["core/paragraph",{"placeholder":"Anything goes in a box: words, a picture, a block of yours."}]]' />
</div>
