<?php
/**
 * @covers \GCBLite\PostFields\Conditional
 */

namespace GCBLite\Tests\Unit;

use GCBLite\PostFields\Conditional;
use PHPUnit\Framework\TestCase;

class ConditionalTest extends TestCase {

    public function test_no_conditional_logic_always_renders() {
        $this->assertTrue(Conditional::should_render(['type' => 'text'], []));
    }

    public function test_disabled_block_always_renders() {
        $control = ['conditionalLogic' => ['enabled' => false, 'rules' => [['field' => 'x', 'operator' => '==', 'value' => 1]]]];
        $this->assertTrue(Conditional::should_render($control, ['x' => 99]));
    }

    public function test_empty_rules_always_renders() {
        $control = ['conditionalLogic' => ['enabled' => true, 'rules' => []]];
        $this->assertTrue(Conditional::should_render($control, []));
    }

    // ---- equality ----

    public function test_equality_pass() {
        $control = ['conditionalLogic' => ['enabled' => true, 'rules' => [
            ['field' => 'flag', 'operator' => '==', 'value' => true],
        ]]];
        $this->assertTrue(Conditional::should_render($control, ['flag' => true]));
    }

    public function test_equality_fail() {
        $control = ['conditionalLogic' => ['enabled' => true, 'rules' => [
            ['field' => 'flag', 'operator' => '==', 'value' => true],
        ]]];
        $this->assertFalse(Conditional::should_render($control, ['flag' => false]));
    }

    public function test_inequality() {
        $control = ['conditionalLogic' => ['enabled' => true, 'rules' => [
            ['field' => 'tier', 'operator' => '!=', 'value' => 'free'],
        ]]];
        $this->assertTrue(Conditional::should_render($control, ['tier' => 'pro']));
        $this->assertFalse(Conditional::should_render($control, ['tier' => 'free']));
    }

    // ---- numeric comparisons ----

    public function test_greater_than() {
        $control = ['conditionalLogic' => ['enabled' => true, 'rules' => [
            ['field' => 'n', 'operator' => '>', 'value' => 5],
        ]]];
        $this->assertTrue(Conditional::should_render($control, ['n' => 10]));
        $this->assertFalse(Conditional::should_render($control, ['n' => 5]));
        $this->assertFalse(Conditional::should_render($control, ['n' => 3]));
    }

    public function test_gte_lte() {
        $controlGte = ['conditionalLogic' => ['enabled' => true, 'rules' => [
            ['field' => 'n', 'operator' => '>=', 'value' => 5],
        ]]];
        $controlLte = ['conditionalLogic' => ['enabled' => true, 'rules' => [
            ['field' => 'n', 'operator' => '<=', 'value' => 5],
        ]]];
        $this->assertTrue(Conditional::should_render($controlGte, ['n' => 5]));
        $this->assertTrue(Conditional::should_render($controlLte, ['n' => 5]));
    }

    public function test_numeric_comparison_with_non_numeric_actual_fails() {
        $control = ['conditionalLogic' => ['enabled' => true, 'rules' => [
            ['field' => 'n', 'operator' => '>', 'value' => 5],
        ]]];
        $this->assertFalse(Conditional::should_render($control, ['n' => 'not a number']));
    }

    // ---- contains / in ----

    public function test_contains() {
        $control = ['conditionalLogic' => ['enabled' => true, 'rules' => [
            ['field' => 's', 'operator' => 'contains', 'value' => 'vip'],
        ]]];
        $this->assertTrue(Conditional::should_render($control, ['s' => 'this is a vip member']));
        $this->assertFalse(Conditional::should_render($control, ['s' => 'standard']));
    }

    public function test_in_operator() {
        $control = ['conditionalLogic' => ['enabled' => true, 'rules' => [
            ['field' => 'r', 'operator' => 'in', 'value' => ['a', 'b']],
        ]]];
        $this->assertTrue(Conditional::should_render($control, ['r' => 'a']));
        $this->assertTrue(Conditional::should_render($control, ['r' => 'b']));
        $this->assertFalse(Conditional::should_render($control, ['r' => 'c']));
    }

    public function test_in_with_non_array_value_fails() {
        // Config error: `in` with a scalar value should not crash.
        $control = ['conditionalLogic' => ['enabled' => true, 'rules' => [
            ['field' => 'r', 'operator' => 'in', 'value' => 'a'],
        ]]];
        $this->assertFalse(Conditional::should_render($control, ['r' => 'a']));
    }

    // ---- AND / OR ----

    public function test_and_default_all_must_pass() {
        $control = ['conditionalLogic' => ['enabled' => true, 'rules' => [
            ['field' => 'a', 'operator' => '==', 'value' => 1],
            ['field' => 'b', 'operator' => '==', 'value' => 2],
        ]]];
        $this->assertTrue(Conditional::should_render($control, ['a' => 1, 'b' => 2]));
        $this->assertFalse(Conditional::should_render($control, ['a' => 1, 'b' => 99]));
    }

    public function test_or_any_passes() {
        $control = ['conditionalLogic' => ['enabled' => true, 'operator' => 'or', 'rules' => [
            ['field' => 'a', 'operator' => '==', 'value' => 1],
            ['field' => 'b', 'operator' => '==', 'value' => 2],
        ]]];
        $this->assertTrue(Conditional::should_render($control, ['a' => 1, 'b' => 99]));
        $this->assertTrue(Conditional::should_render($control, ['a' => 99, 'b' => 2]));
        $this->assertFalse(Conditional::should_render($control, ['a' => 99, 'b' => 99]));
    }

    public function test_unknown_operator_treated_as_true() {
        // Defensive: don't fail closed on a typo in author config; render
        // the field instead so the bug is visible rather than hidden.
        $control = ['conditionalLogic' => ['enabled' => true, 'rules' => [
            ['field' => 'a', 'operator' => 'nonsense', 'value' => 1],
        ]]];
        $this->assertTrue(Conditional::should_render($control, []));
    }

    public function test_missing_field_in_attributes() {
        // Referenced field doesn't exist (e.g. block hasn't been saved yet);
        // actual is null, so == against any value fails.
        $control = ['conditionalLogic' => ['enabled' => true, 'rules' => [
            ['field' => 'doesnt_exist', 'operator' => '==', 'value' => 'anything'],
        ]]];
        $this->assertFalse(Conditional::should_render($control, []));
    }
}
