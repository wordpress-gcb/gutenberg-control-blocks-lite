<?php
/**
 * A PART'S SETTING (2026-10-10): a built block's render.php calls gcblite_setting() for a value a person chose in
 * the sidebar instead of carrying the cast, the guard and the ternary inline. The stored word prints when it is
 * safe, else the default; `drawn` prints the drawing's own value; the result is escaped for an attribute.
 */

namespace GCBLite\Tests\Unit;

use PHPUnit\Framework\TestCase;

if (!function_exists('esc_attr')) {
    eval('function esc_attr($u) { return htmlspecialchars((string) $u, ENT_QUOTES); }');
}
require_once dirname(__DIR__, 3) . '/includes/Render/settings.php';

final class RenderSettingsTest extends TestCase
{
    public function test_a_stored_safe_word_prints(): void
    {
        $this->assertSame('right', gcblite_setting(['text_media_text' => 'right'], 'text_media_text', 'left', 'left'));
        $this->assertSame('2.5', gcblite_setting(['counter_duration' => '2.5'], 'counter_duration', '2', '2'), 'digits and a dot');
        $this->assertSame('a_b-c.d', gcblite_setting(['k' => 'a_b-c.d'], 'k', 'x'), 'underscore, hyphen and dot are safe');
        $this->assertSame('abcdefghijkl', gcblite_setting(['k' => 'abcdefghijkl'], 'k', 'x'), 'twelve characters is the most');
        $this->assertSame('55', gcblite_setting(['share' => 55], 'share', '50'), 'a number stored as a number');
    }

    public function test_a_stored_value_that_is_not_a_safe_word_falls_to_the_default(): void
    {
        $this->assertSame('left', gcblite_setting(['k' => 'Right'], 'k', 'left'), 'upper case');
        $this->assertSame('left', gcblite_setting(['k' => 'abcdefghijklm'], 'k', 'left'), 'thirteen characters');
        $this->assertSame('left', gcblite_setting(['k' => ''], 'k', 'left'), 'empty');
        $this->assertSame('left', gcblite_setting(['k' => 'a b'], 'k', 'left'), 'a space');
        $this->assertSame('left', gcblite_setting(['k' => '"><script>'], 'k', 'left'), 'markup');
        $this->assertSame('left', gcblite_setting(['k' => 'über'], 'k', 'left'), 'not ascii');
        $this->assertSame('left', gcblite_setting(['k' => ['right']], 'k', 'left'), 'an array is no word');
        $this->assertSame('left', gcblite_setting(['k' => (object) ['v' => 'right']], 'k', 'left'), 'an object is no word');
        $this->assertSame('left', gcblite_setting(['k' => null], 'k', 'left'));
        $this->assertSame('left', gcblite_setting(['k' => false], 'k', 'left'), 'false casts to an empty string');
    }

    public function test_drawn_prints_the_drawing_s_own_value(): void
    {
        $this->assertSame('center', gcblite_setting(['k' => 'drawn'], 'k', 'left', 'center'), 'stored');
        $this->assertSame('center', gcblite_setting([], 'k', 'drawn', 'center'), 'the default, nothing stored');
        $this->assertSame('center', gcblite_setting(['k' => 'Bad Word'], 'k', 'drawn', 'center'), 'the default, after an unsafe word');
        $this->assertSame('', gcblite_setting(['k' => 'drawn'], 'k', 'left'), 'no drawn value given prints nothing');
        $this->assertSame('ease-in-out', gcblite_setting(['k' => 'drawn'], 'k', 'left', 'ease-in-out'), 'the drawn value is not held to the safe-word rule');
    }

    public function test_a_missing_attribute_is_the_default(): void
    {
        $this->assertSame('left', gcblite_setting([], 'k', 'left'));
        $this->assertSame('left', gcblite_setting(['other' => 'right'], 'k', 'left'));
        $this->assertSame('left', gcblite_setting(null, 'k', 'left'), 'no attributes at all');
        $this->assertSame('left', gcblite_setting('words', 'k', 'left'), 'attributes that are not a list');
        $this->assertSame('', gcblite_setting([], 'k', ''), 'an empty default prints nothing');
    }

    public function test_attributes_may_arrive_as_an_object(): void
    {
        $this->assertSame('right', gcblite_setting((object) ['k' => 'right'], 'k', 'left'), 'from the REST API');
        $this->assertSame('left', gcblite_setting((object) [], 'k', 'left'));
    }

    public function test_the_result_is_escaped_for_an_attribute(): void
    {
        /* a stored word cannot carry markup — the safe-word rule stops it — so escaping only ever bites a default or a drawn value */
        $this->assertSame('a &amp; b', gcblite_setting([], 'k', 'a & b'));
        $this->assertSame('&quot;&gt;x', gcblite_setting(['k' => 'drawn'], 'k', 'left', '">x'));
        $this->assertSame('&lt;b&gt;', gcblite_setting(['k' => '<b>'], 'k', '<b>'), 'the unsafe word falls to a default that is then escaped');
    }
}
