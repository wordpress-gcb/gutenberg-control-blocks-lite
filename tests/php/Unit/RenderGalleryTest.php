<?php
/**
 * A GALLERY DRAWN AS PLACES (2026-10-20): a mosaic's slots take the field's pictures in order.
 */

namespace GCBLite\Tests\Unit;

use PHPUnit\Framework\TestCase;

if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__);
}
require_once dirname(__DIR__, 3) . '/includes/Render/gallery.php';

final class RenderGalleryTest extends TestCase
{
    private const DRAWN = '<img data-gcb-gallery-slot data-gcb-kit-item src="a.jpg" class="big"><div class="tile"><img data-gcb-gallery-slot data-gcb-kit-item src="b.jpg"></div><div class="tile"><img data-gcb-gallery-slot data-gcb-kit-item src="c.jpg"></div><button>Show all <span data-gcb-gallery-count>3</span></button>';

    private static function pics(int $n): array {
        return array_map(static fn($i) => array('id' => 0, 'url' => "p{$i}.jpg", 'alt' => "Photo {$i}"), range(1, $n));
    }

    private static function query(string $html): \DOMXPath {
        $d = new \DOMDocument();
        @$d->loadHTML('<div>' . $html . '</div>');
        return new \DOMXPath($d);
    }

    public function test_the_pictures_fill_the_places_in_order_and_the_rest_join_the_set_unseen(): void {
        $x = self::query(gcblite_gallery_slots(self::pics(5), self::DRAWN));
        $this->assertSame(array('p1.jpg', 'p2.jpg', 'p3.jpg', 'p4.jpg', 'p5.jpg'), array_map(static fn($i) => $i->getAttribute('src'), iterator_to_array($x->query('//img'))));
        $this->assertSame('big', $x->query('//img')->item(0)->getAttribute('class'));
        $this->assertSame(2, $x->query('//img[@hidden][@data-gcb-kit-item]')->length);
        $this->assertSame('5', $x->query('//*[@data-gcb-gallery-count]')->item(0)->textContent);
    }

    public function test_a_place_with_no_picture_goes_with_its_tile(): void {
        $x = self::query(gcblite_gallery_slots(self::pics(2), self::DRAWN));
        $this->assertSame(2, $x->query('//img')->length);
        $this->assertSame(1, $x->query('//*[@class="tile"]')->length);
    }

    public function test_nothing_stored_keeps_the_design(): void {
        $this->assertSame(self::DRAWN, gcblite_gallery_slots(null, self::DRAWN));
    }
}
