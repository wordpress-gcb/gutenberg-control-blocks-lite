<?php
/**
 * RENDER HELPERS, A GALLERY DRAWN AS PLACES (2026-10-20: a home's page drew its pictures as a mosaic — one large, four
 * small — and could only say it with five fixed image fields, the same five on every home).
 *
 * A `gallery` field is drawn one of two ways. Most draw one picture and it is printed once per stored image. A design
 * whose pictures each have their own place marks them as the field's slots, in order:
 *
 *   <div data-gcb-kit="gallery" data-gcb-field="photos" data-gcb-field-type="gallery">
 *     <img data-gcb-gallery-slot data-gcb-kit-item src="…" class="col-span-2 row-span-2">
 *     <div><img data-gcb-gallery-slot data-gcb-kit-item src="…"></div> …
 *     <button>Show all <span data-gcb-gallery-count>5</span> photos</button>
 *   </div>
 *
 * The first stored picture fills the first slot, the second the second…; a slot with no picture goes (with the tile
 * round it, when it sits in one of its own); pictures past the last slot join the set out of sight, so a lightbox over
 * them still goes round every one; `[data-gcb-gallery-count]` says how many there are. Nothing stored (null): the
 * design's own pictures. An emptied gallery ([]) leaves the slots empty, as a person left it.
 *
 * Guarded with function_exists like helpers.php: a block ejected to a site without GCB carries a copy.
 *
 * @package GCBLite\Render
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('gcblite_gallery_pictures')) {
    /**
     * A gallery field's value as pictures: [[url, alt], …] — a stored id read through the media library, a url kept.
     *
     * @param mixed $value    the stored value
     * @param array $fallback the design's own pictures, used when nothing is stored
     */
    function gcblite_gallery_pictures($value, array $fallback = array()): array {
        $value = is_object($value) ? (array) $value : $value;
        if ($value === null) {
            $value = $fallback;
        }
        $out = array();
        foreach (is_array($value) ? $value : array() as $item) {
            $item = is_object($item) ? (array) $item : $item;
            $id   = is_array($item) ? (int) ($item['id'] ?? 0) : (int) $item;
            $url  = $id && function_exists('wp_get_attachment_image_url') ? (string) wp_get_attachment_image_url($id, 'large') : '';
            if ($url === '' && is_array($item)) {
                $url = (string) ($item['url'] ?? '');
            }
            if ($url !== '') {
                $out[] = array('url' => $url, 'alt' => is_array($item) ? (string) ($item['alt'] ?? '') : '');
            }
        }
        return $out;
    }
}

if (!function_exists('gcblite_gallery_slots')) {
    /**
     * The drawn places filled with the field's pictures.
     *
     * @param mixed  $value    the stored value
     * @param string $html     what the design drew inside the field's box
     * @param array  $fallback the design's own pictures
     */
    function gcblite_gallery_slots($value, string $html, array $fallback = array()): string {
        $value = is_object($value) ? (array) $value : $value;
        if ($value === null) {
            return $html;
        }
        $pics = gcblite_gallery_pictures($value);
        $doc  = new \DOMDocument();
        $prev = libxml_use_internal_errors(true);
        $ok   = $doc->loadHTML('<?xml encoding="utf-8"?><div id="gcb-gs-root">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        $box = $ok ? $doc->getElementById('gcb-gs-root') : null;
        if (!$box) {
            return $html;
        }
        $x     = new \DOMXPath($doc);
        $slots = iterator_to_array($x->query('.//img[@data-gcb-gallery-slot]', $box));
        $put   = static function (\DOMElement $img, array $p): void {
            $img->setAttribute('src', $p['url']);
            $img->setAttribute('alt', $p['alt']);
            $img->removeAttribute('srcset');
            $img->removeAttribute('sizes');
            if ($img->hasAttribute('data-full')) {
                $img->setAttribute('data-full', $p['url']);
            }
        };
        foreach ($slots as $i => $img) {
            if (isset($pics[$i])) {
                $put($img, $pics[$i]);
                continue;
            }
            $up   = $img->parentNode;
            $tile = $up instanceof \DOMElement && $up !== $box && $up->getElementsByTagName('img')->length === 1 ? $up : $img;
            $tile->parentNode->removeChild($tile);
        }
        $last = $slots ? end($slots) : null;
        foreach (array_slice($pics, count($slots)) as $p) {
            $more = $doc->createElement('img');
            $put($more, $p);
            if ($last && $last->hasAttribute('data-gcb-kit-item')) {
                $more->setAttribute('data-gcb-kit-item', '');
            }
            $more->setAttribute('hidden', '');
            $box->appendChild($more);
        }
        foreach (iterator_to_array($x->query('.//*[@data-gcb-gallery-count]', $box)) as $n) {
            while ($n->firstChild) {
                $n->removeChild($n->firstChild);
            }
            $n->appendChild($doc->createTextNode((string) count($pics)));
        }
        $out = '';
        foreach (iterator_to_array($box->childNodes) as $n) {
            $out .= $doc->saveHTML($n);
        }
        return $out;
    }
}
