<?php
/**
 * @covers \GCBLite\Integrations\GoogleMapsKey
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Integrations\GoogleMapsKey;
use GCBLite\Tests\WpStub;
use PHPUnit\Framework\TestCase;

class GoogleMapsKeyTest extends TestCase {

    protected function setUp(): void {
        WpStub::reset();
    }

    public function test_empty_when_nothing_configured() {
        $this->assertSame('', GoogleMapsKey::get());
        $this->assertFalse(GoogleMapsKey::is_configured());
        $this->assertFalse(GoogleMapsKey::is_overridden());
    }

    public function test_option_value_used_when_no_override() {
        WpStub::set_option('gcblite_google_maps_api_key', 'AIzaTestKey');
        $this->assertSame('AIzaTestKey', GoogleMapsKey::get());
        $this->assertTrue(GoogleMapsKey::is_configured());
        $this->assertFalse(GoogleMapsKey::is_overridden());
    }

    public function test_filter_overrides_option() {
        WpStub::set_option('gcblite_google_maps_api_key', 'option_key');
        WpStub::add_filter('gcblite_google_maps_api_key', fn() => 'filter_key');
        $this->assertSame('filter_key', GoogleMapsKey::get());
        $this->assertTrue(GoogleMapsKey::is_overridden());
    }

    public function test_legacy_filter_still_works() {
        // Old gcb_ filter from the prior plugin shouldn't break for users
        // who hooked it. (Constant-driven case covered separately because
        // PHP can't undefine a constant mid-suite.)
        WpStub::add_filter('gcb_google_maps_api_key', fn() => 'legacy_key');
        $this->assertSame('legacy_key', GoogleMapsKey::get());
        $this->assertTrue(GoogleMapsKey::is_overridden());
    }

    public function test_new_filter_wins_over_legacy() {
        WpStub::add_filter('gcblite_google_maps_api_key', fn() => 'new_filter');
        WpStub::add_filter('gcb_google_maps_api_key', fn() => 'legacy_filter');
        $this->assertSame('new_filter', GoogleMapsKey::get());
    }

    public function test_filter_returning_null_or_empty_falls_through_to_option() {
        WpStub::set_option('gcblite_google_maps_api_key', 'option_key');
        WpStub::add_filter('gcblite_google_maps_api_key', fn() => null);
        WpStub::add_filter('gcb_google_maps_api_key', fn() => '');
        $this->assertSame('option_key', GoogleMapsKey::get());
    }

    public function test_sanitize_strips_unsafe_chars() {
        // Sanitiser allows [A-Za-z0-9_\-]; whitespace and the angle
        // brackets are stripped, but the letters "script" remain.
        // That's fine — Google API keys are alphanumeric so the legal-
        // chars-only filter is the right level of paranoia.
        $this->assertSame('AIzaSyscriptABC123', GoogleMapsKey::sanitize('  AIza Sy<script>ABC123  '));
    }

    public function test_sanitize_strips_quotes_and_brackets() {
        $this->assertSame('AKey', GoogleMapsKey::sanitize('A"K{e}y\''));
    }

    public function test_sanitize_keeps_dashes_and_underscores() {
        $this->assertSame('Key_with-Allowed_Chars', GoogleMapsKey::sanitize('Key_with-Allowed_Chars'));
    }

    public function test_sanitize_empty() {
        $this->assertSame('', GoogleMapsKey::sanitize(''));
        $this->assertSame('', GoogleMapsKey::sanitize('   '));
    }
}
