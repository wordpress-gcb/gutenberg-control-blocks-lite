<?php
/**
 * Frontend renderer for registered post-fields.
 *
 * Themes can drop into any template:
 *
 *     <?php gcblite_render_post_fields(); ?>
 *
 * Resolves the current post's type, fetches the registered schema, and
 * outputs an ACF-style "title + label + value" stack: one row per
 * non-structural control, with structural panels rendered as section
 * headings.
 *
 * The renderer is value-side: it formats stored post meta into readable
 * HTML. It is NOT an editor (the editor lives in the wp-admin metabox).
 *
 * @package GCBLite\PostFields
 */

namespace GCBLite\PostFields;

if (!defined('ABSPATH')) {
    exit;
}

class Renderer {

    public static function render($post_id = null) {
        $post_id = $post_id ?: get_the_ID();
        if (!$post_id) {
            echo '<p class="gcblite-fields-empty">No post in scope.</p>';
            return;
        }

        $post_type = get_post_type($post_id);
        $registry  = Registrar::get_registered();
        if (!isset($registry[$post_type])) {
            echo '<p class="gcblite-fields-empty">No fields registered for <code>' . esc_html($post_type) . '</code>.</p>';
            return;
        }

        $controls = $registry[$post_type]['controls'] ?? [];
        if (empty($controls)) {
            echo '<p class="gcblite-fields-empty">Schema has no controls.</p>';
            return;
        }

        // Group controls by their parent panel so we can render each
        // group/panel/tools-panel as a section heading with its children
        // beneath. Top-level (no parentPanelId) controls render in an
        // "Other" section at the top, before any group.
        $panels = [];
        $panel_meta = []; // id => { label, type }
        foreach ($controls as $c) {
            $type = $c['type'] ?? 'text';
            if (in_array($type, ['group', 'panel', 'tools-panel'], true)) {
                $panel_meta[$c['id']] = ['label' => $c['label'] ?? '', 'type' => $type];
                continue;
            }
            $parent = $c['parentPanelId'] ?? '__root';
            $panels[$parent][] = $c;
        }

        echo '<div class="gcblite-fields">';

        // Top-level (no panel) — render first if anything is there.
        if (!empty($panels['__root'])) {
            self::render_panel(null, $panels['__root'], $post_id);
        }

        // Walk panels in the order they were declared so authors control
        // the page layout via their schema ordering.
        foreach ($controls as $c) {
            $type = $c['type'] ?? 'text';
            if (!in_array($type, ['group', 'panel', 'tools-panel'], true)) continue;
            $children = $panels[$c['id']] ?? [];
            if (empty($children)) continue;
            self::render_panel($c, $children, $post_id);
        }

        echo '</div>';
    }

    private static function render_panel($panel_control, array $children, $post_id) {
        echo '<section class="gcblite-fields__panel">';
        if ($panel_control && !empty($panel_control['label'])) {
            echo '<h2 class="gcblite-fields__panel-title">' . esc_html($panel_control['label']) . '</h2>';
        }
        echo '<dl class="gcblite-fields__list">';
        foreach ($children as $c) {
            self::render_row($c, $post_id);
        }
        echo '</dl>';
        echo '</section>';
    }

    private static function render_row(array $control, $post_id) {
        $label = $control['label']        ?? '';
        $key   = $control['attributeKey'] ?? '';
        $type  = $control['type']         ?? 'text';
        $value = $key ? self::fetch_meta($post_id, $key) : null;

        echo '<div class="gcblite-fields__row gcblite-fields__row--' . esc_attr($type) . '">';
        echo '<dt class="gcblite-fields__label">';
        echo esc_html($label);
        if ($key) {
            echo ' <code class="gcblite-fields__key">' . esc_html($key) . '</code>';
        }
        echo '</dt>';
        echo '<dd class="gcblite-fields__value">';
        echo self::format_value($type, $value, $control);
        echo '</dd>';
        echo '</div>';
    }

