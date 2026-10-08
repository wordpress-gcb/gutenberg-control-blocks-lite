<?php
/**
 * The supported surface for plugins built on GCB Lite.
 *
 * WHY THIS EXISTS
 *
 * Companion plugins were reaching straight into Lite's internals. gcb-pro
 * calls eight Lite classes directly, each behind its own `class_exists()` /
 * `method_exists()` guard, because nothing promised any of them would still be
 * there. That has already failed silently once: pro calls
 * `PostFields\Registrar::controls_for()`, which **has never existed in Lite**.
 * The `method_exists()` guard turned a missing method into an empty field list,
 * so the CPT schema kimi was handed simply had no fields in it — no error, no
 * log, just a quieter model. (`controls_for()` is now provided here, properly.)
 *
 * A second consumer makes that pattern N×N, so the coupling gets one door.
 * The rule for anything outside Lite:
 *
 *   Call \GCBLite\Contract\Fields. Do not call Lite's internals.
 *
 * WHAT'S IN
 *
 * The four capabilities two independent consumers both need — the vocabulary,
 * schema validation, field registration, design tokens — plus `render_items()`,
 * which is in for a different reason: pro emits that call **as a literal string
 * into generated render.php**, so a signature change breaks generated code
 * already written to disk, at runtime, on sites nobody is looking at. It is the
 * most brittle coupling in the system and the one most worth freezing.
 *
 * WHAT'S OUT
 *
 * Block scaffolding, CPT file-writing and the Maps key stay pro-specific — one
 * consumer each, no evidence they generalise. A contract that wraps everything
 * is just a second name for the internals.
 *
 * STABILITY
 *
 * Every method here delegates; none reimplements. Lite's internals stay free to
 * change shape as long as this surface keeps its shape. Breaking a signature
 * here means a Lite major version.
 *
 * @package GCBLite\Contract
 */

namespace GCBLite\Contract;

use GCBLite\Blocks\Queries\QueryLoop;
use GCBLite\Docs\ControlDocs;
use GCBLite\PostFields\Conditional;
use GCBLite\PostFields\Registrar;
use GCBLite\PostFields\Sanitizer;
use GCBLite\PostFields\Validator;
use GCBLite\Tokens\TokenParser;
use GCBLite\Validation\BlockGcbValidator;

if (!defined('ABSPATH')) {
    exit;
}

class Fields {

    /**
     * The contract's own version, independent of GCBLITE_VERSION.
     *
     * Consumers gate on this, not on the plugin version: Lite can ship a
     * patch without touching the contract, and the contract can gain a
     * method without a Lite minor. Bump MINOR to add, MAJOR to break.
     */
    const VERSION = '1.1.0'; // 1.1: control_shape(), control_source(), list_controls()

    /** True when the contract can actually serve — checked before use. */
    public static function is_available() {
        return class_exists(ControlDocs::class)
            && class_exists(BlockGcbValidator::class)
            && class_exists(Registrar::class)
            && class_exists(\GCBLite\Fields\ControlTypes::class);
    }

    /** Whether this Lite satisfies a consumer's minimum contract version. */
    public static function supports($min_version) {
        return version_compare(self::VERSION, (string) $min_version, '>=');
    }

    // ------------------------------------------------------------------
    // 1. Vocabulary — which control types exist.
    //
    // Docs are canonical: schemas/controls/*.md. Write a doc file and the
    // type appears everywhere, including in consumers, with no edit on
    // their side. Never keep your own copy of this list — the one that
    // decayed did so because it was retyped (see the heading/heading-level
    // drift and ControlVocabularyDerivedTest).
    // ------------------------------------------------------------------

    /**
     * Every usable control type: documented types, their aliases, and the
     * structural container types. Sorted, unique.
     *
     * @return string[]
     */
    public static function control_types() {
        return ControlDocs::list_types();
    }

    /**
     * Structured docs for one control type — description, stored shape,
     * supports, config options.
     *
     * Resolves by FILENAME, so pass a name from control_types(). An alias
     * has no file of its own; use canonical_type() first if the name may
     * be an alias.
     *
     * @return array|null Frontmatter, or null when undocumented.
     */
    public static function control_docs($type) {
        return ControlDocs::get($type);
    }

