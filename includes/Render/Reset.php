<?php
/**
 * THE SCOPED RESET A GCB BLOCK STANDS ON, enqueued once (2026-10-10).
 *
 * Every block sheet gcb-pro built used to open with the same 14 KB reset, copied into each child block's sheet as
 * well — 22 files a theme, 7 unique. The reset is one file now (assets/gcb-block-reset.css), loaded wherever
 * blocks are drawn: the page and the editor canvas (enqueue_block_assets fires for both). A block's own sheet
 * holds its utilities alone.
 *
 * @package GCBLite\Render
 */

namespace GCBLite\Render;

if (!defined('ABSPATH')) {
    exit;
}

final class Reset
{
    public const HANDLE = 'gcblite-block-reset';

    public static function init(): void {
        add_action('enqueue_block_assets', [__CLASS__, 'enqueue']);
    }

    public static function enqueue(): void {
        if (wp_style_is(self::HANDLE, 'enqueued')) {
            return;
        }
        wp_enqueue_style(self::HANDLE, GCBLITE_PLUGIN_URL . 'assets/gcb-block-reset.css', [], GCBLITE_VERSION);
    }
}
