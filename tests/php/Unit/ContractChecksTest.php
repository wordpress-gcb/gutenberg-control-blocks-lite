<?php
/**
 * CONTRACT CHECKS (2026-10-07, TODO.md "Extension points" 3): a field type
 * says what it needs from the block around it, and a block that doesn't
 * provide it is told so — the gate docs/hotspot-field.md §9 asked for.
 *
 * @covers \GCBLite\Fields\ContractChecks
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Blocks\BlockLoader;
use GCBLite\Fields\ContractChecks;
use GCBLite\Fields\ControlTypes;
use GCBLite\Tests\WpStub;
use PHPUnit\Framework\TestCase;

if (!defined('GCBLITE_PLUGIN_DIR')) {
    define('GCBLITE_PLUGIN_DIR', dirname(__DIR__, 3) . '/');
}

class ContractChecksTest extends TestCase {

    protected function setUp(): void {
        WpStub::reset();
        ControlTypes::reset();
        BlockLoader::forget_blocks();
    }

    protected function tearDown(): void {
        BlockLoader::forget_blocks();
        ControlTypes::reset();
    }

    private function block(string $name, array $controls, array $children = []) {
        BlockLoader::remember_block($name, ['fields' => ['controls' => $controls], 'children' => $children]);
    }

    private function map(array $extra = []) {
        return array_merge(['id' => 'm', 'type' => 'pin-map', 'label' => 'Map', 'attributeKey' => 'map'], $extra);
    }

    private function messages(?array $only = null) {
        return array_column(ContractChecks::run($only), 'message');
    }

    public function test_a_pin_map_with_nothing_to_place_is_told_what_to_add() {
        $this->block('gcb/map', [$this->map()]);
        $m = $this->messages();
        $this->assertCount(1, $m);
        $this->assertStringContainsString('no child blocks to place', $m[0]);
        $this->assertStringContainsString('<Repeater', $m[0]);
    }

    public function test_single_mode_needs_a_declared_point_on_the_child() {
        $this->block('gcb/map', [$this->map()], ['gcb/pin']);
        $this->block('gcb/pin', [['id' => 't', 'type' => 'text', 'label' => 'T', 'attributeKey' => 'title']]);
        $this->assertStringContainsString('needs a point field `point`', $this->messages()[0]);

        $this->block('gcb/pin', [['id' => 'p', 'type' => 'point', 'label' => 'P', 'attributeKey' => 'point']]);
        $this->assertSame([], $this->messages());
    }

    public function test_grouped_mode_needs_the_repeater_and_a_point_row_key_if_declared() {
        $this->block('gcb/map', [$this->map(['pointsKey' => 'locations'])], ['gcb/card']);
        $this->block('gcb/card', [['id' => 't', 'type' => 'text', 'label' => 'T', 'attributeKey' => 'title']]);
        $this->assertStringContainsString('needs a repeater field `locations`', $this->messages()[0]);

        // Rows without a declared point are fine: the map writes it (the Touchpoint card).
        $this->block('gcb/card', [['id' => 'l', 'type' => 'repeater', 'label' => 'L', 'attributeKey' => 'locations', 'fields' => [['attributeKey' => 'area', 'type' => 'text']]]]);
        $this->assertSame([], $this->messages());

        // Declared as something else, it fights the map.
        $this->block('gcb/card', [['id' => 'l', 'type' => 'repeater', 'label' => 'L', 'attributeKey' => 'locations', 'fields' => [['attributeKey' => 'point', 'type' => 'text']]]]);
        $this->assertStringContainsString('declare `point` as a text field', $this->messages()[0]);
    }

    public function test_child_block_must_be_one_the_block_can_hold() {
        $this->block('gcb/map', [$this->map(['childBlock' => 'gcb/other'])], ['gcb/pin']);
        $this->assertStringContainsString('no <Repeater> in render.php allows it', $this->messages()[0]);
    }

    public function test_a_layout_needs_a_list_to_lay_out() {
        $this->block('gcb/grid', [['id' => 'g', 'type' => 'layout', 'label' => 'L', 'attributeKey' => 'layout']]);
        $this->assertStringContainsString('nothing to lay out', $this->messages()[0]);
        $this->block('gcb/grid', [['id' => 'g', 'type' => 'layout', 'label' => 'L', 'attributeKey' => 'layout']], ['gcb/item']);
        $this->assertSame([], $this->messages());
    }

    public function test_a_registered_type_brings_its_own_check_and_problems_name_the_block_and_field() {
        ControlTypes::register('timeline', ['shape' => 'array', 'check' => function ($control, $ctx) {
            return count($ctx['controls']) > 1 ? [] : ['a timeline needs a heading beside it.'];
        }]);
        $this->block('gcb/history', [['id' => 'tl', 'type' => 'timeline', 'label' => 'T', 'attributeKey' => 'steps']]);
        $this->block('gcb/fine', [['id' => 'tl', 'type' => 'timeline', 'label' => 'T', 'attributeKey' => 'steps'], ['id' => 'h', 'type' => 'text', 'label' => 'H', 'attributeKey' => 'heading']]);
        $this->assertSame(
            [['block' => 'gcb/history', 'field' => 'steps', 'type' => 'timeline', 'message' => 'a timeline needs a heading beside it.']],
            ContractChecks::run()
        );
        $this->assertSame([], ContractChecks::run(['gcb/fine']), 'only the blocks asked about');
    }
}
