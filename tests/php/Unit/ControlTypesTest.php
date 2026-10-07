<?php
/**
 * THE CONTROL-TYPE REGISTRY (2026-10-07, TODO.md "Extension points" 1).
 *
 * A theme or plugin adds a field type with one call — no edit in core — and
 * the type is typed as an attribute, known to the validator and, with a doc,
 * part of the vocabulary gcb-pro hands its AI. Built-in names can't be taken.
 *
 * @covers \GCBLite\Fields\ControlTypes
 * @covers \GCBLite\Blocks\BlockLoader::attributes_for
 * @covers \GCBLite\Docs\ControlDocs
 * @covers \GCBLite\Validation\BlockGcbValidator::known_types
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Blocks\BlockLoader;
use GCBLite\Docs\ControlDocs;
use GCBLite\Fields\ControlTypes;
use GCBLite\Tests\WpStub;
use GCBLite\Validation\BlockGcbValidator;
use PHPUnit\Framework\TestCase;

if (!defined('GCBLITE_PLUGIN_DIR')) {
    define('GCBLITE_PLUGIN_DIR', dirname(__DIR__, 3) . '/');
}

class ControlTypesTest extends TestCase {

    /** @var string */
    private $doc;

    protected function setUp(): void {
        WpStub::reset();
        ControlTypes::reset();
        $this->doc = tempnam(sys_get_temp_dir(), 'gcbdoc') . '.md';
        file_put_contents($this->doc, "---\ntype: timeline\ntitle: timeline\ndescription: 'Milestones placed along a line.'\nstored: 'array of { at, label }'\naliases:\n  - milestones\n---\n");
    }

    protected function tearDown(): void {
        ControlTypes::reset();
        WpStub::reset();
        @unlink($this->doc);
    }

    private function attrs(array $control) {
        return BlockLoader::attributes_for([array_merge(['id' => 'c', 'attributeKey' => 'k', 'label' => 'K'], $control)])['k'];
    }

    public function test_lites_own_object_fields_are_typed_from_the_registry() {
        foreach (['point', 'hotspots', 'pin-map', 'background', 'layout'] as $type) {
            $this->assertSame('object', ControlTypes::shape($type), $type);
            $this->assertSame('object', $this->attrs(['type' => $type])['type'], "$type is stored as an object, not the SDK's string fallback");
        }
        $this->assertSame(['x' => 0.5, 'y' => 0.5], $this->attrs(['type' => 'point', 'default' => ['x' => 0.5, 'y' => 0.5]])['default'], 'a default of the right shape is kept');
    }

    public function test_a_registered_type_is_typed_with_its_shape() {
        $this->assertTrue(ControlTypes::register('timeline', ['shape' => 'array']));
        $a = $this->attrs(['type' => 'timeline']);
        $this->assertSame('array', $a['type']);
        $this->assertSame([], $a['default']);
        $this->assertSame([], $this->attrs(['type' => 'timeline', 'default' => 'nope'])['default'], 'a default of the wrong shape falls back to the empty value');
    }

    public function test_built_in_and_bad_names_and_shapes_are_refused() {
        $this->assertFalse(ControlTypes::register('text', ['shape' => 'array']), 'a built-in field');
        $this->assertFalse(ControlTypes::register('image', ['shape' => 'string']), 'a built-in field');
        $this->assertFalse(ControlTypes::register('point', ['shape' => 'string']), "Lite's own");
        $this->assertFalse(ControlTypes::register('group', ['shape' => 'object']), 'a structural type');
        $this->assertFalse(ControlTypes::register('Timeline', ['shape' => 'array']), 'not lowercase');
        $this->assertFalse(ControlTypes::register('timeline', ['shape' => 'list']), 'not a WP attribute type');
        $this->assertFalse(ControlTypes::register('timeline', []), 'no shape');
        $this->assertSame('string', $this->attrs(['type' => 'text'])['type'], 'text still stores a string');
    }

    public function test_the_filter_adds_types_but_cannot_retype_built_ins() {
        add_filter('gcblite_control_types', function ($types) {
            $types['rating'] = ['shape' => 'number'];
            $types['image']  = ['shape' => 'string'];
            $types['point']  = ['shape' => 'string'];
            return $types;
        });
        $this->assertSame('number', ControlTypes::shape('rating'));
        $this->assertNull(ControlTypes::shape('image'), 'built-ins are not in the registry');
        $this->assertSame('object', ControlTypes::shape('point'), "Lite's own keep their shape");
        $this->assertSame('object', $this->attrs(['type' => 'image'])['type'], 'the SDK still types image');
    }

    public function test_a_registered_type_with_a_doc_joins_the_vocabulary() {
        ControlTypes::register('timeline', ['shape' => 'array', 'doc' => $this->doc]);
        $types = ControlDocs::list_types();
        $this->assertContains('timeline', $types);
        $this->assertContains('milestones', $types, 'aliases too');
        $this->assertSame('Milestones placed along a line.', ControlDocs::get('timeline')['description']);
        $this->assertContains('timeline', BlockGcbValidator::known_types());
    }

    public function test_without_a_doc_it_is_typed_and_known_but_not_advertised() {
        ControlTypes::register('rating', ['shape' => 'number', 'doc' => '/no/such/file.md']);
        $this->assertSame('number', ControlTypes::shape('rating'));
        $this->assertContains('rating', BlockGcbValidator::known_types());
        $this->assertNotContains('rating', ControlDocs::list_types(), 'no doc, nothing to tell the AI');
    }

    public function test_bundles_load_the_hub_and_the_registered_scripts() {
        ControlTypes::register('timeline', ['shape' => 'array', 'script' => 'my-timeline']);
        ControlTypes::register('rating', ['shape' => 'number', 'script' => 'bad handle!']);
        $this->assertSame(['wp-element', 'gcblite-control-hub', 'my-timeline'], ControlTypes::bundle_deps(['wp-element']));
    }

    private function errors(array $controls) {
        return BlockGcbValidator::validate(['controls' => $controls])['errors'];
    }

    public function test_unknown_types_are_refused_with_the_nearest_real_one() {
        $e = $this->errors([['id' => 'a', 'type' => 'imgae', 'label' => 'A', 'attributeKey' => 'a']]);
        $this->assertCount(1, $e);
        $this->assertSame('controls[0].type', $e[0]['path']);
        $this->assertStringContainsString('Unknown control type `imgae`', $e[0]['message']);
        $this->assertStringContainsString('Did you mean `image`?', $e[0]['message']);

        $far = $this->errors([['id' => 'a', 'type' => 'hologram', 'label' => 'A', 'attributeKey' => 'a']]);
        $this->assertStringNotContainsString('Did you mean', $far[0]['message'], 'no suggestion when nothing is close');
    }

    public function test_built_ins_aliases_lites_own_and_registered_types_pass() {
        ControlTypes::register('timeline', ['shape' => 'array']);
        $controls = [];
        foreach (['text', 'textarea', 'heading', 'image', 'repeater', 'query-loop', 'point', 'hotspots', 'pin-map', 'timeline'] as $i => $t) {
            $controls[] = ['id' => "c{$i}", 'type' => $t, 'label' => 'L', 'attributeKey' => "k{$i}"];
        }
        $controls[] = ['id' => 'g', 'type' => 'group', 'label' => 'G'];
        $this->assertSame([], $this->errors($controls));
    }

    public function test_a_repeaters_row_fields_are_checked_too() {
        $e = $this->errors([[
            'id' => 'r', 'type' => 'repeater', 'label' => 'R', 'attributeKey' => 'rows',
            'fields' => [['attributeKey' => 'a', 'type' => 'text'], ['attributeKey' => 'b', 'type' => 'pointt']],
        ]]);
        $this->assertCount(1, $e);
        $this->assertSame('controls[0].fields[1].type', $e[0]['path']);
        $this->assertStringContainsString('Did you mean `point`?', $e[0]['message']);
    }
}