    /**
     * What a control type stores — the WordPress attribute type (string,
     * number, integer, boolean, object, array) — derived, so a consumer never
     * keeps its own copy (gcb-pro's field drawer did, and drifted). Aliases
     * resolve first. Null for structural types, which store nothing, and for
     * names this install doesn't know.
     */
    public static function control_shape($type) {
        // By the type's OWN name: an alias shares a doc page, not a stored shape
        // (checkbox-group is documented on checkbox.md but stores an array).
        $type = (string) $type;
        if ($type === '' || self::is_structural($type)) {
            return null;
        }
        // Degrades when only part of lite is loaded (a consumer's test requiring
        // this file alone): no registry → the SDK's answer; no validator → null.
        $registered = class_exists(\GCBLite\Fields\ControlTypes::class) ? \GCBLite\Fields\ControlTypes::shape($type) : null;
        if ($registered !== null) {
            return $registered;
        }
        if (class_exists(BlockGcbValidator::class) && in_array($type, BlockGcbValidator::builtin_types(), true) && class_exists('\GCBFields\Schema')) {
            return \GCBFields\Schema::attribute_type($type);
        }
        return null;
    }

    /**
     * Where a control type comes from: 'built-in' (the fields SDK's / Lite's
     * documented set), 'gcb-lite' (Lite's own extra fields), 'registered'
     * (a theme or plugin, through gcblite_register_control_type()),
     * 'structural', or null when unknown.
     */
    public static function control_source($type) {
        $type = (string) $type;
        if ($type === '') {
            return null;
        }
        if (self::is_structural($type)) {
            return 'structural';
        }
        $source = class_exists(\GCBLite\Fields\ControlTypes::class) ? \GCBLite\Fields\ControlTypes::source($type) : null;
        if ($source !== null) {
            return $source;
        }
        return class_exists(BlockGcbValidator::class) && in_array($type, BlockGcbValidator::builtin_types(), true) ? 'built-in' : null;
    }

    /**
     * Every field type this install knows, one row each — the machine-readable
     * vocabulary (TODO.md, "Extension points" 2): type, shape, source, whether
     * it is documented, and its one-line description. Documented types first
     * (they are what an AI can be told about), sorted by name within each.
     *
     * @return array<int, array{type: string, shape: ?string, source: ?string, documented: bool, description: string}>
     */
    public static function list_controls() {
        $types = array_unique(array_merge(
            ControlDocs::list_types(),
            BlockGcbValidator::known_types()
        ));
        $rows = [];
        foreach ($types as $type) {
            if (self::is_structural($type)) {
                continue;
            }
            $docs   = ControlDocs::get(self::canonical_type($type));
            $rows[] = [
                'type'        => $type,
                'shape'       => self::control_shape($type),
                'source'      => self::control_source($type),
                'documented'  => is_array($docs),
                'description' => is_array($docs) ? trim((string) ($docs['description'] ?? '')) : '',
            ];
        }
        usort($rows, static function ($a, $b) {
            return [$b['documented'], $a['type']] <=> [$a['documented'], $b['type']];
        });
        return $rows;
    }

    /**
     * Resolve an alias to the type that owns the doc file. Returns the
     * input unchanged when it is already canonical or unknown.
     *
     * `heading` → `heading-level`, `textarea` → `text`.
     */
    public static function canonical_type($type) {
        $type = (string) $type;
        if ($type === '' || ControlDocs::get($type) !== null) {
            return $type;
        }
        foreach (ControlDocs::list_types() as $candidate) {
            $front = ControlDocs::get($candidate);
            if (!is_array($front)) continue;
            foreach ((array) ($front['aliases'] ?? []) as $alias) {
                if ($alias === $type) return $candidate;
            }
        }
        return $type;
    }

    /**
     * Types that render a panel header and produce no attribute. Skip these
     * when walking controls to build a value map.
     *
     * @return string[]
     */
    public static function structural_types() {
        return BlockGcbValidator::STRUCTURAL_TYPES;
    }

    public static function is_structural($type) {
        return in_array((string) $type, BlockGcbValidator::STRUCTURAL_TYPES, true);
    }

    // ------------------------------------------------------------------
    // 2. Schema validation — is this controls array well-formed?
    //
    // Shape validation (does this control declare a real type, a usable
    // attributeKey, a legal attributeType). Distinct from §3's validation
    // of a user's submitted VALUES against those controls.
    // ------------------------------------------------------------------

