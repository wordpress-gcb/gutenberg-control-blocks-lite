<?php
/**
 * The concept docs are the *prose* half of the GCB vocabulary — the
 * pages that explain when to reach for which tool, as opposed to the
 * per-control reference `get-control-docs` already serves.
 *
 * They sat on disk unreachable by any agent while kimi guessed. The
 * guarantee under test:
 *
 *   1. Every concept file on disk is listed, keyed by its basename, and
 *      reachable by its docs-site slug too ("blocks/inner").
 *   2. `get()` returns the BODY, not just frontmatter — the body is the
 *      whole point here (ControlDocs discards it, because for a control
 *      the structured frontmatter IS the doc).
 *   3. The ability mirrors get-control-docs: same category, readonly,
 *      show_in_rest, list-when-called-bare, 404 on an unknown name.
 *   4. `blocks-inner` — the page that settles the InnerBlocks-vs-repeater
 *      call kimi has to make — is present and actually says both halves.
 *
 * @covers \GCBLite\Docs\ConceptDocs
 * @covers \GCBLite\Abilities\AbilitiesRegistry
 */

// --- Minimal shims only this test needs (the shared bootstrap is WP-free). ---
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
    // ConceptDocs resolves its directory from the plugin constant, the
    // same way ControlDocs does. Point it at the real schemas/ dir — the
    // docs themselves are the fixture.
    if (!defined('GCBLITE_PLUGIN_DIR')) {
        define('GCBLITE_PLUGIN_DIR', dirname(__DIR__, 3) . '/');
    }
}

namespace GCBLite\Tests\Unit {

use GCBLite\Abilities\AbilitiesRegistry;
use GCBLite\Docs\ConceptDocs;
use PHPUnit\Framework\TestCase;

class ConceptDocsTest extends TestCase {

    /** @var array<string, array> name => ability args */
    private array $abilities = [];

    protected function setUp(): void {
        $GLOBALS['__gcb_test_abilities'] = [];
        AbilitiesRegistry::register_abilities();
        $this->abilities = $GLOBALS['__gcb_test_abilities'];
    }

    protected function tearDown(): void {
        unset($GLOBALS['__gcb_test_abilities'], $GLOBALS['__gcb_test_can']);
    }

    // ---------------------------------------------------------------
    // The reader
    // ---------------------------------------------------------------

    /**
     * Derived, never retyped: the list is whatever is on disk. If someone
     * adds a concept page, it shows up without touching PHP.
     */
    public function test_list_matches_the_files_on_disk(): void {
        $on_disk = [];
        foreach (glob(ConceptDocs::dir() . '/*.md') as $path) {
            $name = basename($path, '.md');
            if ($name === 'README') continue;
            $on_disk[] = $name;
        }
        sort($on_disk);

        $this->assertNotEmpty($on_disk, 'No concept docs found — check the schemas/concepts path.');
        $this->assertSame($on_disk, ConceptDocs::list_names());
    }

    public function test_get_returns_title_section_and_body(): void {
        $doc = ConceptDocs::get('blocks-inner');

        $this->assertIsArray($doc);
        $this->assertSame('blocks-inner', $doc['name']);
        $this->assertSame('The InnerBlocks repeater', $doc['title']);
        $this->assertSame('Blocks', $doc['section']);
        $this->assertSame('blocks/inner', $doc['slug']);

        // The body is the whole reason this ability exists. ControlDocs
        // throws it away; here it IS the doc.
        $this->assertArrayHasKey('body', $doc);
        $this->assertStringNotContainsString('---', substr($doc['body'], 0, 4));
        $this->assertGreaterThan(500, strlen($doc['body']));
    }

    /**
     * The page kimi needs most: it has to state BOTH halves of the
     * three-way call, or it cannot settle anything.
     */
    public function test_inner_blocks_doc_states_both_halves_of_the_call(): void {
        $body = ConceptDocs::get('blocks-inner')['body'];

        $this->assertStringContainsString('innerBlocks', $body);
        $this->assertStringContainsString('repeater', strtolower($body));
    }

    /** The docs site addresses these by slug; accept that spelling too. */
    public function test_get_accepts_the_docs_site_slug(): void {
        $this->assertSame(
            ConceptDocs::get('blocks-inner'),
            ConceptDocs::get('blocks/inner')
        );
    }

    public function test_get_returns_null_for_an_unknown_name(): void {
        $this->assertNull(ConceptDocs::get('no-such-concept'));
    }

    /** No path escapes: a name is a name, not a traversal. */
    public function test_get_refuses_path_traversal(): void {
        $this->assertNull(ConceptDocs::get('../controls/number'));
        $this->assertNull(ConceptDocs::get('../../gcb-lite'));
    }

    // ---------------------------------------------------------------
    // The ability — mirrors get-control-docs exactly
    // ---------------------------------------------------------------

    public function test_ability_is_registered_and_mirrors_control_docs(): void {
        $this->assertArrayHasKey('gcblite/get-concept-docs', $this->abilities);

        $concept = $this->abilities['gcblite/get-concept-docs'];
        $control = $this->abilities['gcblite/get-control-docs'];

        $this->assertSame($control['category'], $concept['category']);
        $this->assertTrue($concept['meta']['annotations']['readonly']);
        $this->assertTrue($concept['meta']['show_in_rest']);
        // Published prose — same exposure level as the docs site, and
        // the same gate (or lack of one) get-control-docs uses.
        $this->assertSame('__return_true', $concept['permission_callback']);
        $this->assertSame($control['permission_callback'], $concept['permission_callback']);
    }

    public function test_ability_lists_every_concept_when_called_bare(): void {
        $run = $this->abilities['gcblite/get-concept-docs']['execute_callback'];

        $out = $run([]);
        $this->assertArrayHasKey('concepts', $out);
        $this->assertSame(ConceptDocs::list_names(), array_column($out['concepts'], 'name'));

        // A bare list is a menu: each row must say what the page is for,
        // or an agent has to fetch all 16 to find out.
        foreach ($out['concepts'] as $row) {
            $this->assertNotSame('', $row['title']);
        }

        // Null input is the same as no input (the WP 7 validator allows it).
        $this->assertSame($out, $run(null));
    }

    public function test_ability_returns_one_doc_by_name(): void {
        $run = $this->abilities['gcblite/get-concept-docs']['execute_callback'];

        $out = $run(['name' => 'blocks-inner']);
        $this->assertSame('The InnerBlocks repeater', $out['docs']['title']);
        $this->assertStringContainsString('innerBlocks', $out['docs']['body']);
    }

    public function test_ability_errors_on_an_unknown_name(): void {
        $run = $this->abilities['gcblite/get-concept-docs']['execute_callback'];

        $out = $run(['name' => 'no-such-concept']);
        $this->assertInstanceOf(\WP_Error::class, $out);
        // The error has to name the way out, or the agent just retries.
        $this->assertStringContainsString('no-such-concept', $out->get_error_message());
    }
}

}
