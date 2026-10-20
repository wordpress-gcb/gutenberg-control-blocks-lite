<?php
/**
 * THE SELECT'S SERVER HALF (2026-10-21): the box its list floats in, its parts' ids and its list's tabindex drawn on the
 * server, so a router swap of a filter finds the select as it left it and an open list keeps its focus.
 *
 * @package GCBLite\Tests
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Kit\Select;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../kit/select/Select.php';

class KitSelectTest extends TestCase {

    private const DRAWN = '<div data-gcb-kit="select"><select><option value="">Make</option></select><button data-gcb-kit-select-trigger>x</button><ul data-gcb-kit-select-list class="menu"><li data-gcb-kit-select-option></li></ul></div>';

    public function test_the_list_is_drawn_in_its_positioner_with_ids_and_a_tabindex(): void {
        $out = Select::positioned(self::DRAWN . self::DRAWN);
        $this->assertSame(2, substr_count($out, '<div data-gcb-kit-select-positioner=""><ul data-gcb-kit-select-list'));
        $this->assertStringContainsString('id="gcb-select-1-trigger"', $out);
        $this->assertStringContainsString('id="gcb-select-2-list"', $out);
        $this->assertSame(2, substr_count($out, 'tabindex="0"'));
        $this->assertStringContainsString('class="menu"', $out, 'the design\'s own classes stay');
    }

    public function test_what_is_drawn_already_is_kept_and_drawn_again_is_the_same(): void {
        $once = Select::positioned('<div data-gcb-kit="select"><button data-gcb-kit-select-trigger id="mine">x</button><ul data-gcb-kit-select-list tabindex="-1"></ul></div>');
        $this->assertStringContainsString('id="mine"', $once);
        $this->assertStringContainsString('tabindex="-1"', $once);
        $this->assertSame($once, Select::positioned($once), 'a block rendered inside another is not wrapped twice');
    }

    public function test_a_page_without_a_select_is_untouched(): void {
        $this->assertSame('<p>hi</p>', Select::positioned('<p>hi</p>'));
    }
}
