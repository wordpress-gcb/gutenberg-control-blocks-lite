<?php

namespace GCBLite\Tests\Unit;

use GCBLite\PostTypes\PostTypeRegistrar;
use PHPUnit\Framework\TestCase;

/**
 * The config-driven CPT registrar's read/write surface (what the AI architect
 * drives). register_all() touches WP's register_post_type and is exercised in
 * the integration suite; here we cover write() validation + configs() reading
 * against a temp theme dir.
 */
class PostTypeRegistrarTest extends TestCase {

    private string $theme;

    protected function setUp(): void {
        $this->theme = sys_get_temp_dir() . '/gcb-theme-' . uniqid();
        mkdir($this->theme, 0755, true);
        $GLOBALS['__gcb_test_stylesheet_dir'] = $this->theme;
    }

    protected function tearDown(): void {
        $dir = $this->theme . '/gcb-post-types';
        foreach (glob($dir . '/*') ?: [] as $f) { @unlink($f); }
        @rmdir($dir);
        @rmdir($this->theme);
        unset($GLOBALS['__gcb_test_stylesheet_dir']);
    }

    public function test_write_rejects_invalid_slug(): void {
        $r = PostTypeRegistrar::write(['post_type' => 'Bad Slug!']);
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('Invalid post type slug', $r['error']);
    }

    public function test_write_rejects_reserved_type(): void {
        $r = PostTypeRegistrar::write(['post_type' => 'page']);
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('reserved', $r['error']);
    }

    public function test_write_creates_config_file(): void {
        $r = PostTypeRegistrar::write([
            'post_type' => 'person',
            'args'      => ['label' => 'People', 'menu_icon' => 'dashicons-groups'],
            'fields'    => ['controls' => [
                ['type' => 'text', 'attributeKey' => 'role', 'label' => 'Role'],
            ]],
        ]);
        $this->assertTrue($r['ok'], $r['error'] ?? '');
        $this->assertSame('person', $r['post_type']);
        $this->assertFileExists($this->theme . '/gcb-post-types/person.json');

        $saved = json_decode(file_get_contents($r['path']), true);
        $this->assertSame('person', $saved['post_type']);
        $this->assertSame('People', $saved['args']['label']);
        $this->assertSame('role', $saved['fields']['controls'][0]['attributeKey']);
        // no temp file left behind
        $this->assertFileDoesNotExist($this->theme . '/gcb-post-types/person.json.gcbtmp');
    }

    public function test_configs_reads_written_files(): void {
        PostTypeRegistrar::write(['post_type' => 'person', 'args' => ['label' => 'People']]);
        PostTypeRegistrar::write(['post_type' => 'event',  'args' => ['label' => 'Events']]);

        $configs = PostTypeRegistrar::configs();
        $this->assertArrayHasKey('person', $configs);
        $this->assertArrayHasKey('event', $configs);
        $this->assertSame('Events', $configs['event']['args']['label']);
    }

    public function test_configs_empty_when_no_dir(): void {
        $this->assertSame([], PostTypeRegistrar::configs());
    }

    public function test_a_taxonomy_already_registered_is_attached_not_skipped(): void {
        if (!function_exists('register_post_type')) {
            eval('function register_post_type($t, $a = []) { $GLOBALS["__gcb_pt"][$t] = $a; }');
            eval('function post_type_exists($t) { return isset($GLOBALS["__gcb_pt"][$t]); }');
            eval('function register_taxonomy($t, $o, $a = []) { $GLOBALS["__gcb_tax"][$t] = (array) $o; }');
            eval('function taxonomy_exists($t) { return isset($GLOBALS["__gcb_tax"][$t]); }');
            eval('function register_taxonomy_for_object_type($t, $o) { $GLOBALS["__gcb_tax"][$t][] = $o; }');
        }
        $GLOBALS['__gcb_pt'] = $GLOBALS['__gcb_tax'] = [];
        PostTypeRegistrar::write(['post_type' => 'cars', 'taxonomies' => [['taxonomy' => 'car_body_style']]]);
        PostTypeRegistrar::write(['post_type' => 'nc_style', 'taxonomies' => [['taxonomy' => 'car_body_style']]]);
        PostTypeRegistrar::register_all();
        $this->assertSame(['cars', 'nc_style'], $GLOBALS['__gcb_tax']['car_body_style']);
    }
}
