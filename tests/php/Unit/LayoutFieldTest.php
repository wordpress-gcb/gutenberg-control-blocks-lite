<?php
/**
 * A LIST'S LAYOUT AT RENDER (Mark, 2026-10-06: "an advanced version of cards per row" — "it's another 'repeater' style
 * layout"). The PHP twin of src/controls/layout-value.js (tests/js/layout.test.js): the same stored value lays the same
 * list out on the page as in the editor — its columns and each item's place on a wide screen, its phone count on a phone.
 * Only the items' places change; a value the list cannot take is the drawn layout.
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Contract\Fields;
use PHPUnit\Framework\TestCase;

if (!defined('GCBLITE_PLUGIN_DIR')) {
    define('GCBLITE_PLUGIN_DIR', dirname(__DIR__, 3) . '/');
}

class LayoutFieldTest extends TestCase {

    private const BENTO = ['cols' => 4, 'boxes' => [['x' => 0, 'y' => 0, 'w' => 2, 'h' => 2], ['x' => 2, 'y' => 0, 'w' => 1, 'h' => 1], ['x' => 3, 'y' => 0, 'w' => 1, 'h' => 1], ['x' => 2, 'y' => 1, 'w' => 2, 'h' => 1]], 'phone' => 1];
    private const LIMITS = ['minCols' => 1, 'maxCols' => 4, 'cols' => 3];

    public function test_items_take_the_boxes_in_reading_order_and_the_drawn_rows_repeat() {
        $css = Fields::layout_css(self::BENTO, self::LIMITS, 5, '#l', '#l>:nth-child(%d)');
        $this->assertStringContainsString('@media (min-width:1024px){#l{--cols:4;grid-template-columns:repeat(4,minmax(0,1fr))!important;grid-auto-rows:1fr!important}', $css);
        $this->assertStringContainsString('#l>:nth-child(1){grid-column:1 / span 2!important;grid-row:1 / span 2!important;', $css);
        $this->assertStringContainsString('#l>:nth-child(4){grid-column:3 / span 2!important;grid-row:2 / span 1!important;', $css);
        /* the fifth is the first box again, two rows down */
        $this->assertStringContainsString('#l>:nth-child(5){grid-column:1 / span 2!important;grid-row:3 / span 2!important;', $css);
        $this->assertStringContainsString('@media (max-width:781px){#l{grid-template-columns:repeat(1,minmax(0,1fr))!important}}', $css);
    }

    public function test_the_same_css_as_the_editor_writes() {
        /* tests/js/layout.test.js pins these exact strings for the JS twin. Rows of one height (Mark, 2026-10-06: "the
           cards heights don't get set properly"); a box bigger than one cell fills its cell with its picture ("the first
           one should be half the height of the second") */
        $css = Fields::layout_css(self::BENTO, self::LIMITS, 5, '#l', '#l>:nth-child(%d)');
        $this->assertSame(
            '@media (min-width:1024px){#l{--cols:4;grid-template-columns:repeat(4,minmax(0,1fr))!important;grid-auto-rows:1fr!important}'
            . '#l>:nth-child(1){grid-column:1 / span 2!important;grid-row:1 / span 2!important;display:flex!important;flex-direction:column}#l>:nth-child(1)>:first-child:is(img,picture,video,figure,:has(>:is(img,picture,video):only-child)){flex:1 1 0!important;min-height:12rem;height:auto!important;aspect-ratio:auto!important;object-fit:cover}#l>:nth-child(1)>:first-child>:is(img,picture,video):only-child{width:100%;height:100%;object-fit:cover}'
            . '#l>:nth-child(2){grid-column:3 / span 1!important;grid-row:1 / span 1!important}'
            . '#l>:nth-child(3){grid-column:4 / span 1!important;grid-row:1 / span 1!important}'
            . '#l>:nth-child(4){grid-column:3 / span 2!important;grid-row:2 / span 1!important;display:flex!important;flex-direction:column}#l>:nth-child(4)>:first-child:is(img,picture,video,figure,:has(>:is(img,picture,video):only-child)){flex:1 1 0!important;min-height:12rem;height:auto!important;aspect-ratio:auto!important;object-fit:cover}#l>:nth-child(4)>:first-child>:is(img,picture,video):only-child{width:100%;height:100%;object-fit:cover}'
            . '#l>:nth-child(5){grid-column:1 / span 2!important;grid-row:3 / span 2!important;display:flex!important;flex-direction:column}#l>:nth-child(5)>:first-child:is(img,picture,video,figure,:has(>:is(img,picture,video):only-child)){flex:1 1 0!important;min-height:12rem;height:auto!important;aspect-ratio:auto!important;object-fit:cover}#l>:nth-child(5)>:first-child>:is(img,picture,video):only-child{width:100%;height:100%;object-fit:cover}}'
            . '@media (max-width:781px){#l{grid-template-columns:repeat(1,minmax(0,1fr))!important}}',
            $css
        );
    }

    /* MARK'S TEAM GRID (2026-10-06): a 2x1 beside a 2x2, two 1x1 under the 2x1. A wide box's picture fills its cell, so
       the row is the height the one-cell items give it and the 2x2 is two rows: "the first one should be half the
       height of the second". A one-cell item keeps its drawn picture. */
    public function test_a_wide_box_and_a_tall_box_both_fill_their_cells_with_their_picture() {
        $team = ['cols' => 4, 'boxes' => [['x' => 0, 'y' => 0, 'w' => 2, 'h' => 1], ['x' => 2, 'y' => 0, 'w' => 2, 'h' => 2], ['x' => 0, 'y' => 1, 'w' => 1, 'h' => 1], ['x' => 1, 'y' => 1, 'w' => 1, 'h' => 1]], 'phone' => 1];
        $css  = Fields::layout_css($team, self::LIMITS, 4, '#l', '#l>:nth-child(%d)');
        $this->assertStringContainsString('#l>:nth-child(1)>:first-child:is(img,picture,video,figure,:has(>:is(img,picture,video):only-child)){flex:1 1 0!important;min-height:12rem;height:auto!important;aspect-ratio:auto!important', $css);
        $this->assertStringContainsString('#l>:nth-child(2)>:first-child:is(', $css);
        $this->assertStringNotContainsString('#l>:nth-child(3)>', $css);
        $this->assertStringContainsString('#l>:nth-child(3){grid-column:1 / span 1!important;grid-row:2 / span 1!important}', $css);
    }

    /* ON PHONES THE SAME AS WIDE SCREENS (Mark's popover design, 2026-10-06): phone 0, the placement at every width */
    public function test_on_phones_the_same_as_wide_screens(): void
    {
        $css = Fields::layout_css(['phone' => 0] + self::BENTO, self::LIMITS, 5, '#l', '#l>:nth-child(%d)');
        $this->assertStringStartsWith('#l{--cols:4;grid-template-columns:repeat(4,minmax(0,1fr))!important;grid-auto-rows:1fr!important}', $css);
        $this->assertStringNotContainsString('@media', $css);
        $this->assertSame(0, Fields::layout_phone('same'));
        $this->assertSame(2, Fields::layout_phone(2));
        $this->assertSame(1, Fields::layout_phone(7));
    }

    public function test_nothing_stored_or_the_drawn_columns_places_nothing() {
        $this->assertSame('', Fields::layout_css(null, self::LIMITS, 6, '#l', '#l>:nth-child(%d)'));
        $even = ['cols' => 3, 'boxes' => [['x' => 0, 'y' => 0, 'w' => 1, 'h' => 1], ['x' => 1, 'y' => 0, 'w' => 1, 'h' => 1], ['x' => 2, 'y' => 0, 'w' => 1, 'h' => 1]], 'phone' => 1];
        $this->assertSame('', Fields::layout_css($even, self::LIMITS, 6, '#l', '#l>:nth-child(%d)'));
        /* the same count, a phone of two: the phone rule only */
        $this->assertSame('@media (min-width:1024px){#l{--cols:3;grid-template-columns:repeat(3,minmax(0,1fr))!important;grid-auto-rows:1fr!important}'
            . '#l>:nth-child(1){grid-column:1 / span 1!important;grid-row:1 / span 1!important}}'
            . '@media (max-width:781px){#l{grid-template-columns:repeat(2,minmax(0,1fr))!important}}',
            Fields::layout_css(['phone' => 2] + $even, self::LIMITS, 1, '#l', '#l>:nth-child(%d)'));
    }

    public function test_a_value_the_list_cannot_take_is_the_drawn_layout() {
        $this->assertSame('', Fields::layout_css(['cols' => 6] + self::BENTO, self::LIMITS, 4, '#l', '#l>:nth-child(%d)'), 'more columns than its items allow');
        $overlap = ['cols' => 2, 'boxes' => [['x' => 0, 'y' => 0, 'w' => 2, 'h' => 1], ['x' => 1, 'y' => 0, 'w' => 1, 'h' => 1]], 'phone' => 1];
        $this->assertSame('', Fields::layout_css($overlap, self::LIMITS, 2, '#l', '#l>:nth-child(%d)'));
        /* an object, as a block attribute arrives */
        $this->assertNotSame('', Fields::layout_css(json_decode((string) json_encode(self::BENTO)), self::LIMITS, 2, '#l', '#l>:nth-child(%d)'));
    }

    public function test_a_selector_that_could_break_out_is_refused() {
        $this->assertSame('', Fields::layout_css(self::BENTO, self::LIMITS, 2, '#l}</style><script>', '#l>:nth-child(%d)'));
    }

    /* Mark, 2026-10-06: "we shold allow more columns but we also need a way to control the min width of a card so for
       lots of columns, it'll span x number of cols" — layout-value.js minSpanOf, the same numbers */
    public function test_more_columns_and_each_item_at_least_its_narrowest() {
        $items = ['minItemPx' => 272, 'containerPx' => 1200, 'gapPx' => 16, 'cols' => 3];
        foreach ([[3, 1], [4, 1], [5, 2], [6, 2], [12, 3]] as [$cols, $span]) {
            $this->assertSame($span, Fields::layout_min_span(['cols' => $cols], $items), "$cols columns");
        }
        $this->assertSame(5, Fields::layout_min_span(['cols' => 12, 'minPx' => 400], $items), 'the list\'s own narrowest wins');
        $this->assertSame(12, Fields::layout_limits([])['maxCols']);
        /* 12 columns, a 5 and a 7: placed */
        $wide = ['cols' => 12, 'boxes' => [['x' => 0, 'y' => 0, 'w' => 5, 'h' => 1], ['x' => 5, 'y' => 0, 'w' => 7, 'h' => 1]], 'phone' => 1];
        $this->assertStringContainsString('#l>:nth-child(2){grid-column:6 / span 7!important', Fields::layout_css($wide, $items, 2, '#l', '#l>:nth-child(%d)'));
        /* a box narrower than an item can be: the drawn layout */
        $narrow = ['cols' => 12, 'boxes' => [['x' => 0, 'y' => 0, 'w' => 2, 'h' => 1]], 'phone' => 1];
        $this->assertSame('', Fields::layout_css($narrow, $items, 1, '#l', '#l>:nth-child(%d)'));
        $this->assertSame('', Fields::layout_css(['cols' => 13] + $wide, $items, 2, '#l', '#l>:nth-child(%d)'));
    }
}
