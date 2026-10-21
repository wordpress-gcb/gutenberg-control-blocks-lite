<?php
/**
 * A PUBLIC USER FIELD (2026-10-20): a person's fields are theirs — the user and an editor read them all — but a
 * control marked "public" (a member's role, their reviews) is read by anyone, for public profiles on marketplace sites.
 * Nothing else goes out, and no field is shown in core's users endpoint. Anyone else is answered only for a user core
 * shows them (published posts); any other user is the same 404 as one who doesn't exist.
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
    if (!function_exists('register_meta')) {
        function register_meta($type, $key, $args) {
            $GLOBALS['__gcb_test_meta'][$type][$key] = $args;
            return true;
        }
    }
    if (!function_exists('get_userdata')) {
        function get_userdata($user_id) {
            return isset($GLOBALS['__gcb_test_usermeta'][$user_id]) ? (object) ['ID' => (int) $user_id] : false;
        }
    }
    if (!function_exists('get_post_types')) {
        function get_post_types($args = [], $output = 'names') { return ['post' => 'post', 'page' => 'page']; }
    }
    if (!function_exists('count_user_posts')) {
        // As core: a numeric string, published posts of the given types.
        function count_user_posts($user_id, $post_type = 'post', $public_only = false) {
            $GLOBALS['__gcb_test_counted_types'] = $post_type;
            return (string) ($GLOBALS['__gcb_test_posts'][$user_id] ?? 0);
        }
    }
    if (!function_exists('register_rest_route')) {
        function register_rest_route($namespace, $route, $args) {
            $GLOBALS['__gcb_test_routes'][$namespace . $route] = $args;
            return true;
        }
    }
    if (!function_exists('__return_true')) {
        function __return_true() { return true; }
    }
    if (!class_exists('WP_Error')) {
        class WP_Error {
            public $code; public $message; public $data;
            public function __construct($code = '', $message = '', $data = '') {
                $this->code = $code; $this->message = $message; $this->data = $data;
            }
            public function get_error_message() { return $this->message; }
        }
    }
    require_once dirname(__DIR__, 3) . '/includes/User/helpers.php';
}

namespace GCBLite\Tests\Unit {

use GCBLite\Tests\WpStub;
use GCBLite\User\Registrar;
use PHPUnit\Framework\TestCase;

final class UserPublicFieldsTest extends TestCase
{
    private const ROUTE = 'gcblite/v1/users/(?P<user_id>\\d+)/fields';

    protected function setUp(): void
    {
        WpStub::reset();
        // 7 is a seller with listings; 8 a member with none, whom core doesn't show.
        $GLOBALS['__gcb_test_usermeta'] = [
            7 => ['role_title' => 'Seller', 'phone' => '07700 900123'],
            8 => ['role_title' => 'Buyer', 'phone' => '07700 900456'],
        ];
        $GLOBALS['__gcb_test_posts'] = [7 => 3];
        $GLOBALS['__gcb_test_meta'] = [];
        $GLOBALS['__gcb_test_routes'] = [];
        Registrar::register(['controls' => [
            ['type' => 'text', 'attributeKey' => 'role_title', 'label' => 'Role', 'public' => true],
            ['type' => 'text', 'attributeKey' => 'phone', 'label' => 'Phone'],
            ['type' => 'repeater', 'attributeKey' => 'reviews', 'label' => 'Reviews', 'public' => true, 'default' => []],
            ['type' => 'panel', 'attributeKey' => 'extras', 'label' => 'Extras', 'public' => true],
        ]]);
        Registrar::register_rest_routes();
    }

    protected function tearDown(): void
    {
        WpStub::reset();
        unset(
            $GLOBALS['__gcb_test_user_id'], $GLOBALS['__gcb_test_can'], $GLOBALS['__gcb_test_usermeta'],
            $GLOBALS['__gcb_test_meta'], $GLOBALS['__gcb_test_posts'], $GLOBALS['__gcb_test_routes'],
            $GLOBALS['__gcb_test_counted_types']
        );
    }

    /** GET the route as the current visitor: the callback's answer, permission and all. */
    private function get_fields(int $user_id)
    {
        $route = $GLOBALS['__gcb_test_routes'][self::ROUTE];
        $permitted = ($route['permission_callback'])();
        $this->assertTrue($permitted, 'the read is open; who asks decides what comes back');
        $req = new class($user_id) {
            private $id;
            public function __construct($id) { $this->id = $id; }
            public function get_param($name) { return $name === 'user_id' ? (string) $this->id : null; }
        };
        return ($route['callback'])($req);
    }

    private function as_visitor(int $user_id, $can): void
    {
        $GLOBALS['__gcb_test_user_id'] = $user_id;
        $GLOBALS['__gcb_test_can'] = $can;
    }

    public function test_a_public_field_is_read_by_anyone_and_the_rest_only_by_the_server(): void
    {
        $this->assertSame(['role_title' => 'Seller', 'phone' => '07700 900123', 'reviews' => []], Registrar::get_values(7));
        $this->assertSame(['role_title' => 'Seller', 'reviews' => []], Registrar::public_values(7));
        $this->assertSame(Registrar::get_values(7), \gcblite_get_user_fields(7));
        $this->assertSame(Registrar::public_values(7), \gcblite_get_public_user_fields(7));
    }

    public function test_the_user_and_whoever_may_edit_them_read_every_field_and_a_visitor_does_not(): void
    {
        $this->as_visitor(7, false);
        $this->assertTrue(Registrar::can_read_all(7), 'the user themself');

        $this->as_visitor(3, false);
        $this->assertFalse(Registrar::can_read_all(7), 'another member');

        $this->as_visitor(3, ['edit_user:7']);
        $this->assertTrue(Registrar::can_read_all(7), 'someone who may edit_user this user');
        $this->assertFalse(Registrar::can_read_all(8), 'edit_user is asked per user');

        $this->as_visitor(3, ['edit_users', 'list_users']);
        $this->assertFalse(Registrar::can_read_all(7), 'the primitive cap is not what is asked');

        $this->as_visitor(0, false);
        $this->assertFalse(Registrar::can_read_all(7), 'a visitor');
    }

    public function test_the_route_answers_by_who_asks(): void
    {
        $this->as_visitor(0, false);
        $this->assertEquals((object) ['role_title' => 'Seller', 'reviews' => []], $this->get_fields(7), 'anonymous: the public ones');

        $this->as_visitor(7, false);
        $this->assertEquals((object) Registrar::get_values(7), $this->get_fields(7), 'the owner: every field');

        $this->as_visitor(2, ['edit_user:7']);
        $this->assertEquals((object) Registrar::get_values(7), $this->get_fields(7), 'an editor of the user: every field');
    }

    public function test_a_user_core_hides_is_the_same_404_as_one_who_doesnt_exist(): void
    {
        $this->as_visitor(0, false);
        $hidden  = $this->get_fields(8);
        $missing = $this->get_fields(99);
        $this->assertInstanceOf(\WP_Error::class, $missing);
        $this->assertSame(404, $missing->data['status']);
        $this->assertEquals($missing, $hidden, 'nothing tells a hidden user from a missing one');
        $this->assertSame(['post' => 'post', 'page' => 'page'], $GLOBALS['__gcb_test_counted_types'], 'posts counted over the REST post types');

        // Another member is a visitor too.
        $this->as_visitor(3, false);
        $this->assertEquals($missing, $this->get_fields(8));

        // The user themself, and someone who may list users, see them as core does.
        $this->as_visitor(8, false);
        $this->assertEquals((object) Registrar::get_values(8), $this->get_fields(8));
        $this->as_visitor(3, ['list_users']);
        $this->assertEquals((object) ['role_title' => 'Buyer', 'reviews' => []], $this->get_fields(8));
    }

    public function test_a_marketplace_may_make_every_member_public(): void
    {
        add_filter('gcblite_user_is_public', static fn($is_public, $user_id) => true, 10, 2);
        $this->as_visitor(0, false);
        $this->assertEquals((object) ['role_title' => 'Buyer', 'reviews' => []], $this->get_fields(8));
        $this->assertInstanceOf(\WP_Error::class, $this->get_fields(99), 'a missing user is still missing');
    }

    public function test_a_public_field_its_condition_hides_is_not_returned(): void
    {
        $GLOBALS['__gcb_test_usermeta'][7]['show_phone'] = '';
        Registrar::register(['controls' => [
            ['type' => 'toggle', 'attributeKey' => 'show_phone', 'label' => 'Show phone'],
            ['type' => 'text', 'attributeKey' => 'phone', 'label' => 'Phone', 'public' => true,
             'conditionalLogic' => ['enabled' => true, 'rules' => [['field' => 'show_phone', 'operator' => '==', 'value' => true]]]],
        ]]);
        $this->assertSame([], Registrar::public_values(7), 'hidden by a field that is not itself public');

        $GLOBALS['__gcb_test_usermeta'][7]['show_phone'] = '1';
        $this->assertSame(['phone' => '07700 900123'], Registrar::public_values(7));
    }

    public function test_a_public_repeater_keeps_only_its_public_sub_fields_when_any_says(): void
    {
        $rows = [
            ['_id' => 'r1', 'text' => 'Great seller', 'reviewer' => 'Ann', 'reviewer_email' => 'ann@example.com'],
            ['_id' => 'r2', 'text' => 'Slow to reply', 'reviewer' => 'Bob', 'reviewer_email' => 'bob@example.com'],
        ];
        $GLOBALS['__gcb_test_usermeta'][7]['reviews'] = $rows;
        $fields = [
            ['type' => 'textarea', 'attributeKey' => 'text', 'label' => 'Review', 'public' => true],
            ['type' => 'text', 'attributeKey' => 'reviewer', 'label' => 'Name', 'public' => true],
            ['type' => 'email', 'attributeKey' => 'reviewer_email', 'label' => 'Email'],
        ];
        Registrar::register(['controls' => [
            ['type' => 'repeater', 'attributeKey' => 'reviews', 'label' => 'Reviews', 'public' => true, 'fields' => $fields],
        ]]);
        $this->assertSame(['reviews' => [
            ['_id' => 'r1', 'text' => 'Great seller', 'reviewer' => 'Ann'],
            ['_id' => 'r2', 'text' => 'Slow to reply', 'reviewer' => 'Bob'],
        ]], Registrar::public_values(7));

        // No sub-field says: the rows go out whole, as before.
        $whole = array_map(static fn($f) => array_diff_key($f, ['public' => 1]), $fields);
        Registrar::register(['controls' => [
            ['type' => 'repeater', 'attributeKey' => 'reviews', 'label' => 'Reviews', 'public' => true, 'fields' => $whole],
        ]]);
        $this->assertSame(['reviews' => $rows], Registrar::public_values(7));
    }

    public function test_a_plugin_may_drop_rows_from_a_public_value(): void
    {
        $GLOBALS['__gcb_test_usermeta'][7]['reviews'] = [
            ['_id' => 'r1', 'text' => 'Great seller', 'approved' => true],
            ['_id' => 'r2', 'text' => 'Spam', 'approved' => false],
        ];
        add_filter('gcblite_public_user_field_value', static function ($value, $control, $user_id) {
            if ($control['attributeKey'] !== 'reviews' || $user_id !== 7) return $value;
            return array_values(array_filter($value, static fn($row) => !empty($row['approved'])));
        }, 10, 3);
        $this->assertSame(
            [['_id' => 'r1', 'text' => 'Great seller', 'approved' => true]],
            Registrar::public_values(7)['reviews']
        );
        $this->assertCount(2, Registrar::get_values(7)['reviews'], 'the owner\'s read is untouched');
    }

    public function test_a_public_group_makes_its_children_public_unless_one_says_not(): void
    {
        $GLOBALS['__gcb_test_usermeta'][7]['company'] = 'Acme';
        Registrar::register(['controls' => [
            ['type' => 'group', 'id' => 'about', 'label' => 'About', 'public' => true],
            ['type' => 'text', 'attributeKey' => 'role_title', 'label' => 'Role', 'parentPanelId' => 'about'],
            ['type' => 'text', 'attributeKey' => 'phone', 'label' => 'Phone', 'parentPanelId' => 'about', 'public' => false],
            ['type' => 'group', 'id' => 'work', 'label' => 'Work'],
            ['type' => 'text', 'attributeKey' => 'company', 'label' => 'Company', 'parentPanelId' => 'work'],
        ]]);
        $this->assertSame(['role_title' => 'Seller'], Registrar::public_values(7));
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
