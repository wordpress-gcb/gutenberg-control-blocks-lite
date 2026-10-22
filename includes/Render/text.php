<?php
/**
 * RENDER HELPERS, THE WORDS — what a built block's render.php calls for its headings, rich text, numbers and icons.
 *
 * The second sweep after the client's developer read a render file (2026-10-10; helpers.php has the first). Every
 * heading carried its own h1–h6 whitelist, every rich-text line its own regular expression, every number its own
 * decimal sniffing, and every icon 1,000 characters that walked three registries — and named gcb-pro's Icons class
 * from inside a theme file. The render now says WHAT it prints — `gcblite_heading_tag(...)`, `gcblite_number(...)`,
 * `gcblite_icon_svg(...)` — and the HOW lives here, once, tested. Guarded with function_exists like helpers.php,
 * for the same reason: a block ejected to a site without GCB carries a copy beside its render.php.
 *
 * Nothing here echoes. Each returns the text to print, escaped — except gcblite_icon_svg, which is documented.
 *
 * @package GCBLite\Render
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('gcblite_heading_tag')) {
    /**
     * The heading's tag: the chosen `<key>_level` when it is one of h1–h6, the drawn tag otherwise. Returns the bare
     * tag name — it only ever comes from this whitelist, so it needs no escaping. The render keeps it in `$__gcb_h`
     * so the close tag matches whatever the open tag printed.
     */
    function gcblite_heading_tag($attributes, $key, $drawn = 'h2') {
        $v = is_array($attributes) ? ($attributes[$key] ?? '') : '';
        return in_array($v, array('h1', 'h2', 'h3', 'h4', 'h5', 'h6'), true) ? $v : (string) $drawn;
    }
}

if (!function_exists('gcblite_rich_inline')) {
    /**
     * One paragraph in a line of text is its words (2026-09-28, the Linfox editor test): the sidebar's rich-text
     * editor wraps what it holds in <p>, so a bold word typed in place came back as <p>…</p> inside the <h1>. Given
     * html that is exactly one paragraph, returns its inside; anything else — two paragraphs, no paragraph — as it
     * is. Takes html already run through wp_kses_post; the render shows that call so the escaping stays in view.
     */
    function gcblite_rich_inline($html) {
        return (string) preg_replace('#^\s*<p(?:\s[^>]*)?>((?:(?!</?p[\s>]).)*)</p>\s*$#s', '$1', (string) $html);
    }
}

if (!function_exists('gcblite_number')) {
    /**
     * A number prints as a number: grouped the way a person reads it (370,000 not 370000), at the FIELD'S precision
     * when the control says one, else with the decimals the value was stored with.
     *
     * $decimals is the number control's `decimals` setting (schemas/controls/number.md): the count of decimals the
     * design's sample was typed with — "5.0" is one, "4.95" two, "14,395" none — which the builder reads off the
     * design and the emitted render passes here (2026-10-23, the Airbnb rating summary: a draft page with no record
     * bound prints each field's registered default, and a default in block.json is a number with no memory of a
     * trailing zero, so "5.0" printed "5" beside "4.9"). Given a whole number of zero or more it wins, padding or
     * rounding the value to it; null, '' or anything else is "the control said nothing". No cap on the count: the
     * control said how many, and the same rule holds in gcb-pro.
     *
     * Without it, the stored text decides: "5.0" prints "5.0" and "1234.50" prints "1,234.50" (2026-10-22: a "5.0"
     * rating printed "5" beside a "4.9" that kept its decimal, because the decimals were read off a float cast). A
     * value that arrives as a PHP float has no stored decimals, so its shortest form is what it has (2026-09-22,
     * "99.2" read "99.20"). A value that is not a number is left as it is, escaped — "n/a" is not 0. Nothing prints
     * nothing rather than "0" — the placeholder that shipped as a real metric. $group false prints the value as it
     * was typed, or at the control's decimals with no thousands separator: a year is the one number nobody groups
     * ("2,002" in every timeline badge). Grouping goes through number_format_i18n where WordPress is loaded, so the
     * site's locale decides the separators; plain number_format otherwise.
     */
    function gcblite_number($v, $group = true, $decimals = null) {
        if ($v === null || $v === '') {
            return '';
        }
        $fixed = ($decimals !== null && $decimals !== '' && !is_bool($decimals) && is_numeric($decimals)
            && (float) $decimals >= 0 && (float) $decimals === floor((float) $decimals)) ? (int) $decimals : null;
        if (!$group && $fixed === null) {
            return esc_html((string) $v);
        }
        $s = is_string($v) ? trim($v) : (string) $v;
        if (!is_numeric($s)) {
            return esc_html((string) $v);
        }
        $f = (float) $s;
        if ($fixed === null) {
            $d     = strrchr($s, '.');
            $fixed = ($d === false || stripos($s, 'e') !== false) ? 0 : strlen($d) - 1;
        }
        if (!$group) {
            return esc_html(number_format($f, $fixed, '.', ''));
        }
        $out = function_exists('number_format_i18n') ? number_format_i18n($f, $fixed) : number_format($f, $fixed);
        return esc_html((string) $out);
    }
}

