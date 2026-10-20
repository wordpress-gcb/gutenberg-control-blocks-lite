<?php
/**
 * A PERSON'S WORDS ARE NOT A REGEX REPLACEMENT.
 *
 * Found 2026-09-21 by gcb-pro's cycle harness: a pricing table whose three
 * prices — "$9", "$29", "$99" — printed NOTHING on the real page, while every
 * other word of the cards was there. The rendered inner blocks were handed to
 * preg_replace() as its REPLACEMENT string, where `$9` and `\1` are
 * backreferences to groups that do not exist: they vanish. Any price inside a
 * repeater item, in any block, on any site.
 *
 * @package GCBLite\Tests
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Rendering\InnerBlocksReplacer;
use PHPUnit\Framework\TestCase;

class InnerBlocksReplacerTest extends TestCase {

    public function test_a_price_survives_the_swap() {
        $out = InnerBlocksReplacer::replace('<div><InnerBlocks template=\'[]\' /></div>', '<span>$9</span><span>$29/month</span>');
        $this->assertSame('<div><span>$9</span><span>$29/month</span></div>', $out);
    }

    public function test_so_does_a_backslash_number() {
        $out = InnerBlocksReplacer::replace('<ul><Repeater min="1" /></ul>', '<li>C:\\1\\temp and \\0</li>');
        $this->assertSame('<ul><li>C:\\1\\temp and \\0</li></ul>', $out);
    }

    public function test_paired_and_lowercase_tags_still_swap() {
        $this->assertSame('<p>x</p>', InnerBlocksReplacer::replace('<innerblocks class="a">sample</innerblocks>', '<p>x</p>'));
        $this->assertSame('<p>x</p>', InnerBlocksReplacer::replace('<repeater>sample</repeater>', '<p>x</p>'));
    }

    public function test_each_region_takes_its_own_slot(): void
    {
        $html = '<section><innerblocks data-gcb-slot="0" template=\'[["a"],["b"]]\'></innerblocks><div class="filters"></div><innerblocks data-gcb-slot="1"></innerblocks></section>';
        $out  = InnerBlocksReplacer::replace_slots($html, ['<ul>styles</ul>', '<div>cars</div>'], '<ul>styles</ul><div>cars</div>');
        $this->assertSame('<section><ul>styles</ul><div class="filters"></div><div>cars</div></section>', $out, 'the filter row stays between them');
    }

    public function test_slots_that_do_not_pair_put_everything_first_and_nothing_twice(): void
    {
        $html = '<innerblocks data-gcb-slot="0"></innerblocks><p>x</p><innerblocks data-gcb-slot="1"></innerblocks>';
        $out  = InnerBlocksReplacer::replace_slots($html, ['A', 'B', 'C'], 'ABC');
        $this->assertSame('ABC<p>x</p>', $out);
    }

    public function test_one_unnumbered_marker_is_as_before(): void
    {
        $this->assertSame('<div>AB</div>', InnerBlocksReplacer::replace_slots('<div><InnerBlocks /></div>', ['A', 'B'], 'AB'));
    }
}
