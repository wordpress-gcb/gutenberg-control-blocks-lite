<?php
/**
 * Layout — boxes on a grid, arranged by hand (Mark, 2026-10-09: "a plain module that you can use to create these kind
 * of shapes with inner content so you can have what you want in them … a game changer"). The boxes are the block's
 * children (gcb/layout-box, each holding any blocks); the layout field places them — the same board a list's cards
 * are placed with, in list mode: a box for every child, a click on an empty cell adds one. On the page the field's
 * CSS (Contract\Fields::layout_css) places each child by its order; nothing stored is the drawn columns, even.
 *
 * A PERSON'S BLOCK, NOT THE AI'S: the AI draws blocks, people arrange them. It is not in the register the chat
 * reads, and nothing the AI builds reaches for it.
 *
 * @var array    $attributes
 * @var string   $content
 * @var WP_Block $block
 */

if (!defined('ABSPATH')) {
    exit;
}

$gap   = isset($attributes['gap']) && is_numeric($attributes['gap']) ? max(0, min(96, (int) $attributes['gap'])) : 24;
$count = isset($block) && is_object($block) && isset($block->inner_blocks) && (is_array($block->inner_blocks) || $block->inner_blocks instanceof \Countable)
    ? count($block->inner_blocks)
    : 0;
$id    = 'l' . substr(md5(uniqid('', true)), 0, 8);
$css   = class_exists('\GCBLite\Contract\Fields')
    ? \GCBLite\Contract\Fields::layout_css(
        $attributes['layout'] ?? null,
        ['cols' => 3, 'minCols' => 1, 'maxCols' => 12, 'minItemPx' => 200, 'containerPx' => 1200, 'gapPx' => $gap],
        max(1, $count),
        '.gcb-layout-' . $id,
        '.gcb-layout-' . $id . ' > :nth-child(%d)'
    )
    : '';
$cols  = 3;
if (is_array($attributes['layout'] ?? null) && (int) ($attributes['layout']['cols'] ?? 0) >= 1) {
    $cols = (int) $attributes['layout']['cols'];
}

$wrap = get_block_wrapper_attributes([
    'class' => 'gcb-layout gcb-layout-' . $id,
    'style' => '--gcb-layout-cols:' . $cols . ';--gcb-layout-gap:' . $gap . 'px',
]);
?>
<div <?php echo $wrap; ?>>
	<Repeater
		allowedBlocks='["gcb/layout-box"]'
		addButtonLabel="Add box"
		min="1"
		max="48"
		template='[["gcb/layout-box"],["gcb/layout-box"],["gcb/layout-box"]]'
		editLayout="grid"
	/>
	<?php /* inside the root, last: one root element, so the editor promotes it to the block's wrapper (two top-level
	   nodes nest the grid inside the wrapper's grid — found 2026-10-09); a <style> is no box, and comes after every box */ ?>
	<?php if ($css !== '') : ?><style><?php echo $css; ?></style><?php endif; ?>
</div>
