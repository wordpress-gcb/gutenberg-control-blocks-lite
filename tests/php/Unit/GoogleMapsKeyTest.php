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

    /* ------------------------------------------------------------------ *
     *  ASKING FOR THE KEY
     *
     *  Mark, 2026-09-21: "just get gcb to ask you for a key and ask you if
     *  it wants to help setting one up."
     *
     *  A `google-map` field with no key degrades to a coordinates box and a
     *  line of small print on a settings page nobody opened. The control was
     *  built, the key was never asked for — the same shape as the three
     *  faults before it, one layer out: the PERSON is the one kept in the
     *  dark this time, not the model.
     *
     *  So: needs_key() is the one place that answers "should we be asking?",
     *  and it only says yes when a map field is actually in use. A site with
     *  no map field is not missing anything and must never be nagged.
     * ------------------------------------------------------------------ */

    public function test_no_map_field_no_ask() {
        $this->assertFalse(
            GoogleMapsKey::needs_key(false),
            'a site with no map field is not missing a key'
        );
    }

    public function test_a_map_field_with_no_key_asks() {
        $this->assertTrue(
            GoogleMapsKey::needs_key(true),
            'a map field with no key is exactly when to ask'
        );
    }

    public function test_a_map_field_with_a_key_does_not_ask() {
        WpStub::set_option('gcblite_google_maps_api_key', 'AIzaTestKey');
        $this->assertFalse(
            GoogleMapsKey::needs_key(true),
            'once a key is set there is nothing to ask for'
        );
    }

    /**
     * THE OFFER OF HELP, in words a person can act on. Not a link dump: the
     * steps, in order, and what each one is for — the thing that turns "get
     * an API key" from a chore into five minutes.
     */
    public function test_the_setup_steps_are_real_instructions() {
        $steps = GoogleMapsKey::setup_steps();

        $this->assertNotEmpty($steps, 'there must be steps to follow');
        $joined = strtolower(implode(' ', $steps));

        foreach (['maps javascript', 'places', 'credential'] as $needle) {
            $this->assertStringContainsString(
                $needle,
                $joined,
                "the steps must mention `{$needle}` — a key without it silently fails in the control"
            );
        }
        $this->assertStringContainsString(
            'restrict',
            $joined,
            'and tell them to restrict it — an unrestricted key on a live site gets scraped and billed'
        );
    }

    /** The console link is the real one, and https. */
    public function test_the_console_link_is_google() {
        $url = GoogleMapsKey::console_url();
        $this->assertStringStartsWith('https://console.cloud.google.com/', $url);
    }
}
