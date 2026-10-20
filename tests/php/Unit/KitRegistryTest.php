<?php
/**
 * THE KIT, ONE FOLDER A PART (2026-10-20): a part is found by its folder and its part.json — no list to add it to —
 * and a block that draws it brings its look once, the tokens first.
 *
 * @package GCBLite\Tests
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Kit\Registry;
use PHPUnit\Framework\TestCase;

class KitRegistryTest extends TestCase {

    /** @var string a plugin folder of its own */
    private $root;

    protected function setUp(): void {
        $this->root = sys_get_temp_dir() . '/gcb-kit-' . uniqid() . '/';
        $put = function ($file, $body) {
            @mkdir(dirname($this->root . $file), 0777, true);
            file_put_contents($this->root . $file, $body);
        };
        $put('kit/_core/tokens.css', ':root{--gcb-kit-accent:red}');
        $put('kit/tabs/part.json', '{"about":"tabs","needs":"gsap"}');
        $put('kit/tabs/style.css', '.tabs{}');
        $put('kit/tabs/script.js', '/* tabs */');
        $put('kit/grid/part.json', '{"about":"a grid"}');
        $put('kit/grid/style.css', '.grid{}');
        $put('kit/contain/part.json', '{"about":"contained media","mark":"data-gcb-contain="}');
        $put('kit/contain/style.css', '.contain{}');
        $put('kit/pager/part.json', '{"about":"pages"}');
        $put('kit/pager/view.js', '/* source */');
        $put('build/kit/pager.asset.php', '<?php return array();');
        $put('kit/notes/readme.txt', 'no part.json: not a part');
        Registry::reset(Registry::scan([['dir' => $this->root, 'url' => 'https://x.test/p/']]));
    }

    public function test_a_folder_with_a_part_json_is_a_part_named_by_it(): void {
        $parts = Registry::scan([['dir' => $this->root, 'url' => 'https://x.test/p/']]);
        $this->assertSame(['contain', 'grid', 'pager', 'tabs'], array_keys($parts));
        $this->assertSame('gsap', $parts['tabs']['needs']);
        $this->assertSame('https://x.test/p/kit/tabs/', $parts['tabs']['url']);
        $this->assertNotSame('', $parts['tabs']['script']);
        $this->assertSame('', $parts['grid']['script'], 'a part with no script has none');
        $this->assertSame('https://x.test/p/build/kit/pager.js', $parts['pager']['module']['url'], 'a view.js is its built module');
    }

    public function test_the_first_folder_s_part_stands(): void {
        $other = sys_get_temp_dir() . '/gcb-kit-other-' . uniqid() . '/';
        @mkdir($other . 'kit/grid', 0777, true);
        file_put_contents($other . 'kit/grid/part.json', '{"about":"another grid"}');
        $parts = Registry::scan([['dir' => $this->root, 'url' => 'a/'], ['dir' => $other, 'url' => 'b/']]);
        $this->assertSame('a/kit/grid/', $parts['grid']['url']);
    }

    public function test_a_block_brings_the_look_of_the_parts_it_draws_once_the_tokens_first(): void {
        $parts = Registry::parts();
        $used  = Registry::used_in('<div data-gcb-kit="tabs"></div><ul data-gcb-contain="logos"></ul>', $parts);
        $this->assertSame(['contain', 'tabs'], $used);
        $css = Registry::styles($used, $parts);
        $this->assertSame('<style id="gcb-kit-core">:root{--gcb-kit-accent:red}</style><style id="gcb-kit-contain">.contain{}</style><style id="gcb-kit-tabs">.tabs{}</style>', $css);
        $this->assertSame('', Registry::styles(['tabs'], $parts), 'printed once a request');
        $this->assertSame('<style id="gcb-kit-grid">.grid{}</style>', Registry::styles(['grid'], $parts), 'the tokens once too');
    }

    public function test_a_part_is_named_whole(): void {
        $this->assertSame([], Registry::used_in('<div data-gcb-kit="tabs-extra"></div>', Registry::parts()));
    }
}