    /**
     * Fetch + normalise a single post meta value. WP's get_post_meta
     * returns either a scalar (with single=true) or a wrapped array;
     * use single=true to keep it ergonomic. Try to decode JSON-stored
     * compound values (image objects, repeaters, etc.).
     */
    private static function fetch_meta($post_id, $key) {
        $raw = get_post_meta($post_id, $key, true);
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (json_last_error() === JSON_ERROR_NONE && (is_array($decoded) || is_object($decoded))) {
                return $decoded;
            }
        }
        return $raw;
    }

    /**
     * Per-type value formatting. Falls back to a JSON dump for unknown
     * compound types so nothing crashes — the row still shows up.
     */
    private static function format_value($type, $value, array $control) {
        if ($value === null || $value === '' || $value === []) {
            return '<span class="gcblite-fields__empty">—</span>';
        }
        switch ($type) {
            case 'text':
            case 'textarea':
            case 'email':
            case 'date':
            case 'datetime':
            case 'oembed':
                return '<span>' . esc_html((string) $value) . '</span>';

            case 'code':
                return '<pre class="gcblite-fields__code"><code>' . esc_html((string) $value) . '</code></pre>';

            case 'number':
            case 'range':
                return '<code>' . esc_html((string) $value) . '</code>';

            case 'toggle':
            case 'checkbox':
                $on = ($value === true || $value === '1' || $value === 1 || $value === 'true');
                return '<span class="gcblite-fields__bool gcblite-fields__bool--' . ($on ? 'on' : 'off') . '">'
                    . ($on ? '✓ Yes' : '✕ No') . '</span>';

            case 'url':
            case 'page-link':
                // Same stored shape: { url, text, opensInNewTab }. The
                // page-link control just biases its picker toward
                // existing posts/pages but the resulting value is a URL.
                $url  = is_array($value) ? ($value['url'] ?? '') : (string) $value;
                $text = is_array($value) ? ($value['text'] ?? $url) : $url;
                if (!$url) return '<span class="gcblite-fields__empty">—</span>';
                $new_tab = is_array($value) && !empty($value['opensInNewTab']);
                $attrs   = ' href="' . esc_url($url) . '"';
                if ($new_tab) $attrs .= ' target="_blank" rel="noopener noreferrer"';
                return '<a' . $attrs . '>' . esc_html($text) . '</a>';

            case 'select':
            case 'radio':
            case 'toggle-group':
            case 'button-group':
                $opts = $control['options'] ?? [];
                $label = self::option_label($opts, $value);
                return '<code>' . esc_html($label ?: (string) $value) . '</code>';

            case 'checkbox-group':
                $items = is_array($value) ? $value : [$value];
                $opts  = $control['options'] ?? [];
                $labels = array_map(fn($v) => self::option_label($opts, $v) ?: $v, $items);
                return '<span>' . esc_html(implode(', ', $labels)) . '</span>';

            case 'color':
                return '<span class="gcblite-fields__swatch" style="background:' . esc_attr((string) $value) . '"></span> '
                    . '<code>' . esc_html((string) $value) . '</code>';

            case 'image':
                if (!is_array($value) || empty($value['url'])) return '<span class="gcblite-fields__empty">—</span>';
                $alt = $value['alt'] ?? '';
                return '<figure class="gcblite-fields__image">'
                    . '<img src="' . esc_url($value['url']) . '" alt="' . esc_attr($alt) . '" loading="lazy" />'
                    . '</figure>';

            case 'gallery':
                if (!is_array($value)) return '<span class="gcblite-fields__empty">—</span>';
                $out = '<div class="gcblite-fields__gallery">';
                foreach ($value as $img) {
                    if (empty($img['url'])) continue;
                    $alt = $img['alt'] ?? '';
                    $out .= '<img src="' . esc_url($img['url']) . '" alt="' . esc_attr($alt) . '" loading="lazy" />';
                }
                return $out . '</div>';

            case 'file':
                $url = is_array($value) ? ($value['url'] ?? '') : (string) $value;
                $name = is_array($value) ? ($value['filename'] ?? ($value['title'] ?? $url)) : $url;
                if (!$url) return '<span class="gcblite-fields__empty">—</span>';
                return '<a href="' . esc_url($url) . '" download>' . esc_html($name) . '</a>';

            case 'icon':
                $name = is_array($value) ? ($value['name'] ?? '') : (string) $value;
                return '<code>' . esc_html($name) . '</code>';

            case 'richtext':
            case 'wysiwyg':
                return '<div class="gcblite-fields__richtext">' . wp_kses_post(is_string($value) ? $value : '') . '</div>';

            case 'post-object': {
                // Canonical shape: { post_type, ids[] } (always single
                // ID since post-object is single by default — but the
                // shape supports multi for future-proofing).
                $ids = self::collect_post_ids($value);
                if (empty($ids)) return '<span class="gcblite-fields__empty">—</span>';
                $id_val = $ids[0];
                $title = get_the_title($id_val);
                $url   = get_permalink($id_val);
                return $url ? '<a href="' . esc_url($url) . '">' . esc_html($title) . '</a>' : esc_html($title);
            }

            case 'relationship': {
                $ids = self::collect_post_ids($value);
                if (empty($ids)) return '<span class="gcblite-fields__empty">—</span>';
                $out = '<ul class="gcblite-fields__relationship">';
                foreach ($ids as $id_val) {
                    $out .= '<li><a href="' . esc_url(get_permalink($id_val)) . '">'
                        . esc_html(get_the_title($id_val)) . '</a></li>';
                }
                return $out . '</ul>';
            }

            case 'taxonomy': {
                // Canonical shape: { taxonomy, ids[] }.
                // Legacy shapes also handled via collect_term_ids:
                //   - single term id (int)
                //   - array of term ids
                //   - object { id, name, taxonomy }
                //   - array of those objects
                $taxonomy = '';
                if (is_array($value) && isset($value['taxonomy'])) {
                    $taxonomy = $value['taxonomy'];
                }
                // Fall back to the schema's declared taxonomy (legacy fields).
                if (!$taxonomy) $taxonomy = $control['taxonomy'] ?? '';

                $ids = self::collect_term_ids($value);
                if (empty($ids)) return '<span class="gcblite-fields__empty">—</span>';
                $links = [];
                foreach ($ids as $id_val) {
                    $term = self::resolve_term($id_val, $taxonomy);
                    if (!$term) continue;
                    $link = get_term_link($term);
                    $name = esc_html($term->name);
                    $links[] = !is_wp_error($link)
                        ? '<a href="' . esc_url($link) . '">' . $name . '</a>'
                        : $name;
                }
                if (empty($links)) return '<span class="gcblite-fields__empty">—</span>';
                return '<span>' . implode(', ', $links) . '</span>';
            }

            case 'user': {
                $ids = is_array($value)
                    ? array_map(fn($v) => is_array($v) ? (int) ($v['id'] ?? 0) : (int) $v, $value)
                    : [is_array($value) ? (int) ($value['id'] ?? 0) : (int) $value];
                $ids = array_filter($ids);
                if (empty($ids)) return '<span class="gcblite-fields__empty">—</span>';
                $names = [];
                foreach ($ids as $uid) {
                    $u = get_userdata($uid);
                    if ($u) $names[] = esc_html($u->display_name ?: $u->user_login);
                }
                if (empty($names)) return '<span class="gcblite-fields__empty">—</span>';
                return '<span>' . implode(', ', $names) . '</span>';
            }

            case 'repeater':
                if (!is_array($value)) return '<span class="gcblite-fields__empty">—</span>';
                $out = '<ol class="gcblite-fields__repeater">';
                foreach ($value as $row) {
                    $out .= '<li><pre>' . esc_html(wp_json_encode($row, JSON_PRETTY_PRINT)) . '</pre></li>';
                }
                return $out . '</ol>';
        }

        // Unknown / compound — dump as JSON. Better than disappearing.
        return '<pre class="gcblite-fields__json">'
            . esc_html(wp_json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES))
            . '</pre>';
    }

    private static function option_label(array $options, $value) {
        foreach ($options as $opt) {
            if (!is_array($opt)) continue;
            if (($opt['value'] ?? null) === $value) return $opt['label'] ?? '';
        }
        return '';
    }

    /**
     * Pull a flat list of term IDs out of whatever shape the taxonomy
     * control stored. Supports:
     *   - canonical { taxonomy, ids[] }   (preferred since v0.2)
     *   - bare scalar id                  (legacy single)
     *   - array of ids                    (legacy multi)
     *   - { id, name, taxonomy } object   (returnFormat=object, single)
     *   - array of those objects          (returnFormat=object, multi)
     */
    private static function collect_term_ids($value) {
        // Canonical shape — prefer it.
        if (is_array($value) && isset($value['ids']) && is_array($value['ids'])) {
            return array_values(array_filter(array_map('intval', $value['ids'])));
        }
        if (is_numeric($value)) return [(int) $value];
        if (is_array($value) && isset($value['id'])) return [(int) $value['id']];
        if (!is_array($value)) return [];
        $ids = [];
        foreach ($value as $entry) {
            if (is_numeric($entry)) {
                $ids[] = (int) $entry;
            } elseif (is_array($entry) && isset($entry['id'])) {
                $ids[] = (int) $entry['id'];
            }
        }
        return array_filter($ids);
    }

    /**
     * Same as collect_term_ids but for post-object / relationship.
     * Canonical shape: { post_type, ids[] }. Also accepts legacy bare
     * scalars and arrays of IDs / post-shaped objects.
     */
    private static function collect_post_ids($value) {
        if (is_array($value) && isset($value['ids']) && is_array($value['ids'])) {
            return array_values(array_filter(array_map('intval', $value['ids'])));
        }
        if (is_numeric($value)) return [(int) $value];
        if (is_array($value) && isset($value['id'])) return [(int) $value['id']];
        if (!is_array($value)) return [];
        $ids = [];
        foreach ($value as $entry) {
            if (is_numeric($entry)) {
                $ids[] = (int) $entry;
            } elseif (is_array($entry) && isset($entry['id'])) {
                $ids[] = (int) $entry['id'];
            }
        }
        return array_filter($ids);
    }

    /**
     * Resolve a term id to a WP_Term. When `$taxonomy` is known we use it
     * directly; otherwise fall back to scanning all registered taxonomies
     * (slow path, only hit when the schema didn't declare its taxonomy).
     */
    private static function resolve_term($id, $taxonomy = '') {
        if ($taxonomy) {
            $t = get_term((int) $id, $taxonomy);
            return $t && !is_wp_error($t) ? $t : null;
        }
        foreach (get_taxonomies([], 'names') as $tx) {
            $t = get_term((int) $id, $tx);
            if ($t && !is_wp_error($t)) return $t;
        }
        return null;
    }
}
