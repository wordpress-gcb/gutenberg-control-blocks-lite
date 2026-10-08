<?php
/**
 * Tabs — a strip of tabs over panels a person fills with any blocks (Mark, 2026-10-09: "include some default blocks as
 * well like the grid block"). The panels are the block's children (gcb/tab, each with a title); the strip is printed
 * here from those children, so the page has it with no script; the block's own small script makes it a real tablist
 * (one panel at a time, arrow keys). With no script, or on a phone set to stack, every panel shows under its title.
 *
 * @var array    $attributes
 * @var string   $content
 * @var WP_Block $block
 */

if (!defined('ABSPATH')) {
    exit;
}

$phone  = isset($attributes['phone']) && $attributes['phone'] === 'tabs' ? 'tabs' : 'stack';
$titles = [];
if (isset($block) && is_object($block) && isset($block->inner_blocks)) {
    foreach ($block->inner_blocks as $child) {
        $a        = is_object($child) && isset($child->attributes) ? (array) $child->attributes : [];
        $titles[] = trim((string) ($a['title'] ?? ''));
    }
}
$id   = 't' . substr(md5(uniqid('', true)), 0, 8);
$wrap = get_block_wrapper_attributes([
    'class'         => 'gcb-tabs gcb-tabs--phone-' . $phone,
    'data-gcb-tabs' => $id,
]);
?>
<div <?php echo $wrap; ?>>
	<?php if ($titles) : ?>
	<div class="gcb-tabs__list" role="tablist">
		<?php foreach ($titles as $i => $t) : ?>
		<button type="button" class="gcb-tabs__tab" role="tab" id="<?php echo esc_attr($id . '-tab-' . $i); ?>" aria-controls="<?php echo esc_attr($id . '-panel-' . $i); ?>" aria-selected="<?php echo $i === 0 ? 'true' : 'false'; ?>" tabindex="<?php echo $i === 0 ? '0' : '-1'; ?>"><?php echo esc_html($t !== '' ? $t : sprintf(__('Tab %d', 'gcblite'), $i + 1)); ?></button>
		<?php endforeach; ?>
	</div>
	<?php endif; ?>
	<div class="gcb-tabs__panels">
		<Repeater
			allowedBlocks='["gcb/tab"]'
			addButtonLabel="Add tab"
			min="1"
			max="12"
			template='[["gcb/tab",{"title":"First"}],["gcb/tab",{"title":"Second"}],["gcb/tab",{"title":"Third"}]]'
			editLayout="tabs"
		/>
	</div>
</div>
