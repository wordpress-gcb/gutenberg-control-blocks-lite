<?php
/**
 * RENDER HELPERS — what a built block's render.php calls for its pictures, links and optional parts.
 *
 * Mark, 2026-10-10, after a client's developer read a generated render file: "he wasn't impressed". He was right:
 * every image carried 1,500 characters of inline PHP for the attachment lookup, the focal point and the zoom, every
 * link normalised its value twice in one tag, and a design-time address was baked in as the fallback. The render
 * file now says WHAT it prints — `gcblite_image_src(...)`, `gcblite_link_href(...)` — and the HOW lives here, once,
 * tested. A block ejected to a site without GCB carries a copy of this file beside its render.php (Eject writes it),
 * which is why every function is guarded with function_exists.
 *
 * Values arrive in three shapes depending on who stored them — a string, an array, or a stdClass from the REST API —
 * so every helper takes any of them. Nothing here echoes: each returns the escaped text to print.
 *
 * @package GCBLite\Render
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('gcblite_value')) {
    /** A stored value as PHP arrays all the way down: the editor hands arrays, the REST API hands objects. */
    function gcblite_value($v) {
        if (is_object($v)) {
            $v = (array) $v;
        }
        if (is_array($v)) {
            foreach ($v as $k => $x) {
                if (is_object($x) || is_array($x)) {
                    $v[$k] = gcblite_value($x);
                }
            }
        }
        return $v;
    }
}

if (!function_exists('gcblite_sub')) {
    /** One key of a stored value, or null — a hotspots field's `image`, say. */
    function gcblite_sub($v, $key) {
        $v = gcblite_value($v);
        return is_array($v) ? ($v[$key] ?? null) : null;
    }
}

if (!function_exists('gcblite_in_editor')) {
    /** Is this render for the editor or the REST API rather than a visitor? */
    function gcblite_in_editor() {
        return (defined('REST_REQUEST') && REST_REQUEST) || (function_exists('is_admin') && is_admin());
    }
}

if (!function_exists('gcblite_fallback_url')) {
    /**
     * A design-time address kept portable. The build writes `uploads:/2026/10/x.jpg` for a file in this site's
     * uploads and `content:/themes/x/y.jpg` for one under wp-content, so a block moved to another host — a staging
     * copy, a client's site — still finds its picture. Any other address is returned as it is.
     */
    function gcblite_fallback_url($fb) {
        $fb = (string) $fb;
        if (strpos($fb, 'uploads:') === 0 && function_exists('wp_upload_dir')) {
            $dir = wp_upload_dir();
            return rtrim((string) ($dir['baseurl'] ?? ''), '/') . substr($fb, 8);
        }
        if (strpos($fb, 'content:') === 0 && function_exists('content_url')) {
            return content_url(substr($fb, 8));
        }
        return $fb;
    }
}

if (!function_exists('gcblite_image_url')) {
    /**
     * A picture's address: the attachment at the stored id (older data stored a bare id), else the url the value
     * carries (an external picture, a seeded one), else ''.
     */
    function gcblite_image_url($v, $size = 'large') {
        $v   = gcblite_value($v);
        $aid = is_array($v) ? (int) ($v['id'] ?? 0) : (int) $v;
        $url = $aid && function_exists('wp_get_attachment_image_url') ? (string) wp_get_attachment_image_url($aid, $size) : '';
        if ($url === '' && is_array($v) && !empty($v['url'])) {
            $url = gcblite_fallback_url((string) $v['url']);
        }
        return $url;
    }
}

if (!function_exists('gcblite_resolve_portable_urls')) {
    /**
     * Every portable address in a run of HTML put back on this site: `uploads:/…` and `content:/…` as the build
     * writes them into a Repeater's template (the seeded items' pictures), resolved before the editor reads the
     * template and seeds them into a post. Nothing else in markup starts with those words.
     */
    function gcblite_resolve_portable_urls($html) {
        $html = (string) $html;
        if (strpos($html, 'uploads:/') === false && strpos($html, 'content:/') === false) {
            return $html;
        }
        if (function_exists('wp_upload_dir')) {
            $dir  = wp_upload_dir();
            $html = str_replace('uploads:/', rtrim((string) ($dir['baseurl'] ?? ''), '/') . '/', $html);
        }
        if (function_exists('content_url')) {
            $html = str_replace('content:/', rtrim((string) content_url(), '/') . '/', $html);
        }
        return $html;
    }
}