    /**
     * Validate a controls schema before trusting it — always do this with
     * anything model-generated or user-supplied.
     *
     * @param array $config ['controls' => [...], 'block_name' => '...']
     * @return array{ok: bool, errors: array<int, array{path: string, message: string}>}
     */
    public static function validate_schema(array $config) {
        return BlockGcbValidator::validate($config);
    }

    /** Convenience: validate a bare controls array. */
    public static function validate_controls(array $controls, $name = 'schema') {
        return BlockGcbValidator::validate([
            'block_name' => $name,
            'controls'   => $controls,
        ]);
    }

    // ------------------------------------------------------------------
    // 3. Values — validate, sanitize, and resolve visibility.
    //
    // The machinery all five field surfaces share. A sixth surface should
    // reuse it rather than growing its own rules: the JS mirror
    // (src/validation.js, fields-sdk/src/conditional-logic.js) is kept in
    // sync with THESE, so a private rule is a rule the editor won't show.
    // ------------------------------------------------------------------

    /**
     * Validate submitted values against their controls.
     *
     * @param array         $controls   Controls array.
     * @param array         $values     attributeKey => value.
     * @param callable|null $is_visible fn(array $control): bool — defaults to
     *                                  always-visible. Pass a closure over
     *                                  is_visible() to skip hidden fields.
     * @return array{ok: bool, errors?: array<string, string>}
     */
    public static function validate_values(array $controls, array $values, $is_visible = null) {
        return Validator::validate_all($controls, $values, $is_visible);
    }

    /**
     * Validate one value against one control.
     *
     * @return array{ok: bool, message?: string}
     */
    public static function validate_value(array $control, $value) {
        return Validator::validate_one($control, $value);
    }

    /**
     * Coerce values to their controls' shapes — run on EVERY save, separate
     * from validation. Drops unregistered repeater row keys, mints row ids.
     *
     * Lite's Sanitizer is per-control (`sanitize_one`); all four registrars
     * hand-roll the same loop around it. That loop is here so a fifth caller
     * doesn't write a fifth copy — and, more to the point, doesn't write one
     * that forgets to skip structural controls.
     *
     * Only keys with a matching control survive; anything else in $values is
     * dropped, so a crafted POST can't smuggle extra keys through.
     *
     * @return array Sanitized values, keyed by attributeKey.
     */
    public static function sanitize(array $controls, array $values) {
        $clean = [];
        foreach ($controls as $control) {
            if (!is_array($control)) continue;
            $key = $control['attributeKey'] ?? null;
            if (!is_string($key) || $key === '') continue;
            if (self::is_structural($control['type'] ?? '')) continue;

            $clean[$key] = Sanitizer::sanitize_one($control, $values[$key] ?? null);
        }
        return $clean;
    }

    /**
     * Whether a control is visible given the current values (conditional
     * logic). Mirrors fields-sdk's shouldRender() — a hidden field must not
     * be validated, or a form can become unsubmittable by a rule its author
     * cannot see.
     */
    public static function is_visible(array $control, array $values) {
        return Conditional::should_render($control, $values);
    }

    // ------------------------------------------------------------------
    // 4. Field registration — attach typed fields to a WordPress object.
    // ------------------------------------------------------------------

    /**
     * Register typed fields on a post type. Equivalent to the global
     * gcblite_register_post_fields(); prefer this from plugin code.
     *
     * @param string $post_type
     * @param array  $config Must contain 'controls'.
     */
    public static function register_post_fields($post_type, array $config) {
        Registrar::register($post_type, $config);
    }

    /**
     * The controls registered for a post type, or [] when none.
     *
     * This is the method gcb-pro has been calling against Lite since before
     * it existed (guarded by method_exists, so it always got []). It exists
     * here for real.
     *
     * @return array Controls array.
     */
    public static function controls_for($post_type) {
        $registry = Registrar::get_registered();
        $config   = $registry[$post_type] ?? null;
        if (!is_array($config)) return [];
        $controls = $config['controls'] ?? [];
        return is_array($controls) ? $controls : [];
    }

    /**
     * Every registered post-fields config, keyed by post type.
     *
     * @return array<string, array>
     */
    public static function registered_post_fields() {
        return Registrar::get_registered();
    }

