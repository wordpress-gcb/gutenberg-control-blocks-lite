<?php

namespace GCBLite\Tests\Unit;

use GCBLite\Tokens\CustomTokenWriter;
use PHPUnit\Framework\TestCase;

/**
 * The custom-token writer. Validation gates run before any filesystem touch, so
 * they're pure; the happy path is exercised against a temp theme.json via the
 * GCBLITE_TEST_STYLESHEET_DIR override (see the shim in the test bootstrap).
 */
class CustomTokenWriterTest extends TestCase {

    private string $dir;

    protected function setUp(): void {
        $this->dir = sys_get_temp_dir() . '/gcb-theme-' . uniqid();
        mkdir($this->dir, 0755, true);
        $GLOBALS['__gcb_test_stylesheet_dir'] = $this->dir;
    }

    protected function tearDown(): void {
        @unlink($this->dir . '/theme.json');
        @unlink($this->dir . '/theme.json.gcbtmp');
        @rmdir($this->dir);
        unset($GLOBALS['__gcb_test_stylesheet_dir']);
    }

    public function test_rejects_invalid_category(): void {
        $r = CustomTokenWriter::add('Bad Cat', 'brand', '#fff');
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('category', strtolower($r['error']));
    }

    public function test_rejects_invalid_slug(): void {
        $r = CustomTokenWriter::add('color', 'Brand Pink!', '#fff');
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('token name', strtolower($r['error']));
    }

    public function test_rejects_empty_value(): void {
        $r = CustomTokenWriter::add('color', 'brand', '   ');
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('value', strtolower($r['error']));
    }

    public function test_errors_when_no_theme_json(): void {
        // dir exists but no theme.json file
        $r = CustomTokenWriter::add('color', 'brand', '#5956E9');
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('theme.json', strtolower($r['error']));
    }

    public function test_writes_token_into_settings_custom(): void {
        file_put_contents($this->dir . '/theme.json', json_encode([
            'version'  => 2,
            'settings' => ['color' => ['palette' => []]],
        ]));

        $r = CustomTokenWriter::add('color', 'brand-pink', '#ff3399', 'Brand Pink');
        $this->assertTrue($r['ok'], $r['error'] ?? '');
        $this->assertSame('var(--wp--custom--color--brand-pink)', $r['css_var']);
        $this->assertSame('brand-pink', $r['token']['key']);

        $written = json_decode(file_get_contents($this->dir . '/theme.json'), true);
        // The new token landed under settings.custom.color.
        $this->assertSame('#ff3399', $written['settings']['custom']['color']['brand-pink']);
        // Existing content is preserved (round-tripped, not blown away).
        $this->assertArrayHasKey('palette', $written['settings']['color']);
        $this->assertSame(2, $written['version']);
        // No temp file left behind.
        $this->assertFileDoesNotExist($this->dir . '/theme.json.gcbtmp');
    }

    public function test_merges_alongside_existing_custom_tokens(): void {
        file_put_contents($this->dir . '/theme.json', json_encode([
            'settings' => ['custom' => ['color' => ['existing' => '#000']]],
        ]));
        $r = CustomTokenWriter::add('color', 'added', '#fff');
        $this->assertTrue($r['ok']);

        $written = json_decode(file_get_contents($this->dir . '/theme.json'), true);
        $this->assertSame('#000', $written['settings']['custom']['color']['existing']);
        $this->assertSame('#fff', $written['settings']['custom']['color']['added']);
    }
}
