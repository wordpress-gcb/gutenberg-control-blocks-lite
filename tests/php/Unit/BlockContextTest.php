<?php
/**
 * A CHILD'S PLACE AMONG ITS SIBLINGS (TODO "Parent ↔ child context", 2026-10-07): `gcb/index` and `gcb/count`, asked
 * for through usesContext. On the page WordPress filters each child's context in order, so the n-th call for a parent
 * is its n-th child; in the editor the request carries them, cut to what the block uses.
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Blocks\BlockContext;
use PHPUnit\Framework\TestCase;

class BlockContextTest extends TestCase {

    protected function setUp(): void {
        BlockContext::reset();
    }

    public function test_children_are_numbered_in_order_and_a_second_render_starts_again() {
        $this->assertSame([0, 1, 2], [BlockContext::take(7, 3), BlockContext::take(7, 3), BlockContext::take(7, 3)]);
        $this->assertSame(0, BlockContext::take(7, 3));
    }

    public function test_parents_count_separately_even_when_nested() {
        $this->assertSame(0, BlockContext::take(1, 2));
        $this->assertSame(0, BlockContext::take(2, 4)); // the first child's own children
        $this->assertSame(1, BlockContext::take(2, 4));
        $this->assertSame(1, BlockContext::take(1, 2));
    }

    public function test_a_preview_gets_only_the_context_its_block_uses() {
        $type = (object) ['uses_context' => ['gcb/index', 'gcb/count', 'ss/show_tags']];
        $this->assertSame(
            ['gcb/index' => 3, 'gcb/count' => 14, 'ss/show_tags' => true],
            BlockContext::for_preview($type, ['gcb/index' => '3', 'gcb/count' => 14, 'ss/show_tags' => true, 'postId' => 9])
        );
        $this->assertSame([], BlockContext::for_preview((object) ['uses_context' => []], ['gcb/index' => 1]));
        $this->assertSame([], BlockContext::for_preview($type, 'nope'));
    }
}
