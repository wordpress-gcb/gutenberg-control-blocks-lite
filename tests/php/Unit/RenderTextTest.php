<?php
/**
 * THE RENDER HELPERS, THE WORDS (2026-10-10): a built block's render.php calls these for its headings, rich text,
 * numbers and icons instead of carrying the logic inline. Each returns the text to print.
 */

namespace GCBLite\Tests\Unit;

use PHPUnit\Framework\TestCase;
use GCBLite\Tests\WpStub;

if (!function_exists('esc_html')) {
    eval('function esc_html($u) { return htmlspecialchars((string) $u, ENT_QUOTES); }');
}
if (!function_exists('wp_get_icon')) {
    /* WordPress 7.1's registry lookup: it knows core's shield and nothing else */
    eval('function wp_get_icon($name, $args = array()) { return $name === "core/shield" ? "<svg class=\"shield\"></svg>" : ""; }');
}
if (!function_exists('esc_attr')) {
    eval('function esc_attr($u) { return htmlspecialchars((string) $u, ENT_QUOTES); }');
}
require_once dirname(__DIR__, 3) . '/includes/Render/text.php';

final class RenderTextTest extends TestCase
{
    protected function setUp(): void
    {
        WpStub::reset();
    }

    public function test_the_heading_tag_is_the_chosen_level_held_to_h1_h6(): void
    {
        $this->assertSame('h3', gcblite_heading_tag(['title_level' => 'h3'], 'title_level', 'h2'));
        $this->assertSame('h2', gcblite_heading_tag(['title_level' => 'script'], 'title_level', 'h2'), 'an unknown level is the drawn tag');
        $this->assertSame('h2', gcblite_heading_tag(['title_level' => ''], 'title_level', 'h2'));
        $this->assertSame('h1', gcblite_heading_tag([], 'title_level', 'h1'), 'no choice yet');
        $this->assertSame('h4', gcblite_heading_tag(null, 'title_level', 'h4'), 'no attributes at all');
    }

    public function test_one_paragraph_in_a_line_of_text_is_its_words(): void
    {
        $this->assertSame('<strong>Leading</strong> the way', gcblite_rich_inline('<p><strong>Leading</strong> the way</p>'));
        $this->assertSame('a', gcblite_rich_inline("  <p class=\"x\">a</p>\n"), 'attributes and surrounding space do not matter');
        $this->assertSame('<p>a</p><p>b</p>', gcblite_rich_inline('<p>a</p><p>b</p>'), 'two paragraphs are not one line');
        $this->assertSame('plain <em>words</em>', gcblite_rich_inline('plain <em>words</em>'), 'no paragraph, nothing to unwrap');
        $this->assertSame('', gcblite_rich_inline(null));
    }

    public function test_a_number_prints_grouped_with_the_decimals_it_has(): void
    {
        $this->assertSame('5,000', gcblite_number(5000));
        $this->assertSame('370', gcblite_number(370.0));
        $this->assertSame('99.2', gcblite_number(99.2), 'one decimal stays one decimal');
        $this->assertSame('3.5', gcblite_number('3.5'), 'a value stored as a string reads the same');
        $this->assertSame('0.125', gcblite_number(0.125), 'more decimals are not cut to two');
        $this->assertSame('1,234.56', gcblite_number(1234.56));
        $this->assertSame('', gcblite_number(''), 'nothing prints nothing, not 0');
        $this->assertSame('', gcblite_number(null));
        $this->assertSame('0', gcblite_number(0), 'a real zero is a real zero');
    }

