<?php
/**
 * A BACKGROUND IS A COLOUR, A GRADIENT OR A PICTURE — ONE FIELD, EITHER/OR
 * (Mark, 2026-10-03: "the beige background isn't an image, it's just a colour
 * … a background field that takes image or colour or gradient").
 *
 * The control's doc makes it part of the vocabulary (ControlVocabularyDerivedTest
 * holds the validator to the docs); this test holds the PHP render twin to the
 * JS one (tests/js/background.test.js) — the same value paints the same style
 * in the editor and on the front end — and the attribute to its shape.
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Contract\Fields;
use GCBLite\Blocks\BlockLoader;
use PHPUnit\Framework\TestCase;

if (!defined('GCBLITE_PLUGIN_DIR')) {
    define('GCBLITE_PLUGIN_DIR', dirname(__DIR__, 3) . '/');
}

class BackgroundFieldTest extends TestCase {

    public function test_the_style_each_kind_paints() {
        $this->assertSame('background-color:#6ba136', Fields::background_style(['kind' => 'color', 'color' => '#6ba136']));
        $this->assertSame('background-color:var(--wp--preset--color--accent)', Fields::background_style(['kind' => 'color', 'color' => 'accent']));
        $this->assertSame('background-image:linear-gradient(90deg,#000,#fff)', Fields::background_style(['kind' => 'gradient', 'gradient' => 'linear-gradient(90deg,#000,#fff)']));
        $this->assertSame(
            'background-image:url("https://x.test/a.jpg");background-size:cover;background-position:50% 50%;background-repeat:no-repeat',
            Fields::background_style(['kind' => 'image', 'image' => ['url' => 'https://x.test/a.jpg']])
        );
    }

    public function test_a_picture_keeps_its_settings_and_the_colour_under_it() {
        $this->assertSame(
            'background-color:#6ba136;background-image:url("https://x.test/doodles.png");background-size:auto;background-position:20% 80%;background-repeat:repeat;background-attachment:fixed',
            Fields::background_style([
                'kind'  => 'image',
                'color' => '#6ba136',
                'image' => ['url' => 'https://x.test/doodles.png', 'size' => 'tile', 'isRepeat' => true, 'focalPoint' => ['x' => 0.2, 'y' => 0.8], 'isFixed' => true],
            ])
        );
        $this->assertStringContainsString('background-size:640px', Fields::background_style(['kind' => 'image', 'image' => ['url' => 'https://x.test/a.jpg', 'size' => 'custom', 'customWidth' => '640px']]));
    }

    /** WordPress hands an object attribute to render.php with its nested objects as stdClass (the games section
     *  painted its colour and not its picture, 2026-10-03): objects are read as arrays, all the way down. */
    public function test_a_value_of_objects_as_wordpress_hands_it_is_read() {
        $v = json_decode('{"kind":"image","color":"#f8f0e7","gradient":"","image":{"url":"https://x.test/paper.jpg","size":"cover","focalPoint":{"x":0.5,"y":0.5}}}');
        $this->assertSame(
            'background-color:#f8f0e7;background-image:url("https://x.test/paper.jpg");background-size:cover;background-position:50% 50%;background-repeat:no-repeat',
            Fields::background_style($v)
        );
    }

    /**
     * WORDS OVER A PICTURE GET A SCRIM (Mark, 2026-10-03: "hero needs scrim. we had a rule where if you have
     * text at the front and an arbitrary image at the bg you need some kind of scrim"). The scrim is the TOP
     * background layer — a colour at a strength, or a gradient as given — so it needs no element and sits
     * under nothing but the words. Over a colour or a gradient background there is no picture to hold the
     * words off, so no scrim is laid.
     */
    public function test_a_scrim_is_the_top_layer_over_a_picture() {
        $v = ['kind' => 'image', 'image' => ['url' => 'https://x.test/a.jpg']];
        $this->assertSame(
            'background-image:linear-gradient(rgba(0,0,0,0.3),rgba(0,0,0,0.3)),url("https://x.test/a.jpg");background-size:auto,cover;background-position:0 0,50% 50%;background-repeat:no-repeat,no-repeat',
            Fields::background_style($v, ['color' => '#000000', 'strength' => 30])
        );
        $this->assertStringStartsWith(
            'background-image:linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,0.6)),url("https://x.test/a.jpg")',
            Fields::background_style($v, ['color' => 'linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,0.6))', 'strength' => 30])
        );
        /* strength 0, an empty colour, or no picture: no layer */
        $this->assertSame(Fields::background_style($v), Fields::background_style($v, ['color' => '#000000', 'strength' => 0]));
        $this->assertSame(Fields::background_style($v), Fields::background_style($v, ['color' => '', 'strength' => 30]));
        $this->assertSame('background-color:#6ba136', Fields::background_style(['kind' => 'color', 'color' => '#6ba136'], ['color' => '#000000', 'strength' => 30]));
        /* a tiled picture keeps its tile under the scrim */
        $this->assertStringContainsString('background-size:auto,auto;background-position:0 0,50% 50%;background-repeat:no-repeat,repeat', Fields::background_style(['kind' => 'image', 'image' => ['url' => 'https://x.test/p.webp', 'size' => 'tile', 'isRepeat' => true]], ['color' => '#000', 'strength' => 20]));
        $this->assertStringContainsString('linear-gradient(rgba(0,0,0,0.2),rgba(0,0,0,0.2))', Fields::background_style(['kind' => 'image', 'image' => ['url' => 'https://x.test/p.webp']], ['color' => '#000', 'strength' => 20]));
    }

    public function test_the_kind_falls_to_what_is_there_and_a_bare_string_is_read() {
        $this->assertSame('background-color:#111111', Fields::background_style(['kind' => 'image', 'color' => '#111111']));
        $this->assertSame('background-color:#6ba136', Fields::background_style('#6ba136'));
        $this->assertSame('background-image:linear-gradient(180deg,#000,#fff)', Fields::background_style('linear-gradient(180deg,#000,#fff)'));
    }

    public function test_nothing_to_paint_is_empty_and_an_address_cannot_break_out() {
        $this->assertSame('', Fields::background_style(null));
        $this->assertSame('', Fields::background_style(['kind' => 'color', 'color' => '']));
        $this->assertSame('', Fields::background_style(['kind' => 'image', 'image' => null]));
        $this->assertSame(
            'background-image:url("https://x.test/a%22).jpg");background-size:cover;background-position:50% 50%;background-repeat:no-repeat',
            Fields::background_style(['kind' => 'image', 'image' => ['url' => 'https://x.test/a").jpg']])
        );
        /* a value that would close the style attribute, or a non-CSS gradient, is refused */
        $this->assertSame('', Fields::background_style(['kind' => 'gradient', 'gradient' => '"><script>']));
        $this->assertSame('', Fields::background_style(['kind' => 'color', 'color' => '#fff" onload="x']));
    }

    /**
     * The attribute a block gets for the control is an OBJECT. The SDK's map
     * (vendor) knows nothing of Lite's own controls, so point, hotspots and
     * background came out `string` — and a string attribute holding an object
     * is dropped by the editor on parse.
     */
    public function test_lites_own_object_controls_get_object_attributes() {
        $attrs = BlockLoader::attributes_for([
            ['type' => 'background', 'attributeKey' => 'backdrop'],
            ['type' => 'point', 'attributeKey' => 'pin'],
            ['type' => 'hotspots', 'attributeKey' => 'spots'],
            ['type' => 'text', 'attributeKey' => 'title'],
        ]);
        $this->assertSame('object', $attrs['backdrop']['type']);
        $this->assertSame('object', $attrs['pin']['type']);
        $this->assertSame('object', $attrs['spots']['type']);
        $this->assertSame('string', $attrs['title']['type']);
    }
}
