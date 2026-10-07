<?php
/**
 * The JSON schema's field-type list is a third reader of the control vocabulary (ControlVocabularyDerivedTest
 * keeps the docs and the validator together). It had drifted by 2026-10-07 — `hotspots` was missing, so an editor
 * validating block.fields.json against the schema flagged a real field. Its enum must be exactly what Lite ships;
 * a type a theme or plugin registers is accepted by the schema's pattern branch and checked by the validator.
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Fields\ControlTypes;
use GCBLite\Validation\BlockGcbValidator;
use PHPUnit\Framework\TestCase;

if (!defined('GCBLITE_PLUGIN_DIR')) {
    define('GCBLITE_PLUGIN_DIR', dirname(__DIR__, 3) . '/');
}

class SchemaTypeEnumTest extends TestCase {

    private function type_schema() {
        $schema = json_decode(file_get_contents(GCBLITE_PLUGIN_DIR . 'schemas/gcb.schema.json'), true);
        $found = null;
        $walk = function ($node) use (&$walk, &$found) {
            if (!is_array($node) || $found !== null) {
                return;
            }
            if (isset($node['type']['anyOf'][0]['enum']) && in_array('text', $node['type']['anyOf'][0]['enum'], true)) {
                $found = $node['type'];
                return;
            }
            foreach ($node as $child) {
                $walk($child);
            }
        };
        $walk($schema);
        $this->assertNotNull($found, 'the field `type` schema (anyOf: [enum, pattern])');
        return $found;
    }

    public function test_the_enum_is_exactly_what_lite_ships() {
        ControlTypes::reset();
        $ships = array_merge(BlockGcbValidator::builtin_types(), BlockGcbValidator::STRUCTURAL_TYPES, array_keys(ControlTypes::all()));
        $ships = array_values(array_unique($ships));
        sort($ships);
        $enum = $this->type_schema()['anyOf'][0]['enum'];
        sort($enum);
        $this->assertSame($ships, $enum);
    }

    public function test_a_registered_name_matches_the_pattern_and_a_malformed_one_does_not() {
        $pattern = '/' . $this->type_schema()['anyOf'][1]['pattern'] . '/';
        $this->assertSame(1, preg_match($pattern, 'timeline'));
        $this->assertSame(1, preg_match($pattern, 'my-field-2'));
        $this->assertSame(0, preg_match($pattern, 'Timeline'));
        $this->assertSame(0, preg_match($pattern, '2col'));
    }
}
