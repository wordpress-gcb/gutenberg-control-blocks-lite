<?php
/**
 * Row — one row of an Accordion (blocks/accordion): a title that opens any blocks beneath it. Open until the block's
 * script says otherwise (so the editor and a page with no script show everything).
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

$title = trim((string) ($attributes['title'] ?? ''));
$wrap  = get_block_wrapper_attributes([
    'class' => 'gcb-accordion__item',
]);
?>
<div <?php echo $wrap; ?>>
	<button type="button" class="gcb-accordion__head" aria-expanded="true">
		<span class="gcb-accordion__title" <?php gcb_focus('title'); ?>><?php echo esc_html($title !== '' ? $title : __('Row', 'gcblite')); ?></span>
		<span class="gcb-accordion__mark" aria-hidden="true"></span>
	</button>
	<div class="gcb-accordion__body">
		<InnerBlocks template='[["core/paragraph",{"placeholder":"The answer, or anything: words, pictures, a block of yours."}]]' />
	</div>
</div>
