<?php
/**
 * The gcblite/create-block ability is the product-level guard against an
 * external AI agent hand-rolling a WordPress block. The guarantee under test:
 *
 *   1. The ability's input schema describes a block ONLY as typed fields —
 *      there is no `blockJson` / `markup` / `html` / `renderPhp` escape hatch.
 *      An agent literally cannot use this ability to hand-write a bare block.
 *   2. Running it scaffolds a real GCB block, including block.fields.json (the
 *      typed-field schema), via BlockScaffolder.
 *   3. A block with no fields is rejected — a GCB block is its fields.
 *
 * @covers \GCBLite\Abilities\AbilitiesRegistry
 */

// --- Minimal shims only this test needs (the shared bootstrap is WP-free). ---
// Defined in the GLOBAL namespace so AbilitiesRegistry's unqualified calls
// (wp_register_ability(), current_user_can(), is_wp_error()) resolve to them.
namespace {
    if (!function_exists('wp_register_ability')) {
        function wp_register_ability($name, $args) {
            $GLOBALS['__gcb_test_abilities'][$name] = $args;
            return true;
        }
    }
    if (!function_exists('wp_register_ability_category')) {
        function wp_register_ability_category($slug, $args) { return true; }
    }
    if (!function_exists('current_user_can')) {
        function current_user_can($cap) { return $GLOBALS['__gcb_test_can'] ?? true; }
    }
    if (!function_exists('is_wp_error')) {
        function is_wp_error($thing) { return $thing instanceof \WP_Error; }
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
}

namespace GCBLite\Tests\Unit {

use GCBLite\Abilities\AbilitiesRegistry;
use PHPUnit\Framework\TestCase;

class CreateBlockAbilityTest extends TestCase {

    /** @var array<string, array> name => ability args */
    private array $abilities = [];

    protected function setUp(): void {
        $GLOBALS['__gcb_test_abilities'] = [];
        AbilitiesRegistry::register_abilities();
        $this->abilities = $GLOBALS['__gcb_test_abilities'];
    }

    protected function tearDown(): void {
        unset($GLOBALS['__gcb_test_abilities'], $GLOBALS['__gcb_test_stylesheet_dir'], $GLOBALS['__gcb_test_can']);
    }

    public function test_create_block_ability_is_registered(): void {
        $this->assertArrayHasKey('gcblite/create-block', $this->abilities);
    }

    /**
     * The core guarantee: the schema accepts a block described ONLY as typed
     * fields. No raw-markup escape hatch — if one is ever added, this fails.
     */
    public function test_schema_has_no_markup_escape_hatch(): void {
        $props = $this->abilities['gcblite/create-block']['input_schema']['properties'];

        foreach (['blockJson', 'block_json', 'markup', 'html', 'renderPhp', 'render_php', 'content', 'template'] as $forbidden) {
            $this->assertArrayNotHasKey(
                $forbidden,
                $props,
                "create-block must NOT accept `{$forbidden}` — a block is described as typed fields, never raw markup."
            );
        }

        // It must model content as typed fields.
        $this->assertArrayHasKey('fields', $props);
        $this->assertSame('array', $props['fields']['type']);
        $this->assertContains('fields', $this->abilities['gcblite/create-block']['input_schema']['required']);
        $this->assertContains('name', $this->abilities['gcblite/create-block']['input_schema']['required']);
    }

    public function test_executing_scaffolds_a_typed_field_block(): void {
        $dir = sys_get_temp_dir() . '/gcb-ability-' . uniqid();
        mkdir($dir, 0777, true);
        $GLOBALS['__gcb_test_stylesheet_dir'] = $dir;

        $execute = $this->abilities['gcblite/create-block']['execute_callback'];
        $result = $execute([
            'name'   => 'team-card',
            'title'  => 'Team Card',
            'fields' => [
                ['key' => 'heading', 'type' => 'text', 'label' => 'Heading'],
                ['key' => 'photo',   'type' => 'image'],
            ],
            'force'  => true,
        ]);

        $this->assertIsArray($result, 'execute should succeed, not return a WP_Error');
        $this->assertTrue($result['ok']);
        $this->assertSame('gcb/team-card', $result['blockName']);

        // The defining artefact: a block.fields.json was written.
        $fields_file = $result['blockDir'] . '/block.fields.json';
        $this->assertFileExists($fields_file, 'a real GCB block must have a block.fields.json');

        $fields = json_decode(file_get_contents($fields_file), true);
        $keys = array_column($fields['controls'], 'attributeKey');
        $this->assertContains('heading', $keys);
        $this->assertContains('photo', $keys);

        // Each control carries the validator-required shape.
        foreach ($fields['controls'] as $c) {
            $this->assertArrayHasKey('id', $c);
            $this->assertArrayHasKey('type', $c);
            $this->assertArrayHasKey('label', $c);
            $this->assertArrayHasKey('attributeKey', $c);
        }

        // cleanup
        array_map('unlink', glob($result['blockDir'] . '/*'));
        @rmdir($result['blockDir']);
        @rmdir($dir . '/blocks');
        @rmdir($dir);
    }

    public function test_block_with_no_fields_is_rejected(): void {
        $execute = $this->abilities['gcblite/create-block']['execute_callback'];
        $result = $execute(['name' => 'empty-block', 'fields' => []]);
        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertStringContainsString('field', strtolower($result->get_error_message()));
    }
}

} // namespace GCBLite\Tests\Unit
