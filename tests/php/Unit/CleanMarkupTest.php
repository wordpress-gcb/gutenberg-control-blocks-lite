<?php
/**
 * CLEAN MARKUP — a visitor's page carries no editor identifiers (2026-10-10).
 *
 * `data-gcb="y4ikro"` is the studio's handle on an element and the marks
 * script's; `data-gcb-placeholder="…"` is the studio preview's switch. Neither
 * is read by anything a visitor loads, so both come off a gcb block as it
 * renders — unless the page is the editor, a REST render, or has the admin
 * bar, where the marks script will want the ids. The `data-gcb-*` family the
 * kit and the field scripts read is never touched.
 *
 * @package GCBLite\Tests
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Frontend\CleanMarkup;
use PHPUnit\Framework\TestCase;

if (!function_exists('is_admin_bar_showing')) {
    eval('function is_admin_bar_showing() { return !empty($GLOBALS["gcblite_test_admin_bar"]); }');
}

class CleanMarkupTest extends TestCase {

    protected function setUp(): void {
        CleanMarkup::reset();
        $GLOBALS['gcblite_test_is_admin']  = false;
        $GLOBALS['gcblite_test_admin_bar'] = false;
    }

    /* ---- the regex ---------------------------------------------------- */

    public function test_the_editor_id_comes_off_every_element() {
        $html = '<section class="hero" data-gcb="qfn7yv"><div class="gcb-container" data-gcb="peuc2m"><h2 data-gcb="u8pqo2">Hi</h2></div></section>';
        $this->assertSame(
            '<section class="hero"><div class="gcb-container"><h2>Hi</h2></div></section>',
            CleanMarkup::strip($html)
        );
    }

    public function test_every_data_gcb_dash_attribute_the_scripts_read_stays() {
        $html = '<div data-gcb-kit="carousel" data-gcb-kit-track data-gcb-layout="grid" data-gcb-repeater="cards" data-gcb-atom="x">'
            . '<h3 data-gcb-field="title" data-gcb-field-type="text" data-gcb-field-label="Title">A</h3>'
            . '<button data-gcb-kit-next aria-label="Next"></button>'
            . '<li data-gcb-kit-item data-gcb-filter-term="">x</li></div>';
        $this->assertSame($html, CleanMarkup::strip($html), 'nothing to strip, nothing changed');
    }

    public function test_the_id_goes_and_its_neighbours_stay_on_one_element() {
        $html = '<h3 class="t" data-gcb-field="title" data-gcb="h9" data-gcb-field-type="text" id="a" data-gcb-field-label="Title">A</h3>';
        $this->assertSame(
            '<h3 class="t" data-gcb-field="title" data-gcb-field-type="text" id="a" data-gcb-field-label="Title">A</h3>',
            CleanMarkup::strip($html)
        );
    }

    public function test_text_that_merely_says_the_words_is_left_alone() {
        $html = '<p data-gcb="p1">Set data-gcb="x" or data-gcb on the tag; see data-gcb-field too.</p>'
            . '<script>document.querySelectorAll("[data-gcb-kit]"); var s = "data-gcb";</script>';
        $this->assertSame(
            '<p>Set data-gcb="x" or data-gcb on the tag; see data-gcb-field too.</p>'
            . '<script>document.querySelectorAll("[data-gcb-kit]"); var s = "data-gcb";</script>',
            CleanMarkup::strip($html)
        );
    }

    public function test_single_quoted_unquoted_and_valueless_forms_all_go() {
        $this->assertSame('<div class="a">x</div>', CleanMarkup::strip("<div class=\"a\" data-gcb='abc'>x</div>"));
        $this->assertSame('<div class="a">x</div>', CleanMarkup::strip('<div class="a" data-gcb=abc>x</div>'));
        $this->assertSame('<div class="a">x</div>', CleanMarkup::strip('<div class="a" data-gcb>x</div>'));
        $this->assertSame('<div class="a">x</div>', CleanMarkup::strip('<div data-gcb class="a">x</div>'));
        $this->assertSame('<img src="a.jpg"/>', CleanMarkup::strip('<img src="a.jpg" data-gcb="i1"/>'));
        $this->assertSame('<div class="a" data-gcb-kit=carousel>x</div>', CleanMarkup::strip('<div class="a" data-gcb-kit=carousel data-gcb = "q">x</div>'), 'spaces round the equals; the kit attribute stays');
    }

    public function test_a_closing_angle_inside_a_quoted_value_does_not_end_the_tag_early() {
        $html = '<h3 data-gcb-field-label="a > b" data-gcb="h1">A</h3>';
        $this->assertSame('<h3 data-gcb-field-label="a > b">A</h3>', CleanMarkup::strip($html));
    }

    public function test_the_studio_placeholder_hint_comes_off_too() {
        $html = '<section class="relative" data-gcb-placeholder="Stats — scroll to see figures animate in" data-gcb="y4ikro"><p>x</p></section>';
        $this->assertSame('<section class="relative"><p>x</p></section>', CleanMarkup::strip($html));
    }

    public function test_stripping_is_idempotent() {
        $html = '<section data-gcb="s1" data-gcb-placeholder><div data-gcb-kit="tabs" data-gcb="d1"><h2 data-gcb-field="t" data-gcb="h1">A</h2></div></section>';
        $once  = CleanMarkup::strip($html);
        $twice = CleanMarkup::strip($once);
        $this->assertSame('<section><div data-gcb-kit="tabs"><h2 data-gcb-field="t">A</h2></div></section>', $once);
        $this->assertSame($once, $twice);
    }

    public function test_markup_without_the_word_is_handed_back_as_is() {
        $html = '<div class="plain">nothing</div>';
        $this->assertSame($html, CleanMarkup::strip($html));
    }

    /* ---- the hook ----------------------------------------------------- */

    public function test_a_visitor_gets_a_clean_gcb_block() {
        $this->assertSame(
            '<div class="gcb-block">a</div>',
            CleanMarkup::clean_block('<div class="gcb-block" data-gcb="a1">a</div>', ['blockName' => 'gcb/hero'])
        );
    }

    public function test_another_plugins_block_is_not_ours_to_touch() {
        $html = '<p data-gcb="a1">x</p>';
        $this->assertSame($html, CleanMarkup::clean_block($html, ['blockName' => 'core/paragraph']));
    }

    public function test_the_editor_keeps_the_ids() {
        $GLOBALS['gcblite_test_is_admin'] = true;
        $html = '<div class="gcb-block" data-gcb="a1">a</div>';
        $this->assertSame($html, CleanMarkup::clean_block($html, ['blockName' => 'gcb/hero']));
    }

    public function test_a_signed_in_builder_with_the_admin_bar_keeps_the_ids_for_the_marks() {
        $GLOBALS['gcblite_test_admin_bar'] = true;
        $html = '<div class="gcb-block" data-gcb="a1">a</div>';
        $this->assertSame($html, CleanMarkup::clean_block($html, ['blockName' => 'gcb/hero']));
    }

    public function test_the_decision_is_made_once_per_request() {
        $this->assertTrue(CleanMarkup::cleaning());
        $GLOBALS['gcblite_test_admin_bar'] = true;
        $this->assertTrue(CleanMarkup::cleaning(), 'remembered');
        CleanMarkup::reset();
        $this->assertFalse(CleanMarkup::cleaning());
    }
}