    /**
     * 2026-10-22, the Airbnb build: a rating stored as "5.0" printed "5" beside a "4.9" that kept its decimal. The
     * decimals were read off a float cast, and a float has no memory of a trailing zero. A number prints with the
     * decimals it was stored with — the string decides, not the float.
     */
    public function test_a_number_prints_with_the_decimals_it_was_stored_with(): void
    {
        $this->assertSame('5.0', gcblite_number('5.0'), 'a trailing zero was typed, so it prints');
        $this->assertSame('5', gcblite_number('5'));
        $this->assertSame('4.95', gcblite_number('4.95'));
        $this->assertSame('14,395', gcblite_number('14395'), 'grouping as before');
        $this->assertSame('1,234.50', gcblite_number('1234.50'), 'grouped and the stored decimals kept');
        $this->assertSame('0.00', gcblite_number('0.00'));
        $this->assertSame('-1,234.5', gcblite_number('-1234.5'));
        $this->assertSame('5.0', gcblite_number(' 5.0 '), 'surrounding space is not part of the number');
        $this->assertSame('0.125', gcblite_number(0.125), 'a float has no stored decimals: its shortest form is what it has');
        $this->assertSame('370', gcblite_number(370.0));
        $this->assertSame('12', gcblite_number(12));
    }

    /**
     * 2026-10-23, the Airbnb rating summary: a draft page with no record bound prints each number field's registered
     * DEFAULT, and a default written into block.json is a number, not the "5.0" the designer typed — so "5.0" printed
     * "5" again, beside "4.9". The precision is the field's, read off the design's sample and kept on the control as
     * `decimals`; the render passes it, and it wins over whatever decimals the value happens to carry. No cap on
     * decimals: the control said how many.
     */
    public function test_the_controls_decimals_win_over_the_values_own(): void
    {
        $this->assertSame('5.0', gcblite_number(5, true, 1), 'the int default the builder wrote, printed at the field\'s precision');
        $this->assertSame('5.0', gcblite_number(5.0, true, 1));
        $this->assertSame('5.0', gcblite_number('5', true, 1), 'a stored "5" at a one-decimal field');
        $this->assertSame('4.90', gcblite_number('4.9', true, 2), 'padded up to the field\'s precision');
        $this->assertSame('4.9', gcblite_number('4.94', true, 1), 'and rounded down to it');
        $this->assertSame('14,395', gcblite_number('14395', true, 0), 'zero decimals, still grouped');
        $this->assertSame('14,395', gcblite_number('14395.4', true, 0));
        $this->assertSame('1,234.50', gcblite_number(1234.5, true, 2));
        $this->assertSame('0.0', gcblite_number(0, true, 1), 'a real zero at one decimal');
        $this->assertSame('0.1234567', gcblite_number('0.1234567', true, 7), 'no cap: seven decimals asked for, seven printed');
        $this->assertSame('5.0', gcblite_number(5, true, '1'), 'decimals read from JSON may arrive as a string');
    }

    public function test_without_decimals_from_the_control_the_value_keeps_its_own(): void
    {
        $this->assertSame('5.0', gcblite_number('5.0', true, null), 'null is "the control said nothing"');
        $this->assertSame('5', gcblite_number(5, true, null));
        $this->assertSame('4.95', gcblite_number('4.95', true, ''), 'an empty setting is no setting');
        $this->assertSame('4.95', gcblite_number('4.95', true, -1), 'a negative count is no setting');
        $this->assertSame('4.95', gcblite_number('4.95', true, 'two'), 'a word is no setting');
    }

    public function test_decimals_apply_to_numbers_only_and_nothing_still_prints_nothing(): void
    {
        $this->assertSame('', gcblite_number('', true, 1), 'nothing prints nothing, not 0.0');
        $this->assertSame('', gcblite_number(null, true, 1));
        $this->assertSame('n/a', gcblite_number('n/a', true, 1), 'not a number: printed as typed');
        $this->assertSame('&lt;b&gt;', gcblite_number('<b>', true, 1), 'and escaped');
    }