    // ------------------------------------------------------------------
    // 5. Design tokens — the theme's palette, typography, spacing.
    //
    // Needed by anything rendering in the site's own visual language
    // rather than inventing values.
    // ------------------------------------------------------------------

    /**
     * The merged token tree from theme.json. Empty array outside WordPress.
     *
     * @return array
     */
    public static function tokens() {
        return TokenParser::tokens_for_editor();
    }

    // ------------------------------------------------------------------
    // 6. Query rendering.
    //
    // Frozen deliberately: gcb-pro writes this call as a literal string into
    // generated render.php. Changing the signature breaks files already on
    // disk, at render time. Treat as append-only.
    // ------------------------------------------------------------------

    /**
     * Render a paginated query region.
     *
     * @param array    $config      Query-loop control config.
     * @param callable $render_item fn(\WP_Post $post): string
     * @param array    $opts        'wrapper' => false for bare items;
     *                              'empty' => fn(string $message): string.
     * @return string
     */
    /**
     * THE STYLE A BACKGROUND FIELD PAINTS (the `background` control, 2026-10-03:
     * a colour, a gradient or a picture — one field, either/or). The twin of
     * src/controls/background-value.js `styleOf()`: the same value paints the
     * same style in the editor and here. '' when there is nothing to paint.
     * Generated render.php calls this by name, so its signature is frozen.
     *
     * WORDS OVER A PICTURE GET A SCRIM (Mark, 2026-10-03): `$scrim` = ['color' => a hex or a CSS gradient,
     * 'strength' => 0..100] is laid as the TOP background layer over a picture — a hex at its strength, a
     * gradient as given — so it needs no element. Over a colour or a gradient there is no picture to hold
     * the words off, and none is laid.
     *
     * @param mixed      $value the stored object, a bare colour/gradient string, or nothing
     * @param array|null $scrim ['color' => string, 'strength' => number], or null for none
     * @return string an inline style, safe inside a double-quoted style attribute
     */
    public static function background_style($value, ?array $scrim = null): string {
        /* WordPress hands an object attribute over with its nested objects as stdClass: arrays, all the way down */
        if (is_object($value)) {
            $value = json_decode((string) json_encode($value), true);
        }
        $color = ''; $gradient = ''; $image = null; $kind = '';
        if (is_string($value)) {
            if (strpos($value, 'gradient(') !== false) { $gradient = $value; } else { $color = $value; }
        } elseif (is_array($value)) {
            $color    = is_string($value['color'] ?? null) ? $value['color'] : '';
            $gradient = is_string($value['gradient'] ?? null) ? $value['gradient'] : '';
            $image    = is_array($value['image'] ?? null) && is_string($value['image']['url'] ?? null) && $value['image']['url'] !== '' ? $value['image'] : null;
            $kind     = is_string($value['kind'] ?? null) ? $value['kind'] : '';
        }
        /* nothing that could close the attribute or carry script: a colour is a hex, a function or a slug; a gradient a CSS function */
        $safeColor = static fn(string $c): string => preg_match('/^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d.,%\s\/]+\)|var\(--[\w-]+\)|transparent|currentColor|[a-z0-9-]+)$/i', $c) ? $c : '';
        $safeGradient = static fn(string $g): string => preg_match('/^[a-z-]+gradient\([^"<>;]*\)$/i', $g) ? $g : '';
        $color = $safeColor($color);
        $gradient = $safeGradient($gradient);
        $video = is_array($value) ? self::background_video(['kind' => 'video', 'video' => $value['video'] ?? null]) : null;
        $has = ['color' => $color !== '', 'gradient' => $gradient !== '', 'image' => $image !== null, 'video' => $video !== null];
        if (empty($has[$kind])) {
            $kind = $has['image'] ? 'image' : ($has['gradient'] ? 'gradient' : 'color');
        }
        $colorCss = static fn(string $c): string => preg_match('/^(#|rgb|hsl|var\(|transparent$|currentColor$)/i', $c) ? $c : 'var(--wp--preset--color--' . $c . ')';
        $out = [];
        if ($kind === 'color') {
            if ($color !== '') { $out[] = 'background-color:' . $colorCss($color); }
        } elseif ($kind === 'gradient') {
            if ($gradient !== '') { $out[] = 'background-image:' . $gradient; }
        } elseif ($kind === 'image' && $image) {
            if ($color !== '') { $out[] = 'background-color:' . $colorCss($color); }
            $size = ($image['size'] ?? '') === 'contain' ? 'contain'
                : (($image['size'] ?? '') === 'tile' ? 'auto'
                : ((($image['size'] ?? '') === 'custom' && !empty($image['customWidth']) && preg_match('/^[\d.]+(px|%|rem|em|vw)$/', (string) $image['customWidth'])) ? (string) $image['customWidth'] : 'cover'));
            $fp = is_array($image['focalPoint'] ?? null) ? $image['focalPoint'] : ['x' => 0.5, 'y' => 0.5];
            $pc = static fn($n): int => (int) round(min(1, max(0, (float) $n)) * 100);
            $layer = self::scrim_layer($scrim);
            $out[] = 'background-image:' . ($layer !== '' ? $layer . ',' : '') . 'url("' . str_replace('"', '%22', (string) $image['url']) . '")';
            $out[] = 'background-size:' . ($layer !== '' ? 'auto,' : '') . $size;
            $out[] = 'background-position:' . ($layer !== '' ? '0 0,' : '') . $pc($fp['x'] ?? 0.5) . '% ' . $pc($fp['y'] ?? 0.5) . '%';
            $out[] = 'background-repeat:' . ($layer !== '' ? 'no-repeat,' : '') . (!empty($image['isRepeat']) ? 'repeat' : 'no-repeat');
            if (!empty($image['isFixed'])) { $out[] = 'background-attachment:fixed'; }
        } elseif ($kind === 'video' && $video && $video['poster'] !== '') {
            /* its poster paints until the player is there, and in the editor; the render lays the player over it */
            if ($color !== '') { $out[] = 'background-color:' . $colorCss($color); }
            $out[] = 'background-image:url("' . str_replace('"', '%22', $video['poster']) . '")';
            $out[] = 'background-size:cover';
            $out[] = 'background-position:50% 50%';
            $out[] = 'background-repeat:no-repeat';
        }
        return implode(';', $out);
    }

