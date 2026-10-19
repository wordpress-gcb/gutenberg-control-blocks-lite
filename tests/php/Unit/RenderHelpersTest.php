<?php
/**
 * THE RENDER HELPERS (2026-10-10): a built block's render.php calls these for its pictures, links and optional
 * parts instead of carrying the logic inline. Each takes a string, an array or an object, and returns escaped text.
 */

namespace GCBLite\Tests\Unit;

use PHPUnit\Framework\TestCase;

if (!function_exists('esc_url')) {
    eval('function esc_url($u) { return htmlspecialchars((string) $u, ENT_QUOTES); }');
}
if (!function_exists('esc_attr')) {
    eval('function esc_attr($u) { return htmlspecialchars((string) $u, ENT_QUOTES); }');
}
if (!function_exists('esc_html')) {
    eval('function esc_html($u) { return htmlspecialchars((string) $u, ENT_QUOTES); }');
}
if (!function_exists('wp_get_attachment_image_url')) {
    eval('function wp_get_attachment_image_url($id, $size = "") { return $id === 404 ? "" : "https://x.test/att-" . (int) $id . "-" . $size . ".jpg"; }');
}
if (!function_exists('wp_get_attachment_metadata')) {
    eval('function wp_get_attachment_metadata($id) { return $id === 8 ? array("width" => 420, "height" => 380) : false; }');
}
if (!function_exists('wp_upload_dir')) {
    eval('function wp_upload_dir() { return array("baseurl" => "https://y.test/wp-content/uploads"); }');
}
if (!function_exists('get_stylesheet')) {
    eval('function get_stylesheet() { return "kit"; }');
}
if (!function_exists('content_url')) {
    eval('function content_url($p = "") { return "https://y.test/wp-content" . $p; }');
}
require_once dirname(__DIR__, 3) . '/includes/Render/helpers.php';

final class RenderHelpersTest extends TestCase
{
    public function test_a_value_is_arrays_all_the_way_down(): void
    {
        $o = (object) ['image' => (object) ['id' => 3, 'alt' => 'A'], 'pins' => [(object) ['x' => 1]]];
        $this->assertSame(['image' => ['id' => 3, 'alt' => 'A'], 'pins' => [['x' => 1]]], gcblite_value($o));
        $this->assertSame(['id' => 3, 'alt' => 'A'], gcblite_sub($o, 'image'));
        $this->assertNull(gcblite_sub('plain', 'image'));
    }

    public function test_the_picture_is_the_attachment_then_the_stored_url_then_the_design_then_a_pixel(): void
    {
        $this->assertSame('https://x.test/att-7-large.jpg', gcblite_image_src(['id' => 7, 'url' => 'https://else/x.jpg']));
        $this->assertSame('https://x.test/att-7-thumb.jpg', gcblite_image_src(7, 'thumb'), 'a bare id, older data');
        $this->assertSame('https://else/x.jpg', gcblite_image_src(['id' => 404, 'url' => 'https://else/x.jpg']), 'an attachment that is gone falls back to the url');
        $this->assertSame('https://y.test/wp-content/uploads/2026/10/x.jpg', gcblite_image_src(null, 'large', 'uploads:/2026/10/x.jpg'), 'a portable fallback resolves to this site');
        $this->assertSame('https://y.test/wp-content/themes/t/y.jpg', gcblite_image_src('', 'large', 'content:/themes/t/y.jpg'));
        /* nothing at all: a see-through pixel for the visitor, an empty slot for the editor (the unit bootstrap may say either) */
        if (gcblite_in_editor()) {
            $this->assertSame('', gcblite_image_src(null));
        } else {
            $this->assertStringStartsWith('data:image/gif;base64,', gcblite_image_src(null));
        }
        $this->assertSame('https://a/b.jpg?w=1&amp;h=2', gcblite_image_src(null, 'large', 'https://a/b.jpg?w=1&h=2'), 'escaped');
    }

    public function test_alt_and_style(): void
    {
        $this->assertSame('Mine', gcblite_image_alt(['alt' => 'Mine'], 'Theirs'));
        $this->assertSame('Theirs', gcblite_image_alt(['alt' => ''], 'Theirs'));
        $this->assertSame('', gcblite_image_style(7));
        $this->assertSame('', gcblite_image_style_attr(['id' => 7]), 'nothing set, nothing printed');
        $this->assertSame('object-position:88% 0%', gcblite_image_style(['focalPoint' => ['x' => 0.88, 'y' => 0]]));
        $this->assertSame('object-fit:contain;width:320px', gcblite_image_style(['size' => 'contain', 'customWidth' => '320px']));
        $this->assertSame(
            'object-position:25% 50%;transform:scale(2);transform-origin:25% 50%;clip-path:inset(25% 37.5% 25% 12.5%)',
            gcblite_image_style(['zoom' => 2, 'focalPoint' => ['x' => 0.25, 'y' => 0.5]])
        );
        $this->assertStringContainsString('scale(3)', gcblite_image_style(['zoom' => 40]), 'capped');
        $this->assertStringNotContainsString('scale(', gcblite_image_style(['zoom' => 2, 'size' => 'contain']), 'no zoom on a contained picture');
        $this->assertSame(' style="opacity:.5; object-position:20% 90%"', gcblite_image_style_attr(['focalPoint' => ['x' => 0.2, 'y' => 0.9]], 'opacity:.5;'));
    }

