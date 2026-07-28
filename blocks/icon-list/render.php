<?php
/**
 * Icon list — a <ul>/<ol> of icon-list-item children.
 *
 * Editing is native (see src/blocks/icon-list/edit.js): the editor renders
 * real InnerBlocks with core/list-style Enter grammar, NOT the generic
 * PHP-preview + repeater pipeline. This template is the FRONT END only;
 * the <InnerBlocks /> marker is swapped for the rendered children by
 * InnerBlocksReplacer.
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

$ordered = !empty($attributes['ordered']);
$gap     = $attributes['gap'] ?? 0.5;
$gap     = is_numeric($gap) ? max(0, min(2, (float) $gap)) : 0.5;
$tag     = $ordered ? 'ol' : 'ul';

$wrap = get_block_wrapper_attributes([
    'class' => 'gcb-icon-list',
    'style' => '--gcb-icon-list-gap:' . $gap . 'em',
]);
?>
<<?php echo $tag; ?> <?php echo $wrap; ?>>
    <InnerBlocks />
</<?php echo $tag; ?>>
