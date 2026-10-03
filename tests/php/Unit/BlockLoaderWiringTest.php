<?php
/**
 * ONE FILTER FOR EVERY BLOCK, NOT ONE PER BLOCK (2026-10-04).
 *
 * register_one() added two closures per block — one on `block_type_metadata`, one on
 * `register_block_type_args` — each checking "is this my block?". WordPress runs every
 * callback on a filter for every block it registers, so registering N blocks ran N² checks:
 * a site with 2,923 draft blocks spent 1.4 s of every request inside those two filters
 * (GCB Pro's run 20261003-141150-nfnv). What a block needs is kept by its name and one
 * callback on each filter looks it up.
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Blocks\BlockLoader;
use PHPUnit\Framework\TestCase;

if (!defined('GCBLITE_PLUGIN_DIR')) {
    define('GCBLITE_PLUGIN_DIR', dirname(__DIR__, 3) . '/');
}

class BlockLoaderWiringTest extends TestCase {

    protected function setUp(): void {
        BlockLoader::forget_wiring();
        BlockLoader::wire('gcb/hero', [
            'attributes' => ['title' => ['type' => 'string']],
            'parents'    => [],
            'render'     => '/t/blocks/hero/render.php',
        ]);
        BlockLoader::wire('gcb/hero-item', [
            'attributes' => ['label' => ['type' => 'string']],
            'parents'    => ['gcb/hero', 'gcb/hero'],
            'render'     => '',
        ]);
    }

    public function test_a_blocks_metadata_takes_its_own_attributes_and_no_other_blocks() {
        $m = BlockLoader::filter_metadata(['name' => 'gcb/hero', 'attributes' => ['kept' => ['type' => 'number']]]);
        $this->assertSame(['kept', 'title', 'editLayout'], array_keys($m['attributes']), 'the author\'s own attributes stay, ours join, the edit layout defaults');
        $this->assertSame('gcb-lite', $m['editorScript']);
        $this->assertArrayNotHasKey('parent', $m);
        $this->assertIsCallable($m['render_callback'], 'a block with a render.php renders through the crash-safe callback');

        $child = BlockLoader::filter_metadata(['name' => 'gcb/hero-item']);
        $this->assertSame(['label', 'editLayout'], array_keys($child['attributes']));
        $this->assertSame(['gcb/hero'], $child['parent'], 'the parent a repeater declared, once');
        $this->assertArrayNotHasKey('render_callback', $child, 'no render.php, no callback');
    }

    public function test_what_the_author_set_is_left_alone() {
        $m = BlockLoader::filter_metadata([
            'name' => 'gcb/hero-item', 'editorScript' => 'their-own', 'parent' => ['core/group'],
            'attributes' => ['editLayout' => ['type' => 'string', 'default' => 'stacked']],
        ]);
        $this->assertSame('their-own', $m['editorScript']);
        $this->assertSame(['core/group'], $m['parent']);
        $this->assertSame('stacked', $m['attributes']['editLayout']['default']);
        $own = BlockLoader::filter_metadata(['name' => 'gcb/hero', 'render' => 'file:./other.php']);
        $this->assertArrayNotHasKey('render_callback', $own, 'a render the block.json names is the one used');
    }

    public function test_a_block_that_is_not_ours_passes_through_untouched() {
        $theirs = ['name' => 'core/paragraph', 'attributes' => ['content' => ['type' => 'string']]];
        $this->assertSame($theirs, BlockLoader::filter_metadata($theirs));
        $this->assertSame(['x' => 1], BlockLoader::filter_args(['x' => 1], 'core/paragraph'));
        $this->assertSame([], BlockLoader::filter_metadata([]));
    }

    public function test_the_register_args_carry_the_render_callback_wp7_honours() {
        $a = BlockLoader::filter_args([], 'gcb/hero');
        $this->assertIsCallable($a['render_callback']);
        $mine = static function () { return 'mine'; };
        $this->assertSame($mine, BlockLoader::filter_args(['render_callback' => $mine], 'gcb/hero')['render_callback'], 'a callback already there stays');
        $this->assertArrayNotHasKey('render_callback', BlockLoader::filter_args([], 'gcb/hero-item'));
    }

    public function test_registering_a_block_adds_no_filter_of_its_own() {
        $src = (string) file_get_contents(GCBLITE_PLUGIN_DIR . 'includes/Blocks/BlockLoader.php');
        $this->assertSame(1, preg_match('/private static function register_one\(.*?\n    }\n/s', $src, $m));
        $this->assertStringNotContainsString('add_filter(', $m[0], 'a callback per block is N² checks for N blocks');
        $this->assertSame(1, substr_count($src, "add_filter('block_type_metadata'"));
        $this->assertSame(1, substr_count($src, "add_filter('register_block_type_args'"));
    }
}
