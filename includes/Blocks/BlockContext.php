<?php
/**
 * WHERE A CHILD STANDS AMONG ITS SIBLINGS (TODO "Parent ↔ child context", 2026-10-07): a repeater's child couldn't know
 * its number, so the Showman's Show kit numbered its cards with CSS counters (01, 02 … 14) that the editor, which
 * renders each child alone, could not match.
 *
 * A block asks the WordPress way — block.json `"usesContext": ["gcb/index", "gcb/count"]` — and reads
 * `$block->context['gcb/index']` (0-based) and `['gcb/count']` (its parent's children) in render.php. On the page they
 * are filled here, through render_block_context; in the editor the preview request carries them (src/index.js →
 * RenderAPI). A parent's own attributes reach a child the same way through core's `providesContext`, in both places.
 *
 * @package GCBLite\Blocks
 */

namespace GCBLite\Blocks;

if (!defined('ABSPATH')) {
    exit;
}

final class BlockContext {

    public const INDEX = 'gcb/index';
    public const COUNT = 'gcb/count';

    /** @var array<int, int> the next child's index, per parent being rendered (spl_object_id) */
    private static $next = [];

    public static function init() {
        add_filter('render_block_context', [__CLASS__, 'for_child'], 10, 3);
    }

    /**
     * WordPress renders a parent's children in order, filtering each one's context first — so the n-th call for a
     * parent is its n-th child. Every child is counted; only one that uses the keys gets them.
     *
     * @param array          $context      The child's context.
     * @param array          $parsed_block The child.
     * @param \WP_Block|null $parent_block The parent (null at the top level).
     */
    public static function for_child($context, $parsed_block, $parent_block) {
        if (!$parent_block instanceof \WP_Block || !is_array($context)) {
            return $context;
        }
        $count = count($parent_block->parsed_block['innerBlocks'] ?? []);
        if ($count === 0) {
            return $context;
        }
        $index = self::take(spl_object_id($parent_block), $count);

        $type = \WP_Block_Type_Registry::get_instance()->get_registered($parsed_block['blockName'] ?? '');
        $uses = $type && is_array($type->uses_context) ? $type->uses_context : [];
        if (in_array(self::INDEX, $uses, true)) {
            $context[self::INDEX] = $index;
        }
        if (in_array(self::COUNT, $uses, true)) {
            $context[self::COUNT] = $count;
        }
        return $context;
    }

    /**
     * The next index for a parent, wrapping after its last child — so a parent rendered twice (or an object id the
     * engine reuses) starts again at 0.
     */
    public static function take($parent_id, $count) {
        $index = self::$next[$parent_id] ?? 0;
        if ($index >= $count) {
            $index = 0;
        }
        self::$next[$parent_id] = $index + 1;
        if (self::$next[$parent_id] >= $count) {
            unset(self::$next[$parent_id]);
        }
        return $index;
    }

    /**
     * The context an editor preview request carries, cut to what the block uses — the same keys the page would give
     * it. Anything else in the request is dropped.
     *
     * @param \WP_Block_Type $block_type
     * @param mixed          $context From the request.
     * @return array
     */
    public static function for_preview($block_type, $context) {
        if (!is_array($context) || !$block_type || empty($block_type->uses_context)) {
            return [];
        }
        $out = [];
        foreach ((array) $block_type->uses_context as $name) {
            if (array_key_exists($name, $context)) {
                $out[$name] = in_array($name, [self::INDEX, self::COUNT], true) ? (int) $context[$name] : $context[$name];
            }
        }
        return $out;
    }

    /** @internal for tests */
    public static function reset() {
        self::$next = [];
    }
}
