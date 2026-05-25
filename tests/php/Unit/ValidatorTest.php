<?php
/**
 * @covers \GCBLite\PostFields\Validator
 */

namespace GCBLite\Tests\Unit;

use GCBLite\PostFields\Validator;
use GCBLite\Tests\WpStub;
use PHPUnit\Framework\TestCase;

class ValidatorTest extends TestCase {

    protected function setUp(): void {
        WpStub::reset();
    }

    // ---- required ----

    public function test_no_validation_block_is_always_ok() {
        $result = Validator::validate_one(['type' => 'text', 'attributeKey' => 'k'], '');
        $this->assertTrue($result['ok']);
    }

    public function test_required_string_empty_fails() {
        $result = Validator::validate_one(
            ['type' => 'text', 'attributeKey' => 'k', 'label' => 'Field', 'validation' => ['required' => true]],
            ''
        );
        $this->assertFalse($result['ok']);
        $this->assertStringContainsString('Field', $result['message']);
    }

    public function test_required_string_populated_ok() {
        $result = Validator::validate_one(
            ['type' => 'text', 'attributeKey' => 'k', 'validation' => ['required' => true]],
            'hello'
        );
        $this->assertTrue($result['ok']);
    }

    public function test_required_zero_string_counts_as_filled() {
        // "0" is a valid value (e.g. a slider at zero); not empty.
        $result = Validator::validate_one(
            ['type' => 'text', 'attributeKey' => 'k', 'validation' => ['required' => true]],
            '0'
        );
        $this->assertTrue($result['ok']);
    }

    public function test_required_boolean_false_counts_as_filled() {
        // toggle = false is a real saved value, not empty.
        $result = Validator::validate_one(
            ['type' => 'toggle', 'attributeKey' => 'k', 'validation' => ['required' => true]],
            false
        );
        $this->assertTrue($result['ok']);
    }

    public function test_required_empty_array_fails() {
        $result = Validator::validate_one(
            ['type' => 'checkbox-group', 'attributeKey' => 'k', 'label' => 'Tags', 'validation' => ['required' => true]],
            []
        );
        $this->assertFalse($result['ok']);
    }

    public function test_required_url_shape_with_no_url_fails() {
        // URL control stores { url, text, opensInNewTab }. An object with
        // empty `url` should be treated as empty.
        $result = Validator::validate_one(
            ['type' => 'url', 'attributeKey' => 'k', 'label' => 'Link', 'validation' => ['required' => true]],
            ['url' => '', 'text' => '', 'opensInNewTab' => false]
        );
        $this->assertFalse($result['ok']);
    }

    public function test_required_url_shape_with_url_set_ok() {
        $result = Validator::validate_one(
            ['type' => 'url', 'attributeKey' => 'k', 'validation' => ['required' => true]],
            ['url' => 'https://example.com', 'text' => '', 'opensInNewTab' => false]
        );
        $this->assertTrue($result['ok']);
    }

    public function test_required_custom_message() {
        $result = Validator::validate_one(
            ['type' => 'text', 'attributeKey' => 'k', 'label' => 'X', 'validation' => [
                'required' => true,
                'requiredMessage' => 'You must enter X.',
            ]],
            ''
        );
        $this->assertSame('You must enter X.', $result['message']);
    }

    public function test_required_array_form_message() {
        $result = Validator::validate_one(
            ['type' => 'text', 'attributeKey' => 'k', 'label' => 'X', 'validation' => [
                'required' => ['message' => 'Specific message.'],
            ]],
            ''
        );
        $this->assertSame('Specific message.', $result['message']);
    }

    // ---- length ----

    public function test_minLength_failure() {
        $result = Validator::validate_one(
            ['type' => 'text', 'attributeKey' => 'k', 'validation' => ['minLength' => 5]],
            'abc'
        );
        $this->assertFalse($result['ok']);
        $this->assertStringContainsString('5', $result['message']);
    }

    public function test_minLength_pass() {
        $result = Validator::validate_one(
            ['type' => 'text', 'attributeKey' => 'k', 'validation' => ['minLength' => 3]],
            'abcd'
        );
        $this->assertTrue($result['ok']);
    }

    public function test_maxLength_failure() {
        $result = Validator::validate_one(
            ['type' => 'text', 'attributeKey' => 'k', 'validation' => ['maxLength' => 3]],
            'abcde'
        );
        $this->assertFalse($result['ok']);
    }

