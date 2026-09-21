<?php
/**
 * A BLOCK'S SCRIPT REACHES THE BROWSER AS IT WAS WRITTEN.
 *
 * matrix run mx2 / countdown on Astra, 2026-09-22: "Invalid or unexpected
 * token" on the real page, and only there. kimi wrote `if (diff <= 0)`. A
 * block's script is printed inside post content, and `the_content` runs
 * wptexturize (priority 10) AFTER do_blocks (9): its tag splitter takes a bare
 * `<` for the start of a tag, loses track of the <script>, and from there on
 * rewrites every `&&` as `&#038;&#038;` — including the `&&` in the wrapper
 * WE put round every handler. One comparison, and the whole block is dead on
 * every real front end; the Studio and the editor never run the_content, so
 * nothing before the front look could see it.
 *
 * WordPress MEANS to leave <script> alone. So the scripts are lifted out of
 * the content before the text filters see it and put back, byte for byte,
 * after the last of them.
 *
 * MOVED HERE FROM gcb-pro 2026-09-22 (Mark): a block ejected to a site that
 * runs only gcb-lite still carries its inline script, and had no shelter. The
 * blocks are lite's to render, so the guarantee is lite's to give.
 *
 * @package GCBLite\Tests
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Rendering\ScriptShelter;
use PHPUnit\Framework\TestCase;

final class ScriptShelterTest extends TestCase
{
    private const SCRIPT = "<script data-x=\"1\">if (diff <= 0) { stop(); }\nif (a&&b) { go('it\\'s'); } /* 8) */</script>";

    protected function setUp(): void
    {
        ScriptShelter::reset();
    }

    public function test_the_script_is_out_of_the_content_while_the_text_filters_run(): void
    {
        $html = '<div class="gcb-block"><p>Tom & Jerry</p>' . self::SCRIPT . '</div>';
        $held = ScriptShelter::shelter($html);
        $this->assertStringNotContainsString('<script', $held);
        $this->assertStringNotContainsString('&&', $held);
        $this->assertStringContainsString('<p>Tom & Jerry</p>', $held, 'everything else is left for WordPress to do what it does');
    }

    public function test_it_comes_back_byte_for_byte(): void
    {
        $html = '<div>' . self::SCRIPT . '<p>after</p><script>var second = 1 < 2;</script></div>';
        $this->assertSame($html, ScriptShelter::restore(ScriptShelter::shelter($html)));
    }

    public function test_it_survives_what_a_text_filter_does_to_the_rest(): void
    {
        $held = ScriptShelter::shelter('<p>"quoted" & more</p>' . self::SCRIPT);
        /* stand-in for wptexturize: curls quotes and encodes ampersands everywhere it can */
        $filtered = str_replace(array('"', ' & '), array('&#8221;', ' &#038; '), $held);
        $out = ScriptShelter::restore($filtered);
        $this->assertStringContainsString(self::SCRIPT, $out, 'the script is exactly as written');
        $this->assertStringContainsString('&#038; more', $out, 'and the prose was still filtered');
    }

    public function test_content_with_no_script_is_not_touched(): void
    {
        $html = '<p>Nothing to shelter</p>';
        $this->assertSame($html, ScriptShelter::shelter($html));
        $this->assertSame($html, ScriptShelter::restore($html));
    }

    public function test_a_script_with_a_src_is_none_of_its_business(): void
    {
        $html = '<script src="https://example.com/a.js"></script><p>x</p>';
        $this->assertSame($html, ScriptShelter::shelter($html));
    }

    /**
     * AMENDED THE SAME NIGHT (mx3 / hero on Twenty Twenty-Five: the same
     * "Invalid or unexpected token", after the fix). A BLOCK THEME texturizes
     * TWICE: `get_the_block_template_html()` runs do_blocks over the whole
     * template and then wptexturize over the whole PAGE, with no hook between —
     * long after the_content had handed the script back. So the shelter moved:
     * a gcb block's script is lifted out as the BLOCK renders (wherever it
     * renders — post content, a template part, a pattern) and put back once,
     * at the very end of the page, from an output buffer. With no page being
     * assembled (REST, the editor's renderer, CLI) nothing is lifted, because
     * nothing would put it back.
     */
    public function test_a_gcb_blocks_script_is_lifted_as_the_block_renders(): void
    {
        ScriptShelter::open_for_tests();
        $held = ScriptShelter::shelter_block('<div class="gcb-block">' . self::SCRIPT . '</div>', array('blockName' => 'gcb/hero'));
        $this->assertStringNotContainsString('<script', $held);
        $this->assertSame('<div class="gcb-block">' . self::SCRIPT . '</div>', ScriptShelter::restore($held, 8), 'and the page buffer hands it back (PHP passes a second argument)');
    }

    public function test_another_plugins_block_is_none_of_its_business(): void
    {
        ScriptShelter::open_for_tests();
        $html = '<div>' . self::SCRIPT . '</div>';
        $this->assertSame($html, ScriptShelter::shelter_block($html, array('blockName' => 'core/html')));
    }

    public function test_nothing_is_lifted_when_no_page_will_put_it_back(): void
    {
        /* reset() in setUp: no page is open — a REST render, the editor */
        $html = '<div class="gcb-block">' . self::SCRIPT . '</div>';
        $this->assertSame($html, ScriptShelter::shelter_block($html, array('blockName' => 'gcb/hero')));
    }

    public function test_nested_content_runs_do_not_hand_back_each_others_scripts(): void
    {
        /* the_content can run inside the_content (a query loop): tokens are unique per script */
        $outer = ScriptShelter::shelter('<script>var outer = 1 < 2;</script>');
        $inner = ScriptShelter::shelter('<script>var inner = 3 < 4;</script>');
        $this->assertSame('<script>var inner = 3 < 4;</script>', ScriptShelter::restore($inner));
        $this->assertSame('<script>var outer = 1 < 2;</script>', ScriptShelter::restore($outer));
    }
}
