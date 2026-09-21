<?php
/**
 * Frontend swap for editor-only tags.
 *
 * The render.php files use <Repeater allowedBlocks="..." /> and <InnerBlocks />
 * to declare slots. The editor JS (parse-preview.js) replaces these with live
 * React components. On the frontend, we swap them for the saved inner-block
 * content ($content from render_callback) instead — so 1:1 parity holds.
 *
 * @package GCBLite\Rendering
 */

namespace GCBLite\Rendering;

if (!defined('ABSPATH')) {
    exit;
}

class InnerBlocksReplacer {

    public static function init() {
        // Run after WP renders the block, before block_filter chain finishes.
        add_filter('render_block', [__CLASS__, 'swap_tags'], 10, 2);
    }

    /**
     * Swap <Repeater> / <InnerBlocks> tags in the rendered HTML for the saved
     * inner content. Only applies to gcb/* blocks.
     */
    public static function swap_tags($block_content, $block) {
        $block_name = $block['blockName'] ?? '';
        if (strpos($block_name, 'gcb/') !== 0) {
            return $block_content;
        }

        // The render callback already echoed $content for any plain echo-content
        // usage in render.php. <Repeater> / <InnerBlocks> are markers we placed
        // in render.php — replace those with $content too. Multiple tags
        // pointing at the same content is fine; first wins.
        $inner = self::collect_inner_html($block);

        return self::replace($block_content, $inner);
    }

    /**
     * Build the rendered HTML for all inner blocks of $block. Mirrors the
     * default WP behaviour — render each inner block in order.
     */
    private static function collect_inner_html(array $block) {
        $html = '';
        foreach ($block['innerBlocks'] ?? [] as $inner) {
            $html .= render_block($inner);
        }
        return $html;
    }

    /**
     * Replace <Repeater> and <InnerBlocks> tags (any case, self-closing or
     * paired) with the given content.
     */
    public static function replace($html, $content) {
        // THE CONTENT IS A PERSON'S WORDS, NOT A REPLACEMENT PATTERN (2026-09-21).
        // Handed to preg_replace() as its replacement, `$9` and `\1` are
        // backreferences to groups that do not exist — so a pricing card's
        // "$9" and "$29" printed NOTHING, in any repeater item, on any site.
        // A callback's return value is used as it stands.
        $give = static function () use ($content) {
            return $content;
        };

        // Self-closing or paired <Repeater ... />, <Repeater>...</Repeater>
        $html = preg_replace_callback(
            '/<repeater(?:\s+[^>]*)?\s*(?:\/>|>.*?<\/repeater>)/is',
            $give,
            $html
        );

        // Self-closing or paired <InnerBlocks ... />, <InnerBlocks>...</InnerBlocks>
        $html = preg_replace_callback(
            '/<innerblocks(?:\s+[^>]*)?\s*(?:\/>|>.*?<\/innerblocks>)/is',
            $give,
            $html
        );

        return $html;
    }
}
