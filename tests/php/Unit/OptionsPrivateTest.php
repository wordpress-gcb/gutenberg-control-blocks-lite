<?php
/**
 * A PRIVATE OPTIONS FIELD (2026-10-12): an options page is read in public over REST; a control marked "private" —
 * an API key — is left out of what a visitor can read, and kept for the server.
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Options\Registrar;
use GCBLite\Tests\WpStub;
use PHPUnit\Framework\TestCase;

final class OptionsPrivateTest extends TestCase
{
    public function test_a_private_field_is_kept_from_the_public_read_but_not_from_the_server(): void
    {
        WpStub::reset();
        WpStub::set_option('gcblite_options_reviews_test', ['business_unit' => 'nathanielcars.co.uk', 'api_key' => 'sk-secret']);
        Registrar::register('reviews_test', ['controls' => [
            ['type' => 'text', 'attributeKey' => 'business_unit', 'label' => 'Business unit'],
            ['type' => 'text', 'attributeKey' => 'api_key', 'label' => 'API key', 'private' => true],
            ['type' => 'toggle', 'attributeKey' => 'live', 'label' => 'Live', 'default' => false],
        ]]);
        $this->assertSame(['business_unit' => 'nathanielcars.co.uk', 'api_key' => 'sk-secret', 'live' => false], Registrar::get_values('reviews_test'));
        $this->assertSame(['business_unit' => 'nathanielcars.co.uk', 'live' => false], Registrar::public_values('reviews_test'));
    }
}
