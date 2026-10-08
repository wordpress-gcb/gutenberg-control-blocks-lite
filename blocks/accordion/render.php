<?php
/**
 * Accordion — rows that open and close, each a title over any blocks (Mark, 2026-10-09: "include some default blocks
 * as well like the grid block"). The rows are the block's children (gcb/accordion-item); the block's own small script
 * opens and closes them (one at a time when set). With no script every row shows open; in the editor too.
 *
 * @var array    $attributes
 * @var string   $content
 * @var WP_Block $block
 */

if (!defined('ABSPATH')) {
    exit;
}

$single = !array_key_exists('single', $attributes) || !empty($attributes['single']);
$first  = !empty($attributes['firstOpen']);
$wrap   = get_block_wrapper_attributes([
    'class'              => 'gcb-accordion',
    'data-gcb-accordion' => '',
    'data-single'        => $single ? '1' : '0',
    'data-first-open'    => $first ? '1' : '0',
]);
?>
<div <?php echo $wrap; ?>>
	<Repeater
		allowedBlocks='["gcb/accordion-item"]'
		addButtonLabel="Add row"
		min="1"
		max="40"
		template='[["gcb/accordion-item",{"title":"First question"}],["gcb/accordion-item",{"title":"Second question"}],["gcb/accordion-item",{"title":"Third question"}]]'
		editLayout="accordion"
	/>
</div>