    public function test_empty_optional_field_passes_length_checks() {
        // minLength on an empty optional field is fine — the value is
        // empty by intent, not "too short".
        $result = Validator::validate_one(
            ['type' => 'text', 'attributeKey' => 'k', 'validation' => ['minLength' => 5]],
            ''
        );
        $this->assertTrue($result['ok']);
    }

    // ---- numeric range ----

    public function test_min_failure() {
        $result = Validator::validate_one(
            ['type' => 'number', 'attributeKey' => 'k', 'validation' => ['min' => 10]],
            5
        );
        $this->assertFalse($result['ok']);
        $this->assertStringContainsString('10', $result['message']);
    }

    public function test_max_failure() {
        $result = Validator::validate_one(
            ['type' => 'number', 'attributeKey' => 'k', 'validation' => ['max' => 100]],
            500
        );
        $this->assertFalse($result['ok']);
    }

    public function test_min_string_coercion() {
        // Number control sometimes stores a numeric string.
        $result = Validator::validate_one(
            ['type' => 'number', 'attributeKey' => 'k', 'validation' => ['min' => 0]],
            '5'
        );
        $this->assertTrue($result['ok']);
    }

    public function test_min_with_zero_ok() {
        $result = Validator::validate_one(
            ['type' => 'number', 'attributeKey' => 'k', 'validation' => ['min' => 0, 'max' => 10]],
            0
        );
        $this->assertTrue($result['ok']);
    }

    // ---- pattern ----

    public function test_pattern_failure_uses_default_message() {
        $result = Validator::validate_one(
            ['type' => 'text', 'attributeKey' => 'k', 'validation' => ['pattern' => '^[A-Z]']],
            'lowercase'
        );
        $this->assertFalse($result['ok']);
        $this->assertSame('Value does not match the required format.', $result['message']);
    }

    public function test_pattern_failure_uses_custom_message() {
        $result = Validator::validate_one(
            ['type' => 'text', 'attributeKey' => 'k', 'validation' => [
                'pattern' => '^[A-Z]',
                'patternMessage' => 'Start with a capital letter.',
            ]],
            'lowercase'
        );
        $this->assertSame('Start with a capital letter.', $result['message']);
    }

    public function test_pattern_pass() {
        $result = Validator::validate_one(
            ['type' => 'text', 'attributeKey' => 'k', 'validation' => ['pattern' => '^[A-Z]']],
            'Capital'
        );
        $this->assertTrue($result['ok']);
    }

    public function test_invalid_pattern_regex_is_skipped_not_fatal() {
        // Author wrote an invalid regex — we should NOT block save on
        // their config error; treat it as no constraint.
        $result = @Validator::validate_one(
            ['type' => 'text', 'attributeKey' => 'k', 'validation' => ['pattern' => '[unclosed']],
            'anything'
        );
        $this->assertTrue($result['ok']);
    }

    // ---- validate_all ----

    public function test_validate_all_skips_structural_controls() {
        $controls = [
            ['type' => 'group', 'id' => 'g', 'label' => 'Group'],
            ['type' => 'text', 'attributeKey' => 'k', 'label' => 'F', 'validation' => ['required' => true]],
        ];
        $result = Validator::validate_all($controls, ['k' => 'set']);
        $this->assertTrue($result['ok']);
    }

    public function test_validate_all_aggregates_errors() {
        $controls = [
            ['type' => 'text', 'attributeKey' => 'a', 'label' => 'A', 'validation' => ['required' => true]],
            ['type' => 'text', 'attributeKey' => 'b', 'label' => 'B', 'validation' => ['required' => true]],
            ['type' => 'text', 'attributeKey' => 'c', 'label' => 'C'],
        ];
        $result = Validator::validate_all($controls, ['c' => 'set']);
        $this->assertFalse($result['ok']);
        $this->assertArrayHasKey('a', $result['errors']);
        $this->assertArrayHasKey('b', $result['errors']);
        $this->assertArrayNotHasKey('c', $result['errors']);
    }

    public function test_validate_all_respects_is_visible() {
        $controls = [
            ['type' => 'text', 'attributeKey' => 'a', 'label' => 'A', 'validation' => ['required' => true]],
        ];
        // Field hidden by conditional logic — validation skipped.
        $result = Validator::validate_all($controls, [], fn($c) => false);
        $this->assertTrue($result['ok']);
    }
}