    /**
     * A VIDEO BEHIND THE CONTENTS — what plays, when a background is a video: its address (the link wins over an
     * uploaded file), its poster, and how it plays. Always muted. null when it is not a video, or has nothing to play.
     * The player itself is the render's (gcb-pro lays Video.js's background player over the box).
     *
     * @return array{src:string,poster:string,autoplay:bool,loop:bool,phones:string,pause:bool}|null
     */
    public static function background_video($value): ?array {
        if (is_object($value)) {
            $value = json_decode((string) json_encode($value), true);
        }
        if (!is_array($value) || ($value['kind'] ?? '') !== 'video' || !is_array($value['video'] ?? null)) {
            return null;
        }
        $v    = $value['video'];
        $ok   = static fn($u): string => is_string($u) && preg_match('#^https?://[^\s"\'<>]+$#i', trim($u)) ? trim($u) : '';
        $link = $ok($v['link'] ?? '');
        $file = is_array($v['file'] ?? null) ? $ok($v['file']['url'] ?? '') : '';
        $src  = $link !== '' ? $link : $file;
        if ($src === '') {
            return null;
        }
        return [
            'src'      => $src,
            'poster'   => is_array($v['poster'] ?? null) ? $ok($v['poster']['url'] ?? '') : '',
            'autoplay' => ($v['autoplay'] ?? true) !== false,
            'loop'     => ($v['loop'] ?? true) !== false,
            'phones'   => ($v['phones'] ?? '') === 'poster' ? 'poster' : 'play',
            'pause'    => ($v['pause'] ?? true) !== false,
        ];
    }

