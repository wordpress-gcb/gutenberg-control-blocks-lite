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
}
