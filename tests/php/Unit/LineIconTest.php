<?php
/**
 * LINE ICONS THROUGH THE REGISTRY (TODO, 2026-10-07 — the Showman's Show kit's service icons): wp_register_icon strips
 * stroke attributes and <g>, so a stroke icon registered as drawn comes out a filled blob. `'style' => 'line'` on a
 * gcblite_custom_icons entry gives the <svg> a class the shipped CSS strokes, and its shapes fill="none" — the two
 * things the registry keeps.
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Blocks\KitBlocks;
use PHPUnit\Framework\TestCase;

class LineIconTest extends TestCase {

    public function test_the_svg_gets_the_class_and_unfilled_shapes() {
        $out = KitBlocks::line_icon_svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 6h18"/><circle cx="12" cy="12" r="3"/></svg>');
        $this->assertSame('<svg class="gcb-icon-line" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" d="M3 6h18"/><circle fill="none" cx="12" cy="12" r="3"/></svg>', $out);
    }

    public function test_a_class_already_there_is_kept_and_not_doubled() {
        $out = KitBlocks::line_icon_svg('<svg viewBox="0 0 24 24" class="ss-line"><path d="M1 1"/></svg>');
        $this->assertStringContainsString('class="ss-line gcb-icon-line"', $out);
        $this->assertSame($out, KitBlocks::line_icon_svg($out));
    }

    public function test_a_shape_with_its_own_fill_keeps_it() {
        $out = KitBlocks::line_icon_svg('<svg><path fill="currentColor" d="M1 1"/><rect width="2" height="2"/></svg>');
        $this->assertStringContainsString('<path fill="currentColor" d="M1 1"/>', $out);
        $this->assertStringContainsString('<rect fill="none" width="2"', $out);
    }

    public function test_the_css_strokes_the_class() {
        $this->assertStringStartsWith('svg.' . KitBlocks::LINE_ICON_CLASS . '{fill:none;stroke:currentColor;', KitBlocks::LINE_ICON_CSS);
    }
}