    public function test_an_ungrouped_number_still_takes_the_controls_decimals(): void
    {
        $this->assertSame('2002', gcblite_number(2002, false, 0), 'a year: no grouping, no decimals');
        $this->assertSame('5.0', gcblite_number(5, false, 1), 'ungrouped, at the field\'s precision');
        $this->assertSame('12345.50', gcblite_number('12345.5', false, 2), 'no thousands separator');
        $this->assertSame('2002', gcblite_number('2002', false, null), 'no decimals given: as typed, as before');
    }

    public function test_a_value_that_is_not_a_number_is_left_as_it_is(): void
    {
        $this->assertSame('n/a', gcblite_number('n/a'), 'not read as 0');
        $this->assertSame('&lt;b&gt;', gcblite_number('<b>'), 'and escaped');
        $this->assertSame('14,395', gcblite_number('14,395'), 'already grouped by hand: not a numeric string, printed as typed');
    }

    public function test_a_year_is_the_one_number_nobody_groups(): void
    {
        $this->assertSame('2002', gcblite_number(2002, false));
        $this->assertSame('2002', gcblite_number('2002', false));
        $this->assertSame('', gcblite_number('', false));
        $this->assertSame('&lt;b&gt;', gcblite_number('<b>', false), 'escaped: an ungrouped value is printed as it was typed');
    }

    public function test_an_icon_is_the_filters_answer_then_the_registrys_then_the_drawing(): void
    {
        $fallback = '<svg class="drawn"></svg>';
        add_filter('gcblite_icon_svg', static function ($svg, $name) {
            return $name === 'gcb/bolt-0abc' ? '<svg class="ours" stroke="currentColor"></svg>' : $svg;
        });
        $this->assertSame('<svg class="ours" stroke="currentColor"></svg>', gcblite_icon_svg(['source' => 'wp', 'name' => 'gcb/bolt-0abc'], $fallback), 'ours first, stroke intact');
        $this->assertSame('<svg class="ours" stroke="currentColor"></svg>', gcblite_icon_svg((object) ['name' => 'gcb/bolt-0abc'], $fallback), 'an object from the REST API');
        $this->assertSame('<svg class="ours" stroke="currentColor"></svg>', gcblite_icon_svg('gcb/bolt-0abc', $fallback), 'a bare name, older data');
        $this->assertSame('<svg class="shield"></svg>', gcblite_icon_svg(['name' => 'core/shield'], $fallback), 'the registry for a name that is not ours');
        $this->assertSame($fallback, gcblite_icon_svg(['name' => 'core/gone'], $fallback), 'a lost name is not an empty tile');
        $this->assertSame($fallback, gcblite_icon_svg(['name' => ''], $fallback));
        $this->assertSame($fallback, gcblite_icon_svg(null, $fallback));
        $this->assertSame('', gcblite_icon_svg(null), 'nothing stored, nothing drawn, nothing printed');
    }

    public function test_a_field_is_made_editable_by_its_two_attributes(): void
    {
        $this->assertSame('data-gcb-field="heading" data-gcb-field-type="text"', gcblite_field('heading'));
        $this->assertSame('data-gcb-field="a&quot;b" data-gcb-field-type="textarea"', gcblite_field('a"b', 'textarea'));
    }

    public function test_a_textarea_keeps_its_lines_and_loses_its_tags(): void
    {
        $this->assertSame("one<br>\n&lt;b&gt;two&lt;/b&gt;", gcblite_lines("one\n<b>two</b>"));
    }

    public function test_rows_are_label_and_value_with_rules_between_groups(): void
    {
        $this->assertSame(
            [['Volt', '/volt/'], ['Plain', ''], null, ['MOT due', 'December 2026']],
            gcblite_rows("Volt | /volt/\r\n\n  Plain  \n---\nMOT due | December 2026")
        );
        $this->assertSame([['Label', 'a | b']], gcblite_rows('Label | a | b'), 'only the first bar splits');
        $this->assertSame([['-- two dashes', '']], gcblite_rows('-- two dashes'), 'a rule is three dashes or more');
        $this->assertSame([], gcblite_rows(''));
    }
}
