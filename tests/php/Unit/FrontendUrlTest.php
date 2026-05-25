<?php
/**
 * @covers \GCBLite\Frontend\Url
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Frontend\Url;
use GCBLite\Tests\WpStub;
use PHPUnit\Framework\TestCase;

class FrontendUrlTest extends TestCase {

    protected function setUp(): void {
        WpStub::reset();
    }

    public function test_empty_when_nothing_configured() {
        $this->assertSame('', Url::get());
        $this->assertFalse(Url::is_configured());
    }

    public function test_option_value_used() {
        WpStub::set_option('gcblite_frontend_url', 'https://example.com');
        $this->assertSame('https://example.com', Url::get());
        $this->assertTrue(Url::is_configured());
    }

    public function test_filter_overrides_option() {
        WpStub::set_option('gcblite_frontend_url', 'https://from-option.com');
        WpStub::add_filter('gcblite_frontend_url', fn() => 'https://from-filter.com');
        $this->assertSame('https://from-filter.com', Url::get());
    }

    public function test_sanitize_strips_trailing_slash() {
        $this->assertSame('https://example.com', Url::sanitize('https://example.com/'));
        $this->assertSame('https://example.com/path', Url::sanitize('https://example.com/path/'));
    }

    public function test_sanitize_rejects_non_http() {
        // esc_url_raw shim allows http/https only.
        $this->assertSame('', Url::sanitize('javascript:alert(1)'));
        $this->assertSame('', Url::sanitize('mailto:test@example.com'));
    }

    public function test_sanitize_empty() {
        $this->assertSame('', Url::sanitize(''));
        $this->assertSame('', Url::sanitize('   '));
    }
}
