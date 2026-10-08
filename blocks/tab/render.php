<?php
/**
 * Tab — one panel of a Tabs block (blocks/tabs): its title is on the strip the Tabs block prints; any blocks inside.
 * The title is printed in the panel too, shown only when the panels stack (a phone, no script).
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

$title = trim((string) ($attributes['title'] ?? ''));
$wrap  = get_block_wrapper_attributes([
    'class' => 'gcb-tabs__panel',
    'role'  => 'tabpanel',
]);
?>
<div <?php echo $wrap; ?>>
	<p class="gcb-tabs__panel-title" <?php gcb_focus('title'); ?>><?php echo esc_html($title !== '' ? $title : __('Tab', 'gcblite')); ?></p>
	<InnerBlocks template='[["core/paragraph",{"placeholder":"Anything goes in a tab: words, pictures, a block of yours."}]]' />
</div>