    public function test_a_picture_carries_its_own_shape(): void
    {
        $this->assertSame(' style="--r:1.1053"', gcblite_image_style_attr(['id' => 8]), 'the file\'s width / height, for contain.css');
        $this->assertSame(' style="object-fit:contain;--r:1.1053"', gcblite_image_style_attr(['id' => 8, 'size' => 'contain']));
        $this->assertSame(' style="--r:1.1053;--cm-scale:1.25"', gcblite_image_style_attr(['id' => 8, 'scale' => 140]), 'a person\'s scale, held to 80–125%');
        $this->assertSame(' style="--r:1.1053"', gcblite_image_style_attr(['id' => 8, 'scale' => 100]), 'the default scale prints nothing');
        $this->assertSame(0.0, gcblite_image_ratio(['id' => 7]), 'no metadata, no shape');
    }

    public function test_links(): void
    {
        $this->assertSame('https://x.test/mag', gcblite_link_href(['url' => 'https://x.test/mag']));
        $this->assertSame('https://x.test/mag', gcblite_link_href((object) ['url' => 'https://x.test/mag']), 'an object from the REST API');
        $this->assertSame('/pricing', gcblite_link_href('/pricing'), 'a bare string');
        $this->assertSame('', gcblite_link_href(null));
        $this->assertSame(' target="_blank" rel="noopener noreferrer"', gcblite_link_target(['url' => 'x', 'opensInNewTab' => true]));
        $this->assertSame('', gcblite_link_target(['url' => 'x']));
        $this->assertSame('Read it', gcblite_link_text(['text' => 'Read it'], 'Said'));
        $this->assertSame('Said &amp; done', gcblite_link_text(['text' => ' '], 'Said & done'));
    }

    public function test_an_optional_part_shows_when_any_of_its_fields_holds_something(): void
    {
        $this->assertTrue(gcblite_any_set(['a' => 'words'], ['a', 'b']));
        $this->assertTrue(gcblite_any_set(['img' => ['id' => 3]], ['img']));
        $this->assertTrue(gcblite_any_set(['icon' => (object) ['name' => 'star']], ['icon']));
        $this->assertFalse(gcblite_any_set(['a' => '', 'img' => ['id' => 0, 'url' => '']], ['a', 'img']));
        $this->assertFalse(gcblite_any_set(null, ['a']));
    }

    public function test_portable_addresses_resolve_on_this_site(): void
    {
        $this->assertSame('https://y.test/wp-content/uploads/2026/10/x.jpg', gcblite_image_url(['url' => 'uploads:/2026/10/x.jpg']), 'a stored portable url');
        $html = '<Repeater template=\'[{"image":{"url":"uploads:/2026/10/a.jpg"}},{"image":{"url":"content:/themes/t/b.jpg"}}]\'>';
        $this->assertSame(
            '<Repeater template=\'[{"image":{"url":"https://y.test/wp-content/uploads/2026/10/a.jpg"}},{"image":{"url":"https://y.test/wp-content/themes/t/b.jpg"}}]\'>',
            gcblite_resolve_portable_urls($html)
        );
        $this->assertSame('<p>plain</p>', gcblite_resolve_portable_urls('<p>plain</p>'));
    }

    public function test_a_defaults_portable_addresses_resolve_however_deep(): void
    {
        $this->assertSame(
            ['url' => 'https://y.test/wp-content/themes/t/hero.jpg', 'alt' => 'see content:/ in the docs', 'id' => 0],
            gcblite_resolve_portable_value(['url' => 'content:/themes/t/hero.jpg', 'alt' => 'see content:/ in the docs', 'id' => 0])
        );
        $this->assertSame([['url' => 'https://y.test/wp-content/uploads/2026/10/a.jpg']], gcblite_resolve_portable_value([['url' => 'uploads:/2026/10/a.jpg']]));
        $this->assertSame('see uploads:/x', gcblite_resolve_portable_value('see uploads:/x'), 'only a value that starts with the word is an address');
        $this->assertSame(5, gcblite_resolve_portable_value(5));
        $this->assertNull(gcblite_resolve_portable_value(null));
    }

    public function test_a_post_is_saved_with_this_sites_addresses(): void
    {
        $data = gcblite_resolve_post_portable_urls(['post_content' => '<!-- wp:gcb/card {"img":{"url":"uploads:/2026/10/a.jpg"}} /-->', 'post_title' => 'x']);
        $this->assertSame('<!-- wp:gcb/card {"img":{"url":"https://y.test/wp-content/uploads/2026/10/a.jpg"}} /-->', $data['post_content']);
        $this->assertSame('x', $data['post_title']);
    }

    public function test_a_link_is_href_new_tab_and_words(): void
    {
        $this->assertSame(['https://x.test/a', ' target="_blank" rel="noopener noreferrer"', 'Go'], gcblite_link_parts(['url' => 'https://x.test/a', 'text' => 'Go', 'opensInNewTab' => true]));
        $this->assertSame(['', '', 'Read more'], gcblite_link_parts(['url' => '', 'text' => '  '], 'Read more'), 'no address: no href, the fallback words');
        $this->assertSame(['', '', ''], gcblite_link_parts(null));
    }

    public function test_a_theme_picture_is_a_portable_image_value(): void
    {
        $this->assertSame(['url' => 'content:/themes/kit/assets/img/a.png', 'alt' => 'MG'], gcblite_theme_image('/assets/img/a.png', 'MG'));
        $this->assertSame('https://y.test/wp-content/themes/kit/assets/img/a.png', gcblite_image_url(gcblite_theme_image('assets/img/a.png')));
    }
}
