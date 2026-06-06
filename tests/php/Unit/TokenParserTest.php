<?php

namespace GCBLite\Tests\Unit;

use GCBLite\Tokens\TokenParser;
use PHPUnit\Framework\TestCase;

/**
 * Covers the theme.json → token-tree parsers. The colour and typography parsers
 * are the new pieces (the old TokenParser only read custom.* + spacing); these
 * are what the field token-picker surfaces.
 */
class TokenParserTest extends TestCase {

    public function test_color_palette_parses_to_color_group(): void {
        $palette = [
            ['slug' => 'primary',   'color' => '#5956E9', 'name' => 'Primary'],
            ['slug' => 'accent-1',  'color' => '#FFDC60', 'name' => 'Accent 1'],
            ['no-slug' => true], // skipped
        ];
        $out = TokenParser::parse_color_tokens($palette);

        $tokens = $out['color']['children']['palette']['tokens'];
        $this->assertCount(2, $tokens, 'entries without a slug are skipped');

        $primary = $tokens[0];
        $this->assertSame('primary', $primary['key']);
        $this->assertSame('#5956E9', $primary['value']);
        $this->assertSame('var(--wp--preset--color--primary)', $primary['cssVar']);
        $this->assertSame('#5956E9', $primary['swatch']);
        $this->assertStringContainsString('Primary', $primary['label']);
        $this->assertStringContainsString('#5956E9', $primary['label']);
    }

    public function test_color_derives_name_from_slug_when_missing(): void {
        $out = TokenParser::parse_color_tokens([['slug' => 'blue-shade', 'color' => '#6865FF']]);
        $tok = $out['color']['children']['palette']['tokens'][0];
        $this->assertStringContainsString('Blue Shade', $tok['label']);
    }

    public function test_empty_palette_yields_no_group(): void {
        $this->assertSame([], TokenParser::parse_color_tokens([]));
        $this->assertSame([], TokenParser::parse_color_tokens([['no-slug' => 1]]));
    }

    public function test_font_sizes_parse_to_typography_group(): void {
        $sizes = [
            ['slug' => 'body', 'size' => '16px', 'name' => 'Body'],
            ['slug' => 'h5',   'size' => '24px', 'name' => 'H5'],
        ];
        $out = TokenParser::parse_typography_tokens($sizes);

        $tokens = $out['typography']['children']['fontSize']['tokens'];
        $this->assertCount(2, $tokens);
        $this->assertSame('h5', $tokens[1]['key']);
        $this->assertSame('24px', $tokens[1]['value']);
        $this->assertSame('var(--wp--preset--font-size--h5)', $tokens[1]['cssVar']);
        $this->assertStringContainsString('24px', $tokens[1]['label']);
    }

    public function test_empty_font_sizes_yield_no_group(): void {
        $this->assertSame([], TokenParser::parse_typography_tokens([]));
    }

    public function test_spacing_still_parses(): void {
        $out = TokenParser::parse_spacing_tokens([
            ['slug' => '30', 'size' => '1rem', 'name' => 'Medium'],
        ]);
        $tok = $out['spacing']['children']['presets']['tokens'][0];
        $this->assertSame('var(--wp--preset--spacing--30)', $tok['cssVar']);
    }
}
