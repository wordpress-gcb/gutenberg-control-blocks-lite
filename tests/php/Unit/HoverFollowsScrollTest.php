<?php
/**
 * HOVER FOLLOWS THE SCROLL — the runtime rides with every front-end gcb block.
 *
 * Mark, 2026-09-22: "if your mouse is on it you're engaged even if your mouse
 * is just on it as you scroll by." The runtime (src/hover-follows-scroll.js)
 * is enqueued the first time a gcb/* block renders on a front-end page, and
 * only there: the editor never runs a block's behaviour, and a page without
 * a gcb block has nothing to engage.
 *
 * @package GCBLite\Tests
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Frontend\HoverFollowsScroll;
use PHPUnit\Framework\TestCase;

class HoverFollowsScrollTest extends TestCase {

    protected function setUp(): void {
        HoverFollowsScroll::reset();
        $GLOBALS['gcblite_test_enqueued'] = [];
        $GLOBALS['gcblite_test_is_admin'] = false;
    }

    public function test_a_gcb_block_on_the_front_end_enqueues_the_runtime_once() {
        HoverFollowsScroll::on_render('<div class="gcb-block">a</div>', ['blockName' => 'gcb/hero']);
        HoverFollowsScroll::on_render('<div class="gcb-block">b</div>', ['blockName' => 'gcb/cards']);
        $this->assertSame(['gcblite-hover-follows-scroll'], $GLOBALS['gcblite_test_enqueued']);
    }

    public function test_the_markup_is_handed_back_untouched() {
        $html = '<div class="gcb-block">a</div>';
        $this->assertSame($html, HoverFollowsScroll::on_render($html, ['blockName' => 'gcb/hero']));
    }

    public function test_another_plugins_block_does_not() {
        HoverFollowsScroll::on_render('<p>x</p>', ['blockName' => 'core/paragraph']);
        $this->assertSame([], $GLOBALS['gcblite_test_enqueued']);
    }

    public function test_nor_the_editor() {
        $GLOBALS['gcblite_test_is_admin'] = true;
        HoverFollowsScroll::on_render('<div class="gcb-block">a</div>', ['blockName' => 'gcb/hero']);
        $this->assertSame([], $GLOBALS['gcblite_test_enqueued']);
    }
}
