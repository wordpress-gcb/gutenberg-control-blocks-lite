<?php
/**
 * THE GCB KIT GROUP (Mark, 2026-10-09: "can we include some default blocks as well like the grid block?"): the blocks
 * the plugin ships for a person to arrange by hand sit under one inserter heading, each block.json is sound, each
 * child names its parent, and the three that need a script name the handles KitBlocks registers.
 */

namespace GCBLite\Tests\Unit;

use PHPUnit\Framework\TestCase;

if (!defined('GCBLITE_PLUGIN_DIR')) {
    define('GCBLITE_PLUGIN_DIR', dirname(__DIR__, 3) . '/');
}

class KitBlocksGroupTest extends TestCase {

    private function blocks(): array {
        $out = [];
        foreach (glob(GCBLITE_PLUGIN_DIR . 'blocks/*/block.json') as $f) {
            $j = json_decode((string) file_get_contents($f), true);
            $this->assertIsArray($j, basename(dirname($f)) . ' block.json is JSON');
            $out[$j['name']] = $j;
        }
        return $out;
    }

    public function test_every_kit_block_sits_in_the_gcb_kit_group() {
        $blocks = $this->blocks();
        foreach (['gcb/layout', 'gcb/carousel', 'gcb/tabs', 'gcb/accordion', 'gcb/icon-list', 'gcb/map'] as $name) {
            $this->assertArrayHasKey($name, $blocks);
            $this->assertSame('gcb-kit', $blocks[$name]['category'], $name);
        }
    }

    public function test_children_name_their_parent_and_stay_out_of_the_inserter_on_their_own() {
        $blocks = $this->blocks();
        foreach (['gcb/slide' => 'gcb/carousel', 'gcb/tab' => 'gcb/tabs', 'gcb/accordion-item' => 'gcb/accordion', 'gcb/layout-box' => 'gcb/layout'] as $child => $parent) {
            $this->assertSame([$parent], $blocks[$child]['parent'], $child);
        }
    }

    public function test_the_scripted_blocks_name_the_handles_the_plugin_registers_and_ship_the_files() {
        $blocks = $this->blocks();
        foreach (['carousel', 'tabs', 'accordion'] as $b) {
            $this->assertSame('gcblite-' . $b, $blocks['gcb/' . $b]['style']);
            $this->assertSame('gcblite-' . $b . '-view', $blocks['gcb/' . $b]['viewScript']);
            $this->assertFileExists(GCBLITE_PLUGIN_DIR . 'blocks/' . $b . '/style.css');
            $this->assertFileExists(GCBLITE_PLUGIN_DIR . 'blocks/' . $b . '/view.js');
        }
    }

    public function test_the_group_is_added_once_and_first() {
        if (!function_exists('__')) {
            eval('function __($s) { return $s; }');
        }
        require_once GCBLITE_PLUGIN_DIR . 'includes/Blocks/KitBlocks.php';
        $cats = \GCBLite\Blocks\KitBlocks::block_category([['slug' => 'text', 'title' => 'Text'], ['slug' => 'gcb', 'title' => 'GCB']]);
        $this->assertSame('gcb-kit', $cats[0]['slug']);
        $this->assertSame('GCB kit', $cats[0]['title']);
        $this->assertCount(3, $cats);
        $this->assertCount(3, \GCBLite\Blocks\KitBlocks::block_category($cats), 'added once');
    }
}
