<?php
/**
 * The contract is a promise, so the tests are about the PROMISE, not the
 * delegation. Two things are being defended:
 *
 *   1. Every method delegates to something that actually exists. Writing this
 *      facade, `Sanitizer::sanitize()` was called — a method Lite has never
 *      had (it is per-control: `sanitize_one`). That is the identical failure
 *      to the one the contract exists to fix: gcb-pro has been calling
 *      `Registrar::controls_for()`, also never present, behind a
 *      `method_exists()` guard that turned it into an empty field list.
 *      A reflective sweep catches it; a human reading the file does not.
 *
 *   2. The shapes callers destructure stay put. A consumer reading
 *      `$result['ok']` and `$result['errors']` breaks on a renamed key just
 *      as hard as on a renamed method, and far more quietly.
 *
 * @covers \GCBLite\Contract\Fields
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Contract\Fields;
use GCBLite\Tests\WpStub;
use PHPUnit\Framework\TestCase;

if (!defined('GCBLITE_PLUGIN_DIR')) {
    define('GCBLITE_PLUGIN_DIR', dirname(__DIR__, 3) . '/');
}

class ContractFieldsTest extends TestCase {

    protected function setUp(): void {
        WpStub::reset();
    }

    // ---- the promise that every delegation lands ----

    /**
     * Walk the facade's own source for `Target::method(` and assert each one
     * resolves. This is the test that would have caught Sanitizer::sanitize
     * before it shipped.
     */
    public function test_every_delegation_target_exists() {
        $src = file_get_contents(GCBLITE_PLUGIN_DIR . 'includes/Contract/Fields.php');
        $this->assertIsString($src);

        // Map the file's `use` imports so short names resolve to FQCNs.
        preg_match_all('/^use\s+([\w\\\\]+);/m', $src, $uses);
        $imports = [];
        foreach ($uses[1] as $fqcn) {
            $imports[substr($fqcn, strrpos($fqcn, '\\') + 1)] = $fqcn;
        }
        $this->assertNotEmpty($imports, 'Facade should import its delegation targets.');

        // Strip comments first: the file DISCUSSES methods that don't exist
        // (`Registrar::controls_for()` is named in the header as the bug this
        // fixes). Only executable code is a delegation.
        $code = '';
        foreach (token_get_all($src) as $token) {
            if (is_array($token)) {
                if ($token[0] === T_COMMENT || $token[0] === T_DOC_COMMENT) continue;
                $code .= $token[1];
                continue;
            }
            $code .= $token;
        }

        // Skip self:: — an internal call, not a delegation.
        preg_match_all('/\b([A-Z]\w+)::(\w+)\s*\(/', $code, $calls, PREG_SET_ORDER);

        $checked = 0;
        foreach ($calls as [$_, $class, $method]) {
            if ($class === 'self' || !isset($imports[$class])) continue;
            $fqcn = $imports[$class];

            $this->assertTrue(
                class_exists($fqcn),
                "Contract\\Fields delegates to {$class}, which does not exist."
            );
            $this->assertTrue(
                method_exists($fqcn, $method),
                "Contract\\Fields calls {$class}::{$method}(), which does not exist on {$fqcn}. "
                . 'The facade must delegate to real methods — a guard that swallows this '
                . 'turns a missing method into silently empty data.'
            );
            $checked++;
        }

        $this->assertGreaterThan(8, $checked, 'Expected the facade to delegate widely.');
    }

    /** Constants consumers gate on. */
    public function test_version_and_support_gate() {
        $this->assertMatchesRegularExpression('/^\d+\.\d+\.\d+$/', Fields::VERSION);
        $this->assertTrue(Fields::is_available());
        $this->assertTrue(Fields::supports('1.0.0'));
        $this->assertTrue(Fields::supports('0.9.0'));
        $this->assertFalse(Fields::supports('2.0.0'));
    }

    // ---- vocabulary ----

    public function test_control_types_are_docs_derived() {
        $types = Fields::control_types();

        $this->assertContains('text', $types);
        $this->assertContains('email', $types);
        $this->assertContains('repeater', $types);
        // Structural types are appended by list_types(), not doc files.
        $this->assertContains('panel', $types);
        // Aliases are surfaced too.
        $this->assertContains('heading', $types);
        $this->assertContains('heading-level', $types);
    }

    public function test_control_docs_returns_frontmatter() {
        $docs = Fields::control_docs('email');
        $this->assertIsArray($docs);
        $this->assertSame('email', $docs['type'] ?? null);
        $this->assertArrayHasKey('description', $docs);
    }

    public function test_control_docs_is_null_for_unknown_type() {
        $this->assertNull(Fields::control_docs('no-such-control'));
    }

    /**
     * get() resolves by filename, so an alias has no doc of its own.
     * canonical_type() is the bridge — without it a consumer handed an alias
     * gets null docs and concludes the type is undocumented.
     */
    public function test_canonical_type_resolves_aliases() {
        $this->assertSame('heading-level', Fields::canonical_type('heading'));
        $this->assertSame('text', Fields::canonical_type('textarea'));
    }

    public function test_canonical_type_passes_through_known_and_unknown() {
        $this->assertSame('email', Fields::canonical_type('email'));
        $this->assertSame('no-such-control', Fields::canonical_type('no-such-control'));
    }

    public function test_structural_types() {
        $this->assertSame(['group', 'panel', 'tools-panel'], Fields::structural_types());
        $this->assertTrue(Fields::is_structural('panel'));
        $this->assertFalse(Fields::is_structural('text'));
    }

    // ---- schema validation ----

    public function test_validate_controls_accepts_a_good_schema() {
        $result = Fields::validate_controls([
            ['id' => 'c1', 'type' => 'text',  'attributeKey' => 'name',  'label' => 'Name'],
            ['id' => 'c2', 'type' => 'email', 'attributeKey' => 'email', 'label' => 'Email'],
        ]);

        $this->assertTrue($result['ok'], 'Expected a valid schema to pass.');
        $this->assertSame([], $result['errors']);
    }

    public function test_validate_controls_rejects_an_unknown_type() {
        $result = Fields::validate_controls([
            ['id' => 'c1', 'type' => 'definitely-not-a-control', 'attributeKey' => 'x'],
        ]);

        $this->assertFalse($result['ok']);
        $this->assertNotEmpty($result['errors']);
        // The error shape consumers read.
        $this->assertArrayHasKey('path', $result['errors'][0]);
        $this->assertArrayHasKey('message', $result['errors'][0]);
    }

    /** The alias must be accepted, not just advertised. */
    public function test_validate_controls_accepts_documented_aliases() {
        foreach (['heading', 'heading-level', 'textarea', 'checkbox-group'] as $type) {
            $result = Fields::validate_controls([
                ['id' => 'c1', 'type' => $type, 'attributeKey' => 'k', 'label' => 'L'],
            ]);
            $this->assertTrue(
                $result['ok'],
                "`{$type}` is in control_types() but validate_controls() rejects it."
            );
        }
    }

    // ---- values ----

    public function test_validate_values_flags_a_missing_required_field() {
        $controls = [
            ['type' => 'text', 'attributeKey' => 'name', 'label' => 'Name',
             'validation' => ['required' => true]],
        ];

        $result = Fields::validate_values($controls, ['name' => '']);

        $this->assertFalse($result['ok']);
        $this->assertArrayHasKey('name', $result['errors']);
    }

    public function test_validate_values_passes_when_satisfied() {
        $controls = [
            ['type' => 'text', 'attributeKey' => 'name', 'label' => 'Name',
             'validation' => ['required' => true]],
        ];

        $this->assertTrue(Fields::validate_values($controls, ['name' => 'Mark'])['ok']);
    }

    public function test_validate_value_checks_one_control() {
        $control = ['type' => 'text', 'attributeKey' => 'k', 'label' => 'K',
                    'validation' => ['minLength' => 5]];

        $this->assertFalse(Fields::validate_value($control, 'abc')['ok']);
        $this->assertTrue(Fields::validate_value($control, 'abcdef')['ok']);
    }

    /**
     * A hidden field must not be validated — otherwise a conditional rule can
     * make a form unsubmittable in a way its author cannot see.
     */
    public function test_hidden_fields_can_be_skipped_during_validation() {
        $controls = [
            ['type' => 'toggle', 'attributeKey' => 'is_business', 'label' => 'Business?'],
            ['type' => 'text', 'attributeKey' => 'company', 'label' => 'Company',
             'validation' => ['required' => true],
             'conditionalLogic' => [
                 'enabled' => true,
                 'rules'   => [['field' => 'is_business', 'operator' => '==', 'value' => true]],
             ]],
        ];
        $values = ['is_business' => false, 'company' => ''];

        // Required, but hidden — must pass when visibility is respected.
        $visible = fn($control) => Fields::is_visible($control, $values);
        $this->assertTrue(Fields::validate_values($controls, $values, $visible)['ok']);

        // Without the visibility closure the same input fails.
        $this->assertFalse(Fields::validate_values($controls, $values)['ok']);
    }

    public function test_is_visible_reads_conditional_logic() {
        $control = [
            'type' => 'text', 'attributeKey' => 'company',
            'conditionalLogic' => [
                'enabled' => true,
                'rules'   => [['field' => 'is_business', 'operator' => '==', 'value' => true]],
            ],
        ];

        $this->assertTrue(Fields::is_visible($control, ['is_business' => true]));
        $this->assertFalse(Fields::is_visible($control, ['is_business' => false]));
        // No conditional logic at all = always visible.
        $this->assertTrue(Fields::is_visible(['type' => 'text'], []));
    }

    // ---- sanitize ----

    public function test_sanitize_keeps_known_keys_and_drops_unknown() {
        $controls = [
            ['type' => 'text',  'attributeKey' => 'name'],
            ['type' => 'email', 'attributeKey' => 'email'],
        ];

        $clean = Fields::sanitize($controls, [
            'name'    => 'Mark',
            'email'   => 'mark@example.com',
            'smuggled' => 'should not survive',
        ]);

        $this->assertSame(['name' => 'Mark', 'email' => 'mark@example.com'], $clean);
        $this->assertArrayNotHasKey('smuggled', $clean);
    }

    public function test_sanitize_skips_structural_controls() {
        $controls = [
            ['type' => 'panel', 'attributeKey' => 'layout_panel', 'label' => 'Layout'],
            ['type' => 'text',  'attributeKey' => 'name'],
        ];

        $clean = Fields::sanitize($controls, ['layout_panel' => 'x', 'name' => 'Mark']);

        $this->assertArrayNotHasKey('layout_panel', $clean, 'Structural controls hold no value.');
        $this->assertSame('Mark', $clean['name']);
    }

    public function test_sanitize_fills_missing_values_rather_than_omitting_them() {
        $controls = [['type' => 'text', 'attributeKey' => 'name']];
        $clean = Fields::sanitize($controls, []);

        $this->assertArrayHasKey('name', $clean, 'A declared field should always be present.');
    }

    // ---- registration ----

    public function test_register_and_read_back_controls() {
        $controls = [['type' => 'text', 'attributeKey' => 'quote', 'label' => 'Quote']];
        Fields::register_post_fields('gcb_test_cpt', ['controls' => $controls]);

        $this->assertSame($controls, Fields::controls_for('gcb_test_cpt'));
        $this->assertArrayHasKey('gcb_test_cpt', Fields::registered_post_fields());
    }

    /**
     * The gcb-pro bug in miniature: asking for an unregistered post type must
     * return an empty array, never null or a warning.
     */
    public function test_controls_for_unregistered_type_is_empty_array() {
        $this->assertSame([], Fields::controls_for('never_registered'));
    }

    public function test_register_ignores_a_config_without_controls() {
        Fields::register_post_fields('gcb_bad_cpt', ['not_controls' => []]);
        $this->assertSame([], Fields::controls_for('gcb_bad_cpt'));
    }

    // ---- tokens ----

    public function test_tokens_returns_an_array_without_wordpress() {
        // wp_get_global_settings() is absent in the unit bootstrap; the
        // contract must degrade to [] rather than fatal.
        $this->assertIsArray(Fields::tokens());
    }
}