    /**
     * A LIST'S LAYOUT AT RENDER — the layout control's value as the CSS that lays the list out (Mark, 2026-10-06: "an
     * advanced version of cards per row" — "it's another 'repeater' style layout"). The twin of
     * src/controls/layout-value.js layoutCss(): its columns and each item's place on a wide screen, its phone count on
     * a phone. Items take the boxes in reading order; after the last box the drawn rows repeat. '' when nothing is
     * stored, when the value is the drawn columns one box each, or when the list cannot take it.
     *
     * @param mixed  $value   the stored value: {cols, boxes:[{x,y,w,h}], phone}
     * @param array  $limits  the control: minCols, maxCols, minItemPx, containerPx, gapPx, cols (the drawn columns)
     * @param int    $count   how many items the list holds
     * @param string $list    the list's selector
     * @param string $item    the Nth item's selector, `%d` for N (from 1)
     */
    public static function layout_css($value, array $limits, int $count, string $list, string $item): string {
        if (is_object($value)) {
            $value = json_decode((string) json_encode($value), true);
        }
        $safe = static fn(string $sel): bool => $sel !== '' && !preg_match('/[{}<;]|\/\*/', $sel);
        if (!is_array($value) || !is_array($value['boxes'] ?? null) || !$value['boxes'] || $count < 1 || !$safe($list) || !$safe($item)) {
            return '';
        }
        $l = self::layout_limits($limits);
        $v = [
            'cols'  => (int) round((float) ($value['cols'] ?? 0)),
            'boxes' => array_map(static fn($b): array => [
                'x' => (int) round((float) ($b['x'] ?? 0)), 'y' => (int) round((float) ($b['y'] ?? 0)),
                'w' => (int) round((float) ($b['w'] ?? 1)), 'h' => (int) round((float) ($b['h'] ?? 1)),
            ], array_values(array_filter($value['boxes'], 'is_array'))),
            /* 1 or 2 per row on a phone, or 0: the same as wide screens */
            'phone' => self::layout_phone($value['phone'] ?? 1),
        ];
        if (!$v['boxes'] || $v['cols'] < $l['minCols'] || $v['cols'] > $l['maxCols'] || count($v['boxes']) > 48) {
            return '';
        }
        if (isset($value['minPx']) && is_numeric($value['minPx']) && (int) $value['minPx'] > 0) {
            $v['minPx'] = (int) round((float) $value['minPx']);
        }
        $span = self::layout_min_span($v, $limits);
        $rows = 1;
        foreach ($v['boxes'] as $k => $b) {
            if ($b['w'] < $span || $b['x'] < 0 || $b['y'] < 0 || $b['x'] + $b['w'] > $v['cols'] || $b['h'] < 1 || $b['h'] > 3) {
                return '';
            }
            foreach ($v['boxes'] as $j => $o) {
                if ($j > $k && $b['x'] < $o['x'] + $o['w'] && $o['x'] < $b['x'] + $b['w'] && $b['y'] < $o['y'] + $o['h'] && $o['y'] < $b['y'] + $b['h']) {
                    return '';
                }
            }
            $rows = max($rows, $b['y'] + $b['h']);
        }
        /* the drawn columns, one box each, in one row: the design stands */
        $even = $v['cols'] === $l['cols'] && $v['phone'] === 1 && count($v['boxes']) === $v['cols'] && $rows === 1;
        foreach ($v['boxes'] as $b) {
            $even = $even && $b['w'] === 1 && $b['h'] === 1;
        }
        if ($even) {
            return '';
        }
        /* `fill: false` on the control: the pictures keep the shape the block gives them, the rows size to their content
           (layout-value.js layoutCss says why — 2026-10-09) */
        $fill = !array_key_exists('fill', $limits) || $limits['fill'] !== false;
        $ord = $v['boxes'];
        usort($ord, static fn($a, $b) => $a['y'] <=> $b['y'] ?: $a['x'] <=> $b['x']);
        $n = count($ord);
        $places = '';
        for ($i = 0; $i < $count; $i++) {
            $b = $ord[$i % $n];
            $y = intdiv($i, $n) * $rows + $b['y'];
            $it = sprintf($item, $i + 1);
            /* a box bigger than one cell fills its cell with its picture (layout-value.js layoutCss says why): its lead picture,
               bare or the one picture in a drawn box, drops its drawn shape and takes the room its words leave */
            $big = $fill && ($b['w'] > 1 || $b['h'] > 1);
            $places .= $it . '{grid-column:' . ($b['x'] + 1) . ' / span ' . $b['w'] . '!important;grid-row:' . ($y + 1) . ' / span ' . $b['h'] . '!important'
                . ($big
                    ? ';display:flex!important;flex-direction:column}'
                        . $it . '>:first-child:is(img,picture,video,figure,:has(>:is(img,picture,video):only-child)){flex:1 1 0!important;min-height:12rem;height:auto!important;aspect-ratio:auto!important;object-fit:cover}'
                        . $it . '>:first-child>:is(img,picture,video):only-child{width:100%;height:100%;object-fit:cover}'
                    : '}');
        }
        /* rows of one height (Mark, 2026-10-06: "the cards heights don't get set properly") */
        $wide = $list . '{--cols:' . $v['cols'] . ';grid-template-columns:repeat(' . $v['cols'] . ',minmax(0,1fr))!important;grid-auto-rows:' . ($fill ? '1fr' : 'auto') . '!important}' . $places;
        /* the same as wide screens: the placement holds at every width, and there is no phone rule */
        if ($v['phone'] === 0) {
            return $wide;
        }
        return '@media (min-width:1024px){' . $wide . '}'
            . '@media (max-width:781px){' . $list . '{grid-template-columns:repeat(' . $v['phone'] . ',minmax(0,1fr))!important}}';
    }

