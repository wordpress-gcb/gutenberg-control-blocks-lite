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
}