if (!function_exists('gcblite_icon_svg')) {
    /**
     * An icon's drawing. The stored value is {source, name} (or, from older data, a bare name). The name is offered
     * to the `gcblite_icon_svg` filter FIRST — gcb-pro answers for its own `gcb/…` names from the sidecar it wrote,
     * because WordPress's registry strips every stroke attribute on registration and its copy of an outline drawing
     * is a black blob. Then WordPress's own registry — wp_get_icon on 7.1, the registry itself on 7.0, the same two
     * steps gcb-lite's icon-list-item takes — and last the drawing the block was built with.
     *
     * Returned UNESCAPED, on purpose: a registry svg is trusted server-side content (kses strips the svg namespace
     * and viewBox), and the fallback was allow-list cleaned (Icons::clean_svg) before it was written into the render.
     */
    function gcblite_icon_svg($value, $fallback_svg = '') {
        $v    = is_object($value) ? (array) $value : $value;
        $name = is_array($v) ? (string) ($v['name'] ?? '') : (is_string($v) ? $v : '');
        $svg  = '';
        if ($name !== '') {
            if (function_exists('apply_filters')) {
                $svg = (string) apply_filters('gcblite_icon_svg', '', $name);
            }
            if ($svg === '' && function_exists('wp_get_icon')) {
                $svg = (string) wp_get_icon($name, array('size' => null));
            } elseif ($svg === '' && class_exists('WP_Icons_Registry')) {
                $icon = \WP_Icons_Registry::get_instance()->get_registered_icon($name);
                $svg  = ($icon && !empty($icon['content'])) ? (string) $icon['content'] : '';
            }
        }
        return $svg !== '' ? $svg : (string) $fallback_svg;
    }
}

/* THE THEME KITS' OWN HELPERS, MOVED IN (2026-10-11, Nathaniel Cars): the Showman's Show kit (ss_field, ss_lines, the
   footer's own "Label | /url" loop) and the Nathaniel kit (nc_field, nc_lines, nc_rows, nc_rich) each wrote these
   again in functions.php. The data-gcb-field attributes are this plugin's contract, so the helper that prints them is
   this plugin's too. */

if (!function_exists('gcblite_field')) {
    /**
     * The attributes that make an element inline-editable on the canvas: GCB binds RichText (or the media picker) to
     * the element that carries them. `<h2 class="x"` + `echo gcblite_field('heading')` + `>` (written without an opening tag here: Eject bundles this file into one, and counts them). Escaped.
     */
    function gcblite_field($key, $type = 'text') {
        return 'data-gcb-field="' . esc_attr((string) $key) . '" data-gcb-field-type="' . esc_attr((string) $type) . '"';
    }
}

if (!function_exists('gcblite_lines')) {
    /** A textarea's value as HTML: escaped, its line breaks kept as <br>. */
    function gcblite_lines($text) {
        return nl2br(esc_html((string) $text), false);
    }
}

if (!function_exists('gcblite_rich')) {
    /** A richtext field's value as inline HTML: what wp_kses_post allows, one wrapping paragraph taken off. */
    function gcblite_rich($html) {
        return gcblite_rich_inline(function_exists('wp_kses_post') ? wp_kses_post((string) $html) : esc_html((string) $html));
    }
}

if (!function_exists('gcblite_rows')) {
    /**
     * A textarea typed as rows, one per line: `Label | value` → [label, value] (a line with no bar → [line, '']); a
     * line of three or more dashes → null, a rule between groups; blank lines are skipped. Unescaped — escape where
     * it prints. For short lists an author types in the sidebar: menu links, select options, spec tables.
     *
     * @return array<int, array{0: string, 1: string}|null>
     */
    function gcblite_rows($text) {
        $rows = array();
        foreach (preg_split('/\r\n|\r|\n/', (string) $text) as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }
            if (preg_match('/^-{3,}$/', $line)) {
                $rows[] = null;
                continue;
            }
            $parts  = array_map('trim', explode('|', $line, 2));
            $rows[] = array($parts[0], $parts[1] ?? '');
        }
        return $rows;
    }
}