if (!function_exists('gcblite_resolve_portable_value')) {
    /**
     * A field value with every portable address in it put back on this site — any string that STARTS `uploads:/` or
     * `content:/`, however deep in the value; text that only mentions one is left alone. For a control's `default`
     * (2026-10-11, Nathaniel Cars: a hero photo defaulting to a theme file, `content:/themes/…/hero.jpg`): the default
     * went from block.fields.json into the block's registration and the editor's copy of the controls as written, and
     * the canvas printed it as an <img> src no browser loads.
     */
    function gcblite_resolve_portable_value($value) {
        if (is_array($value)) {
            return array_map('gcblite_resolve_portable_value', $value);
        }
        if (is_string($value) && (strpos($value, 'uploads:/') === 0 || strpos($value, 'content:/') === 0)) {
            return gcblite_resolve_portable_urls($value);
        }
        return $value;
    }
}

if (!function_exists('gcblite_image_src')) {
    /**
     * What an <img>'s src prints: the picture, else the design's own (made portable), else — for a visitor only — a
     * see-through pixel, so an empty slot prints no alt words over the page while the editor still shows a slot.
     * A data: fallback goes through esc_attr: esc_url would strip it.
     */
    function gcblite_image_src($v, $size = 'large', $fallback = '') {
        $url = gcblite_image_url($v, $size);
        if ($url !== '') {
            return esc_url($url);
        }
        $fb = gcblite_fallback_url($fallback);
        if ($fb === '' && !gcblite_in_editor()) {
            $fb = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        }
        return strpos($fb, 'data:') === 0 ? esc_attr($fb) : esc_url($fb);
    }
}

if (!function_exists('gcblite_image_alt')) {
    /** The alt a person wrote on the picture, else the design's. */
    function gcblite_image_alt($v, $fallback = '') {
        $v = gcblite_value($v);
        $alt = is_array($v) && isset($v['alt']) && $v['alt'] !== '' ? (string) $v['alt'] : (string) $fallback;
        return esc_attr($alt);
    }
}

if (!function_exists('gcblite_image_style')) {
    /**
     * The inline style a person's picture settings add: focal point → object-position; size contain/auto →
     * object-fit; a custom width; a zoom (capped at 3) that scales about the focal point and clips back to the
     * picture's own box. Pure: returns the declarations, '' when nothing is set.
     */
    function gcblite_image_style($v) {
        $v = gcblite_value($v);
        if (!is_array($v)) {
            return '';
        }
        $st = array();
        $fp = $v['focalPoint'] ?? null;
        if (is_array($fp) && isset($fp['x'], $fp['y'])) {
            $st[] = 'object-position:' . (int) round((float) $fp['x'] * 100) . '% ' . (int) round((float) $fp['y'] * 100) . '%';
        }
        $size = (string) ($v['size'] ?? '');
        if ($size === 'contain') {
            $st[] = 'object-fit:contain';
        } elseif ($size === 'auto') {
            $st[] = 'object-fit:none';
        }
        $cw = trim((string) ($v['customWidth'] ?? ''));
        if ($cw !== '' && preg_match('/^[0-9.]+(?:px|%|em|rem|vw)?$/', $cw)) {
            $st[] = 'width:' . $cw;
        }
        $zoom = is_numeric($v['zoom'] ?? null) ? min(3.0, (float) $v['zoom']) : 1.0;
        if ($zoom > 1.001 && ($size === '' || $size === 'cover')) {
            $ox = (is_array($fp) && isset($fp['x'])) ? max(0.0, min(1.0, (float) $fp['x'])) : 0.5;
            $oy = (is_array($fp) && isset($fp['y'])) ? max(0.0, min(1.0, (float) $fp['y'])) : 0.5;
            $k  = 1 - 1 / $zoom;
            $pc = static function ($n) {
                return rtrim(rtrim(number_format($n * 100, 2, '.', ''), '0'), '.') . '%';
            };
            $st[] = 'transform:scale(' . rtrim(rtrim(number_format($zoom, 2, '.', ''), '0'), '.') . ')';
            $st[] = 'transform-origin:' . $pc($ox) . ' ' . $pc($oy);
            $st[] = 'clip-path:inset(' . $pc($oy * $k) . ' ' . $pc((1 - $ox) * $k) . ' ' . $pc((1 - $oy) * $k) . ' ' . $pc($ox * $k) . ')';
        }
        return implode(';', $st);
    }
}

