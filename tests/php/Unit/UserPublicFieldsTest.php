<?php
/**
 * A PUBLIC USER FIELD (2026-10-20): a person's fields are theirs — the user and an editor read them all — but a
 * control marked "public" (a member's role, their reviews) is read by anyone, for public profiles on marketplace sites.
 * Nothing else goes out, and no field is shown in core's users endpoint.
 */

namespace {
    if (!function_exists('get_user_meta')) {
        function get_user_meta($user_id, $key = '', $single = false) {
            return $GLOBALS['__gcb_test_usermeta'][$user_id][$key] ?? '';
        }
    }
    if (!function_exists('get_current_user_id')) {
        function get_current_user_id() { return $GLOBALS['__gcb_test_user_id'] ?? 0; }
    }
    if (!function_exists('current_user_can')) {
        function current_user_can($cap) { return $GLOBALS['__gcb_test_can'] ?? true; }
    }
    if (!function_exists('register_meta')) {
        function register_meta($type, $key, $args) {
            $GLOBALS['__gcb_test_meta'][$type][$key] = $args;
            return true;
        }
    }
    require_once dirname(__DIR__, 3) . '/includes/User/helpers.php';
}

namespace GCBLite\Tests\Unit {

use GCBLite\User\Registrar;
use PHPUnit\Framework\TestCase;

final class UserPublicFieldsTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__gcb_test_usermeta'] = [7 => ['role_title' => 'Seller', 'phone' => '07700 900123']];
        $GLOBALS['__gcb_test_meta'] = [];
        Registrar::register(['controls' => [
            ['type' => 'text', 'attributeKey' => 'role_title', 'label' => 'Role', 'public' => true],
            ['type' => 'text', 'attributeKey' => 'phone', 'label' => 'Phone'],
            ['type' => 'repeater', 'attributeKey' => 'reviews', 'label' => 'Reviews', 'public' => true, 'default' => []],
            ['type' => 'panel', 'attributeKey' => 'extras', 'label' => 'Extras', 'public' => true],
        ]]);
    }

    protected function tearDown(): void
    {
        unset($GLOBALS['__gcb_test_user_id'], $GLOBALS['__gcb_test_can'], $GLOBALS['__gcb_test_usermeta'], $GLOBALS['__gcb_test_meta']);
    }

    public function test_a_public_field_is_read_by_anyone_and_the_rest_only_by_the_server(): void
    {
        $this->assertSame(['role_title' => 'Seller', 'phone' => '07700 900123', 'reviews' => []], Registrar::get_values(7));
        $this->assertSame(['role_title' => 'Seller', 'reviews' => []], Registrar::public_values(7));
        $this->assertSame(Registrar::get_values(7), \gcblite_get_user_fields(7));
        $this->assertSame(Registrar::public_values(7), \gcblite_get_public_user_fields(7));
    }

    public function test_the_user_and_an_editor_read_every_field_and_a_visitor_does_not(): void
    {
        $GLOBALS['__gcb_test_user_id'] = 7;
        $GLOBALS['__gcb_test_can'] = false;
        $this->assertTrue(Registrar::can_read_all(7), 'the user themself');

        $GLOBALS['__gcb_test_user_id'] = 3;
        $this->assertFalse(Registrar::can_read_all(7), 'another member');

        $GLOBALS['__gcb_test_can'] = true;
        $this->assertTrue(Registrar::can_read_all(7), 'someone with edit_users');

        $GLOBALS['__gcb_test_user_id'] = 0;
        $GLOBALS['__gcb_test_can'] = false;
        $this->assertFalse(Registrar::can_read_all(7), 'a visitor');
    }

    public function test_no_field_is_shown_in_cores_users_endpoint(): void
    {
        $this->assertSame(['role_title', 'phone', 'reviews'], array_keys($GLOBALS['__gcb_test_meta']['user']));
        foreach ($GLOBALS['__gcb_test_meta']['user'] as $args) {
            $this->assertFalse($args['show_in_rest']);
        }
    }

    public function test_with_no_public_field_a_visitor_reads_nothing(): void
    {
        Registrar::register(['controls' => [
            ['type' => 'text', 'attributeKey' => 'phone', 'label' => 'Phone'],
        ]]);
        $this->assertSame([], Registrar::public_values(7));
    }
}

}
