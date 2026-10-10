<?php
/**
 * THE MEDIA RUNTIME (moved here from gcb-pro 2026-10-10): the pure parts a built render's gcb_media_html call
 * leans on — what kind of address this is, where a stored picture lives, YouTube's own still — and the two
 * renders that need no script: a picture, and the editor's poster. The players themselves are covered in
 * gcb-pro's MediaFieldTest, which builds a block and runs its render.
 */

namespace GCBLite\Tests\Unit;

use PHPUnit\Framework\TestCase;

foreach (array('esc_url', 'esc_attr', 'esc_html') as $fn) {
    if (!function_exists($fn)) {
        eval("function {$fn}(\$u) { return htmlspecialchars((string) \$u, ENT_QUOTES); }");
    }
}
require_once dirname(__DIR__, 3) . '/includes/Render/media.php';

final class RenderMediaTest extends TestCase
{
    public function test_an_address_has_a_kind(): void
    {
        $this->assertSame('youtube', gcb_media_kind('https://www.youtube.com/watch?v=aqz-KE-bpKQ'));
        $this->assertSame('youtube', gcb_media_kind('https://youtu.be/aqz-KE-bpKQ'));
        $this->assertSame('vimeo', gcb_media_kind('https://vimeo.com/123456'));
        $this->assertSame('vimeo', gcb_media_kind('https://player.vimeo.com/video/123456'));
        $this->assertSame('video', gcb_media_kind('https://x.test/clip.mp4'));
        $this->assertSame('video', gcb_media_kind('https://x.test/clip.webm?v=2'));
        $this->assertSame('image', gcb_media_kind('https://x.test/photo.jpg'));
        $this->assertSame('', gcb_media_kind(''));
    }

    public function test_a_stored_picture_is_its_url(): void
    {
        $this->assertSame('https://x.test/a.jpg', gcb_media_url(['id' => 3, 'url' => 'https://x.test/a.jpg']));
        $this->assertSame('https://x.test/a.jpg', gcb_media_url((object) ['url' => 'https://x.test/a.jpg']), 'an object from the REST API');
        $this->assertSame('', gcb_media_url('https://x.test/a.jpg'), 'a bare string is not the image control\'s shape');
        $this->assertSame('', gcb_media_url(null));
    }

    public function test_youtubes_own_still(): void
    {
        $this->assertSame('https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg', gcb_media_youtube_still('https://www.youtube.com/watch?v=aqz-KE-bpKQ'));
        $this->assertSame('https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg', gcb_media_youtube_still('https://youtu.be/aqz-KE-bpKQ'));
        $this->assertSame('https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg', gcb_media_youtube_still('https://www.youtube.com/shorts/aqz-KE-bpKQ'));
        $this->assertSame('', gcb_media_youtube_still('https://vimeo.com/1'));
    }

    public function test_the_cdn_is_pinned_to_one_version(): void
    {
        $this->assertSame('https://cdn.jsdelivr.net/npm/@videojs/cdn@10.0.0-rc.2/video.js', gcb_media_cdn('video.js'));
    }

    public function test_a_picture_is_just_a_picture(): void
    {
        $GLOBALS['gcb_media_style_printed'] = false;
        $out = gcb_media_html(array('film' => array('url' => 'https://x.test/photo.jpg'), 'film_link' => ''), 'film', array('mode' => 'player', 'alt' => 'A & B', 'posterClass' => 'w-full'));
        $this->assertSame('<img class="gcb-media-poster w-full" src="https://x.test/photo.jpg" alt="A &amp; B" loading="lazy">', $out);
        $this->assertStringNotContainsString('<script', $out);
        $this->assertSame('', gcb_media_html(array(), 'film', array('mode' => 'player')), 'nothing stored, nothing drawn, nothing printed');
    }

    public function test_the_editor_gets_the_poster_and_no_player(): void
    {
        $GLOBALS['gcblite_test_is_admin'] = true;
        try {
            $this->assertTrue(is_admin(), 'the unit bootstrap\'s is_admin reads the test flag');
            $out = gcb_media_html(array(), 'film', array('mode' => 'player', 'src' => 'https://youtu.be/aqz-KE-bpKQ'));
            $this->assertSame('<img class="gcb-media-poster" src="https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg" alt="" loading="lazy">', $out, 'YouTube\'s own still when no poster is set');
            $out = gcb_media_html(array('film_link' => 'https://x.test/clip.mp4'), 'film', array('mode' => 'player'));
            $this->assertStringContainsString('<video class="gcb-media-poster" src="https://x.test/clip.mp4#t=0.1"', $out, 'a video file shows its first frame');
            $this->assertStringNotContainsString('<script', $out);
            $this->assertStringNotContainsString('<video-player', $out);
        } finally {
            $GLOBALS['gcblite_test_is_admin'] = false;
        }
    }
}
