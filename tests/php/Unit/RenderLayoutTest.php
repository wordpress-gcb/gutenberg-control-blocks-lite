<?php
/**
 * THE LAYOUT CSS HELPER (2026-10-10): a built block's render.php prints the style that places a grid's boxes with one
 * call — gcblite_layout_css — instead of carrying the guard, the count, the selectors and the echo inline. The CSS is
 * Contract\Fields::layout_css's (its own tests say what the rules are); this says what the wrapper adds.
 */

namespace GCBLite\Tests\Unit;

use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 3) . '/includes/Render/layout.php';

final class RenderLayoutTest extends TestCase
{
    private const LIMITS = ['cols' => 3, 'minItemPx' => 272, 'containerPx' => 1200, 'gapPx' => 16];

    /** a bento: one big box and three small ones on four columns */
    private const BENTO = ['cols' => 4, 'boxes' => [
        ['x' => 0, 'y' => 0, 'w' => 2, 'h' => 2], ['x' => 2, 'y' => 0, 'w' => 1, 'h' => 1],
        ['x' => 3, 'y' => 0, 'w' => 1, 'h' => 1], ['x' => 2, 'y' => 1, 'w' => 2, 'h' => 1],
    ], 'phone' => 1];

    public function test_nothing_stored_or_the_drawn_layout_prints_nothing(): void
    {
        $this->assertSame('', gcblite_layout_css([], 'layout', 'gcb-l-1', self::LIMITS, 6));
        $this->assertSame('', gcblite_layout_css(['layout' => null], 'layout', 'gcb-l-1', self::LIMITS, 6));
        $drawn = ['cols' => 3, 'boxes' => [['x' => 0, 'y' => 0, 'w' => 1, 'h' => 1], ['x' => 1, 'y' => 0, 'w' => 1, 'h' => 1], ['x' => 2, 'y' => 0, 'w' => 1, 'h' => 1]], 'phone' => 1];
        $this->assertSame('', gcblite_layout_css(['layout' => $drawn], 'layout', 'gcb-l-1', self::LIMITS, 6), 'the drawn columns, one box each: the design stands');
    }

    public function test_a_stored_arrangement_is_a_style_addressed_by_the_grids_mark(): void
    {
        $css = gcblite_layout_css(['layout' => self::BENTO], 'layout', 'gcb-l-7', self::LIMITS, 5);
        $this->assertStringStartsWith('<style>@media (min-width:1024px){[data-gcb-layout="gcb-l-7"][data-gcb-layout]{--cols:4;', $css);
        $this->assertStringEndsWith('</style>', $css);
        $this->assertStringContainsString('[data-gcb-layout="gcb-l-7"]>:nth-child(1){grid-column:1 / span 2!important;grid-row:1 / span 2!important;display:flex!important', $css);
        $this->assertStringContainsString('[data-gcb-layout="gcb-l-7"]>:nth-child(5){grid-column:1 / span 2!important;grid-row:3 / span 2!important', $css, 'a fifth item wraps to the next band');
        $this->assertStringNotContainsString(':nth-child(6)', $css, 'five items, five places');
        $this->assertSame($css, gcblite_layout_css((object) ['layout' => (object) self::BENTO], 'layout', 'gcb-l-7', self::LIMITS, 5), 'objects from the REST API read the same');
        $this->assertStringContainsString('[data-gcb-layout="gcb-l-2"]', gcblite_layout_css(['layout2' => self::BENTO], 'layout2', 'gcb-l-2', self::LIMITS, 4), 'a second grid, its own key and mark');
    }

    public function test_the_count_is_a_number_or_the_block_whose_inner_blocks_are_the_items(): void
    {
        $this->assertSame(3, gcblite_layout_count(3));
        $this->assertSame(1, gcblite_layout_count(0), 'at least one');
        $this->assertSame(24, gcblite_layout_count(null), 'no block to count: room for any list a person draws');
        $this->assertSame(2, gcblite_layout_count((object) ['inner_blocks' => [1, 2]]));
        /* WordPress's WP_Block_List: Countable, with properties of its own (never cast to an array and counted) */
        $list = new class implements \Countable {
            public $blocks = [1, 2, 3, 4, 5, 6]; public $available_context = []; public $registry = null;
            public function count(): int { return count($this->blocks); }
        };
        $this->assertSame(6, gcblite_layout_count((object) ['inner_blocks' => $list]));
        $css = gcblite_layout_css(['layout' => self::BENTO], 'layout', 'gcb-l-1', self::LIMITS, (object) ['inner_blocks' => $list]);
        $this->assertStringContainsString(':nth-child(6)', $css);
        $this->assertStringNotContainsString(':nth-child(7)', $css);
    }

    public function test_a_mark_is_letters_digits_and_dashes_or_there_is_no_style(): void
    {
        $this->assertSame('', gcblite_layout_css(['layout' => self::BENTO], 'layout', '', self::LIMITS, 4));
        $css = gcblite_layout_css(['layout' => self::BENTO], 'layout', 'gcb-l-1"]{}<', self::LIMITS, 4);
        $this->assertStringContainsString('[data-gcb-layout="gcb-l-1"]', $css, 'anything that is not a mark is taken off');
        $this->assertStringNotContainsString('<style>{', $css);
    }
}