if (!function_exists('gcblite_image_ratio')) {
    /**
     * THE PICTURE'S OWN SHAPE (contained media, 2026-10-19): width ÷ height of the file a picture value points at —
     * its attachment's metadata, or an SVG's width/height or viewBox — 0.0 when it cannot be known (no attachment,
     * no WordPress). A list of logos sizes each one by equal area from this (gcb-pro assets/kit/contain.css), so it
     * is read at render: a person's new logo is sized by its own shape, not the one the design was built with.
     */
    function gcblite_image_ratio($v) {
        static $seen = array();
        $v = gcblite_value($v);
        if (!is_array($v) || !function_exists('wp_get_attachment_metadata')) {
            return 0.0;
        }
        $id = (int) ($v['id'] ?? 0);
        if (!$id && !empty($v['url']) && function_exists('attachment_url_to_postid')) {
            $url = gcblite_image_url($v, 'full');
            if (!array_key_exists('u:' . $url, $seen)) {
                $seen['u:' . $url] = (int) attachment_url_to_postid($url);
            }
            $id = $seen['u:' . $url];
        }
        if (!$id) {
            return 0.0;
        }
        if (array_key_exists($id, $seen)) {
            return $seen[$id];
        }
        $meta = wp_get_attachment_metadata($id);
        $w = is_array($meta) ? (float) ($meta['width'] ?? 0) : 0.0;
        $h = is_array($meta) ? (float) ($meta['height'] ?? 0) : 0.0;
        /* an SVG carries no metadata: its own width/height, else its viewBox */
        if ((!$w || !$h) && function_exists('get_attached_file')) {
            $file = (string) get_attached_file($id);
            if (preg_match('/\.svg$/i', $file) && is_readable($file)) {
                $head = (string) file_get_contents($file, false, null, 0, 4096);
                if (preg_match('/<svg\b[^>]*>/i', $head, $tag)) {
                    $num = static function ($name) use ($tag) {
                        return preg_match('/\s' . $name . '="\s*([0-9.]+)(?:px)?\s*"/i', $tag[0], $m) ? (float) $m[1] : 0.0;
                    };
                    $w = $num('width');
                    $h = $num('height');
                    if ((!$w || !$h) && preg_match('/\sviewBox="\s*[-0-9.]+[\s,]+[-0-9.]+[\s,]+([0-9.]+)[\s,]+([0-9.]+)\s*"/i', $tag[0], $vb)) {
                        $w = (float) $vb[1];
                        $h = (float) $vb[2];
                    }
                }
            }
        }
        return $seen[$id] = ($w > 0 && $h > 0) ? round($w / $h, 4) : 0.0;
    }
}

if (!function_exists('gcblite_image_style_attr')) {
    /**
     * The whole ` style="…"` attribute, the design's own declarations first; '' when there is nothing to say. With
     * the picture's shape as --r when it is known, and a person's Scale (80–125%) as --cm-scale: contain.css reads them
     * for a list of logos, and nothing else does.
     */
    function gcblite_image_style_attr($v, $own = '') {
        $set = gcblite_image_style($v);
        $r = gcblite_image_ratio($v);
        if ($r > 0) {
            $set .= ($set !== '' ? ';' : '') . '--r:' . $r;
        }
        $val = gcblite_value($v);
        if (is_array($val) && is_numeric($val['scale'] ?? null) && (float) $val['scale'] !== 100.0) {
            $set .= ($set !== '' ? ';' : '') . '--cm-scale:' . round(max(80, min(125, (float) $val['scale'])) / 100, 3);
        }
        $all = trim((string) $own . ($set !== '' ? ' ' . $set : ''));
        return $all === '' ? '' : ' style="' . esc_attr($all) . '"';
    }
}