    /** how many per row on a phone (layout-value.js phoneOf): 1 or 2, or 0 — the same as wide screens */
    public static function layout_phone($p): int {
        if ($p === 0 || $p === '0' || $p === 'same') {
            return 0;
        }
        return (int) $p === 2 ? 2 : 1;
    }

    /** what a list allows (layout-value.js limitsOf): its own min and max columns (else 1–12) and the narrowest its items may be */
    public static function layout_limits(array $c): array {
        $int = static fn($n): int => is_numeric($n) ? (int) round((float) $n) : 0;
        $max = max(1, min(12, $int($c['maxCols'] ?? 0) ?: 12));
        $min = max(1, min($max, $int($c['minCols'] ?? 0) ?: 1));
        return [
            'minCols'     => $min,
            'maxCols'     => $max,
            'minItemPx'   => max(0, $int($c['minItemPx'] ?? 0)),
            'containerPx' => $int($c['containerPx'] ?? 0) ?: 1200,
            'gapPx'       => array_key_exists('gapPx', $c) ? max(0, $int($c['gapPx'])) : 16,
            'cols'        => max($min, min($max, $int($c['cols'] ?? 0) ?: min(3, $max))),
        ];
    }

    /** the fewest columns an item spans (layout-value.js minSpanOf): the list's own narrowest, else its control's, against a column at this count */
    public static function layout_min_span(array $v, array $limits): int {
        $l    = self::layout_limits($limits);
        $px   = isset($v['minPx']) && is_numeric($v['minPx']) && (int) $v['minPx'] > 0 ? (int) round((float) $v['minPx']) : $l['minItemPx'];
        $cols = max(1, (int) ($v['cols'] ?? 1));
        if ($px <= 0) {
            return 1;
        }
        $colW = ($l['containerPx'] - $l['gapPx'] * ($cols - 1)) / $cols;
        return max(1, min($cols, (int) ceil(($px + $l['gapPx']) / ($colW + $l['gapPx']) - 1e-9)));
    }

    /** the scrim as one background layer: a hex at its strength → a flat rgba gradient; a gradient as given; '' for none */
    private static function scrim_layer(?array $scrim): string {
        if (!$scrim) {
            return '';
        }
        $c = trim((string) ($scrim['color'] ?? ''));
        $k = is_numeric($scrim['strength'] ?? null) ? max(0, min(100, (float) $scrim['strength'])) : 0;
        if ($c === '') {
            return '';
        }
        if (preg_match('/^(linear|radial|conic)-gradient\([^"<>;]*\)$/i', $c)) {
            return $k > 0 ? $c : '';
        }
        if (!preg_match('/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', $c) || $k <= 0) {
            return '';
        }
        $hex = ltrim($c, '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }
        $rgba = 'rgba(' . hexdec(substr($hex, 0, 2)) . ',' . hexdec(substr($hex, 2, 2)) . ',' . hexdec(substr($hex, 4, 2)) . ',' . rtrim(rtrim(number_format($k / 100, 2, '.', ''), '0'), '.') . ')';
        return 'linear-gradient(' . $rgba . ',' . $rgba . ')';
    }

    public static function render_items(array $config, callable $render_item, array $opts = []) {
        return QueryLoop::render_items($config, $render_item, $opts);
    }
}
