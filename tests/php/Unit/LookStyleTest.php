<?php
/**
 * A LOOK FIELD PAINTS A PROPERTY OF ITS ELEMENT (2026-10-24, Mark: "if you've got the same card with a different
 * colour it means it's got a colour field"). The PHP twin of src/controls/look-value.js (tests/js/look.test.js holds
 * the same values); both read the one list, includes/Contract/look-props.json.
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Contract\Fields;
use PHPUnit\Framework\TestCase;

class LookStyleTest extends TestCase {

    public function test_the_properties_are_the_one_list_the_editor_reads() {
        $file = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/includes/Contract/look-props.json'), true);
        $this->assertSame(array_column($file, 'prop'), array_keys(Fields::look_props()));
        $this->assertSame(['color', 'background-color', 'border-color', 'fill', 'stroke', 'background'], array_keys(Fields::look_props()));
    }

    public function test_a_colour_paints_its_property() {
        $this->assertSame('color:#00d4ff', Fields::look_style(['color' => '#00d4ff']));
        $this->assertSame('border-color:var(--wp--preset--color--accent)', Fields::look_style(['border-color' => 'accent']));
        $this->assertSame('fill:rgba(0,0,0,.5);stroke:#fff', Fields::look_style(['fill' => 'rgba(0,0,0,.5)', 'stroke' => '#fff']));
        $this->assertSame('background-image:linear-gradient(90deg,#000,#fff)', Fields::look_style(['background-color' => 'linear-gradient(90deg,#000,#fff)']));
    }

    public function test_a_background_paints_as_the_background_field_does() {
        $this->assertSame(
            'background-image:linear-gradient(to bottom right, #00d4ff, #0070f3)',
            Fields::look_style(['background' => json_decode('{"kind":"gradient","gradient":"linear-gradient(to bottom right, #00d4ff, #0070f3)"}')])
        );
        $this->assertSame('color:#e040fb;background-color:#e040fb;background-image:none', Fields::look_style(['color' => '#e040fb', 'background' => ['kind' => 'color', 'color' => '#e040fb']]));
    }

    public function test_nothing_that_is_not_a_colour_and_no_property_off_the_list() {
        $this->assertSame('', Fields::look_style(['color' => 'x";background:url(evil)']));
        $this->assertSame('', Fields::look_style(['width' => '10px', 'color' => '']));
        $this->assertSame('', Fields::look_style(['color' => ['kind' => 'color']]));
        $this->assertSame('', Fields::look_style(['color' => null]));
    }
}