if (!function_exists('gcblite_link_url')) {
    /** A link field's address as a string, whatever shape the value arrived in. */
    function gcblite_link_url($v) {
        $v = gcblite_value($v);
        return is_array($v) ? (string) ($v['url'] ?? '') : (is_string($v) ? $v : '');
    }
}

if (!function_exists('gcblite_link_href')) {
    /** What href= prints. */
    function gcblite_link_href($v) {
        return esc_url(gcblite_link_url($v));
    }
}

if (!function_exists('gcblite_link_target')) {
    /** ` target="_blank" rel="noopener noreferrer"` when the person asked for a new tab, else ''. */
    function gcblite_link_target($v) {
        $v = gcblite_value($v);
        return is_array($v) && !empty($v['opensInNewTab']) ? ' target="_blank" rel="noopener noreferrer"' : '';
    }
}

if (!function_exists('gcblite_link_text')) {
    /** The words a person gave the link, else the words the design wrote. */
    function gcblite_link_text($v, $fallback = '') {
        $v    = gcblite_value($v);
        $text = is_array($v) ? trim((string) ($v['text'] ?? '')) : '';
        return esc_html($text !== '' ? $text : (string) $fallback);
    }
}

if (!function_exists('gcblite_any_set')) {
    /**
     * Does any of these attributes hold something? An optional part renders only then. "Something" is a non-empty
     * scalar, or a picture, link or icon value with an id, a url or a name.
     */
    function gcblite_any_set($attributes, array $keys) {
        $attributes = is_array($attributes) ? $attributes : array();
        foreach ($keys as $k) {
            $v = gcblite_value($attributes[$k] ?? null);
            if (is_array($v)) {
                if (!empty($v['id']) || !empty($v['url']) || !empty($v['name'])) {
                    return true;
                }
            } elseif ($v !== null && $v !== '' && $v !== false) {
                return true;
            }
        }
        return false;
    }
}

/* A PORTABLE ADDRESS IS NEVER SAVED INTO A POST (2026-10-10, page 166 on Showman's Show: its cards were seeded from a
   template before the editor's render resolved it, and saved with uploads:/… — the pictures did not show). Whatever
   reaches a post's content is put back on this site as it is saved. */
if (function_exists('add_filter') && !has_filter('wp_insert_post_data', 'gcblite_resolve_post_portable_urls')) {
    function gcblite_resolve_post_portable_urls($data) {
        if (is_array($data) && isset($data['post_content']) && is_string($data['post_content'])
            && (strpos($data['post_content'], 'uploads:/') !== false || strpos($data['post_content'], 'content:/') !== false)) {
            $data['post_content'] = gcblite_resolve_portable_urls($data['post_content']);
        }
        return $data;
    }
    add_filter('wp_insert_post_data', 'gcblite_resolve_post_portable_urls', 10, 1);
}

if (!function_exists('gcblite_link_parts')) {
    /**
     * A url field in the three pieces a render prints: [href, the new-tab attributes, the words]. href is escaped,
     * or '' when the field holds no address — so a render can leave the link out; the words are the person's, else
     * $fallback, UNESCAPED (print them with esc_html). `[$href, $new, $text] = gcblite_link_parts($attributes['link'] ?? null, 'Read more');`
     */
    function gcblite_link_parts($v, $fallback = '') {
        $v    = gcblite_value($v);
        $url  = gcblite_link_url($v);
        $text = is_array($v) ? trim((string) ($v['text'] ?? '')) : '';
        return array($url !== '' ? esc_url($url) : '', gcblite_link_target($v), $text !== '' ? $text : (string) $fallback);
    }
}

if (!function_exists('gcblite_theme_image')) {
    /**
     * A picture the active theme ships, as an image field value with a portable address (`content:/themes/{theme}/…`)
     * — for a Repeater template's seeded items, which the editor resolves to this site's address as it seeds them.
     * $path is relative to the theme folder: gcblite_theme_image('assets/img/logo.png', 'MG').
     */
    function gcblite_theme_image($path, $alt = '') {
        $theme = function_exists('get_stylesheet') ? get_stylesheet() : '';
        return array('url' => 'content:/themes/' . $theme . '/' . ltrim((string) $path, '/'), 'alt' => (string) $alt);
    }
}
