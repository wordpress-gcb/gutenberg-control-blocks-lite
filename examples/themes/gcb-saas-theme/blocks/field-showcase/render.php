<?php
/**
 * GCB Field Showcase — renders every control type with:
 *   - a chip showing the control type
 *   - the human label
 *   - the field's rendered FE value (sensible per type)
 *   - a collapsible "raw stored JSON" details element
 *
 * Doubles as the all-fields demo (marketing) and the all-fields QA
 * surface (test that each control's stored shape round-trips through
 * render correctly).
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

$controls_json = file_get_contents(__DIR__ . '/block.fields.json');
$config = $controls_json ? json_decode($controls_json, true) : null;
$controls = is_array($config['controls'] ?? null) ? $config['controls'] : [];

$wrap = get_block_wrapper_attributes([
    'class'           => 'gcb-field-showcase',
    'data-block-name' => 'field-showcase',
    'data-props'      => wp_json_encode(['attributes' => $attributes]),
]);

/**
 * Render the FE-friendly representation of a single field's value.
 * Returns escaped HTML — callers can echo directly.
 */
/**
 * Force any value to a string in a way that won't fatal on objects.
 * Scalars cast directly; arrays and objects JSON-encode. Used for
 * fields where we'd otherwise call (string)$value and risk a
 * "Object of class stdClass could not be converted to string" fatal.
 */
$to_string = function ($v) {
    if (is_scalar($v) || $v === null) return (string) $v;
    return wp_json_encode($v);
};

$render_value = function (array $control, $value) use ($to_string) {
    if ($value === null || $value === '') {
        return '<span class="gcb-field-showcase__empty">—</span>';
    }

    switch ($control['type']) {
        case 'text':
        case 'textarea':
        case 'email':
        case 'code':
        case 'date':
        case 'datetime':
        case 'select':
        case 'radio':
        case 'size':
        case 'spacing':
        case 'oembed':
            return '<code class="gcb-field-showcase__inline">' . esc_html($to_string($value)) . '</code>';

        case 'icon':
            // Resolve via the WP 7.0+ icon registry. Storage shape is
            // { source: 'wp', name: 'core/foo' } — the React picker
            // saves that; render fetches the SVG content server-side.
            // Older saves used a free-text dashicon name; tolerate that
            // too by falling through to a label-only span.
            $name = '';
            if (is_array($value)) {
                $name = $value['name'] ?? $value['icon'] ?? '';
            } elseif (is_string($value)) {
                $name = $value;
            }
            if (!$name) return '<span class="gcb-field-showcase__empty">—</span>';
            $svg = '';
            if (class_exists('WP_Icons_Registry')) {
                $registry = \WP_Icons_Registry::get_instance();
                $icon = $registry->get_registered_icon($name);
                if ($icon && !empty($icon['content'])) {
                    $svg = (string) $icon['content'];
                }
            }
            if (!$svg) {
                return '<code class="gcb-field-showcase__inline">' . esc_html($name) . '</code>'
                    . '<span class="gcb-field-showcase__empty"> (icon not in registry)</span>';
            }
            // SVG content comes from a trusted server-side registry —
            // not author-editable. wp_kses_post would strip the svg
            // namespace + viewbox, so emit directly.
            return '<span class="gcb-field-showcase__icon">' . $svg . '</span>'
                . '<code class="gcb-field-showcase__inline">' . esc_html($name) . '</code>';

        case 'number':
        case 'range':
            return '<code class="gcb-field-showcase__inline">' . esc_html($to_string($value)) . '</code>';

        case 'checkbox':
        case 'toggle':
            return '<code class="gcb-field-showcase__inline">' . ($value ? 'true' : 'false') . '</code>';

        case 'checkbox-group':
        case 'button-group':
            if (!is_array($value)) return '—';
            return '<span class="gcb-field-showcase__chips">'
                . implode('', array_map(fn($v) => '<span class="gcb-field-showcase__chip">' . esc_html($to_string($v)) . '</span>', $value))
                . '</span>';

        case 'toggle-group':
            return '<span class="gcb-field-showcase__chip gcb-field-showcase__chip--active">' . esc_html($to_string($value)) . '</span>';

        case 'url':
            $url = is_array($value) ? ($value['url'] ?? '') : $to_string($value);
            $text = is_array($value) ? ($value['text'] ?? $url) : $url;
            $new_tab = is_array($value) && !empty($value['opensInNewTab']);
            if (!$url) return '—';
            return sprintf(
                '<a href="%s"%s>%s</a>',
                esc_url($url),
                $new_tab ? ' target="_blank" rel="noopener noreferrer"' : '',
                esc_html($text)
            );

        case 'color':
            // Color control stores a plain string — either a CSS color
            // ('#5956E9', 'rgb(...)') or a full CSS gradient declaration.
            // (Older shape was {color, gradient}; tolerate that too in
            // case something old round-trips through.)
            if (is_array($value)) {
                $value = $value['gradient'] ?? ($value['color'] ?? '');
            }
            $fill = is_string($value) ? trim($value) : '';
            if (!$fill) return '—';
            $is_gradient = strpos($fill, 'gradient(') !== false;
            // Gradients want `background-image` (or `background` shorthand);
            // solid colours work fine on either. Use `background` so both
            // shapes paint correctly with the same code path.
            return '<span class="gcb-field-showcase__swatch" style="background:' . esc_attr($fill) . '"></span>'
                . '<code class="gcb-field-showcase__inline">' . esc_html($is_gradient ? 'gradient' : $fill) . '</code>';

        case 'image':
            if (!is_array($value) || empty($value['url'])) return '—';
            // Render as a 16:9 background-image box so every part of
            // the stored shape is visible at a glance:
            //   - object-fit-equivalent via background-size (cover/contain/auto)
            //   - focal point as background-position (x% y%)
            //   - customWidth caps the box (e.g. 50%)
            //   - isFixed switches background-attachment to fixed
            //   - repeat toggles background-repeat
            $size = $value['size'] ?? 'cover';
            $bg_size = in_array($size, ['cover', 'contain'], true) ? $size : 'auto';
            $fp = $value['focalPoint'] ?? ['x' => 0.5, 'y' => 0.5];
            $bg_pos = sprintf('%d%% %d%%', (int) round((float) ($fp['x'] ?? 0.5) * 100), (int) round((float) ($fp['y'] ?? 0.5) * 100));
            $width = !empty($value['customWidth']) ? $value['customWidth'] : '100%';
            $repeat = !empty($value['repeat']) ? 'repeat' : 'no-repeat';
            $attach = !empty($value['isFixed']) ? 'fixed' : 'scroll';
            $style = sprintf(
                'background-image:url(%s);background-size:%s;background-position:%s;background-repeat:%s;background-attachment:%s;width:%s;',
                esc_url($value['url']),
                esc_attr($bg_size),
                esc_attr($bg_pos),
                esc_attr($repeat),
                esc_attr($attach),
                esc_attr($width)
            );
            return sprintf(
                '<div class="gcb-field-showcase__image" style="%s" role="img" aria-label="%s"></div>',
                $style,
                esc_attr($value['alt'] ?? '')
            );

        case 'gallery':
            if (!is_array($value) || empty($value)) return '—';
            $imgs = array_map(function ($img) {
                if (!is_array($img) || empty($img['url'])) return '';
                return sprintf(
                    '<img src="%s" alt="%s" />',
                    esc_url($img['url']),
                    esc_attr($img['alt'] ?? '')
                );
            }, $value);
            return '<div class="gcb-field-showcase__gallery">' . implode('', $imgs) . '</div>';

        case 'file':
            if (!is_array($value) || empty($value['url'])) return '—';
            return sprintf(
                '<a href="%s" class="gcb-field-showcase__file" download>%s</a>',
                esc_url($value['url']),
                esc_html($value['filename'] ?? $value['title'] ?? 'Download')
            );

        case 'wysiwyg':
        case 'richtext':
            return '<div class="gcb-field-showcase__html">' . wp_kses_post($to_string($value)) . '</div>';

        case 'message':
            // Message has no stored value — its display is the
            // `message` config string. Show that as a styled note.
            return '<div class="gcb-field-showcase__message">'
                . esc_html((string) ($control['message'] ?? ''))
                . '</div>';

        case 'heading-level':
            if (!is_array($value) || empty($value['text'])) return '—';
            $tag = in_array($value['level'] ?? 'h2', ['h1','h2','h3','h4','h5','h6'], true) ? $value['level'] : 'h2';
            return sprintf(
                '<%1$s class="gcb-field-showcase__heading">%2$s</%1$s>',
                esc_attr($tag),
                esc_html($value['text'])
            );

        case 'post-object':
        case 'page-link':
        case 'relationship':
            // Resolve id(s) → post titles so the FE shows real content
            // rather than raw integers. Both single-id and array shapes
            // are normalised first.
            $ids = is_array($value) ? $value : [$value];
            $items = array_filter(array_map(function ($id) {
                if (!$id) return null;
                $id = is_array($id) ? ($id['id'] ?? null) : $id;
                if (!$id) return null;
                $post = get_post((int) $id);
                if (!$post) return null;
                return sprintf(
                    '<li><a href="%s">%s</a> <span class="gcb-field-showcase__id">#%d</span></li>',
                    esc_url(get_permalink($post)),
                    esc_html(get_the_title($post)),
                    (int) $post->ID
                );
            }, $ids));
            if (empty($items)) return '—';
            return '<ul class="gcb-field-showcase__list">' . implode('', $items) . '</ul>';

        case 'taxonomy':
            // Resolve term id(s) → term name. Stored as scalar or array.
            $ids = is_array($value) ? $value : [$value];
            $taxonomy = $control['taxonomy'] ?? 'category';
            $items = array_filter(array_map(function ($id) use ($taxonomy) {
                $term = get_term((int) $id, $taxonomy);
                if (!$term || is_wp_error($term)) return null;
                return sprintf(
                    '<li>%s <span class="gcb-field-showcase__id">#%d</span></li>',
                    esc_html($term->name),
                    (int) $term->term_id
                );
            }, $ids));
            if (empty($items)) return '—';
            return '<ul class="gcb-field-showcase__list">' . implode('', $items) . '</ul>';

        case 'user':
            // Resolve user id(s) → display name + email.
            $ids = is_array($value) ? $value : [$value];
            $items = array_filter(array_map(function ($id) {
                $user = get_user_by('id', (int) $id);
                if (!$user) return null;
                return sprintf(
                    '<li>%s <span class="gcb-field-showcase__id">#%d %s</span></li>',
                    esc_html($user->display_name),
                    (int) $user->ID,
                    esc_html($user->user_email)
                );
            }, $ids));
            if (empty($items)) return '—';
            return '<ul class="gcb-field-showcase__list">' . implode('', $items) . '</ul>';

        case 'google-map':
            if (!is_array($value) || (!isset($value['lat']) && !isset($value['lng']))) return '—';
            $maps_key = class_exists('\GCBLite\Integrations\GoogleMapsKey')
                ? \GCBLite\Integrations\GoogleMapsKey::get()
                : '';
            $lat = (float) ($value['lat'] ?? 0);
            $lng = (float) ($value['lng'] ?? 0);
            $zoom = (int) ($value['zoom'] ?? 12);
            $address = $value['address'] ?? '';
            $meta = sprintf(
                '<dl class="gcb-field-showcase__row"><dt>address</dt><dd>%s</dd><dt>lat / lng</dt><dd><code>%s, %s</code></dd><dt>zoom</dt><dd>%d</dd></dl>',
                esc_html($address ?: '—'),
                esc_html($lat),
                esc_html($lng),
                $zoom
            );
            if ($maps_key) {
                $iframe_src = sprintf(
                    'https://www.google.com/maps/embed/v1/view?key=%s&center=%s,%s&zoom=%d',
                    rawurlencode($maps_key),
                    rawurlencode((string) $lat),
                    rawurlencode((string) $lng),
                    $zoom
                );
                $iframe = sprintf(
                    '<iframe class="gcb-field-showcase__map" loading="lazy" allowfullscreen src="%s" referrerpolicy="no-referrer-when-downgrade"></iframe>',
                    esc_url($iframe_src)
                );
                return $iframe . $meta;
            }
            return '<div class="gcb-field-showcase__map-missing">No Google Maps API key configured. Add one in <strong>Settings → GCB Lite</strong> to see an embedded map.</div>' . $meta;

        case 'repeater':
            if (!is_array($value) || empty($value)) return '—';
            $rows = array_map(function ($row) {
                if (!is_array($row)) return '';
                $cells = [];
                foreach ($row as $k => $v) {
                    if ($k === '_id') continue;
                    if (is_array($v)) {
                        // url-shape sub-field
                        if (!empty($v['url'])) {
                            $cells[] = sprintf(
                                '<dt>%s</dt><dd><a href="%s">%s</a></dd>',
                                esc_html($k),
                                esc_url($v['url']),
                                esc_html($v['text'] ?: $v['url'])
                            );
                        } else {
                            $cells[] = '<dt>' . esc_html($k) . '</dt><dd><code>' . esc_html(wp_json_encode($v)) . '</code></dd>';
                        }
                    } else {
                        $cells[] = '<dt>' . esc_html($k) . '</dt><dd>' . esc_html((string) $v) . '</dd>';
                    }
                }
                return '<dl class="gcb-field-showcase__row">' . implode('', $cells) . '</dl>';
            }, $value);
            return '<div class="gcb-field-showcase__repeater">' . implode('', $rows) . '</div>';
    }

    return '<code class="gcb-field-showcase__inline">' . esc_html(wp_json_encode($value)) . '</code>';
};

// Inline the block's compiled stylesheet alongside the markup so the
// block looks right wherever it lands — Kinsta page render, headless
// (Vercel) render-batch response, Playground demo, anyone iframing it.
// No reliance on a theme- or frontend-level CSS bundle. styles.css is
// compiled from gcb-next-starter/theme-bundle/_field-showcase.scss; see
// the header in that file for the recompile command.
$inline_css = @file_get_contents(__DIR__ . '/styles.css') ?: '';

// Render the per-row docs <details> body from the canonical markdown
// frontmatter at schemas/controls/{type}.md (read via
// GCBLite\Docs\ControlDocs). Returns '' when no docs file exists for
// the control type, so the caller can skip the wrapper entirely.
// Sections: description, stored shape, supports, configOptions,
// gotchas.
$render_control_docs = function ($type) {
    $docs = \GCBLite\Docs\ControlDocs::get($type);
    if (!$docs) return '';

    $out = '';
    if (!empty($docs['description'])) {
        $out .= '<p class="gcb-field-showcase__docs-desc">' . esc_html($docs['description']) . '</p>';
    }
    if (!empty($docs['stored'])) {
        $out .= '<p class="gcb-field-showcase__docs-stored"><strong>Stored:</strong> ' . esc_html($docs['stored']) . '</p>';
    }
    if (!empty($docs['supports']) && is_array($docs['supports'])) {
        $out .= '<h4 class="gcb-field-showcase__docs-h">Supports</h4><ul class="gcb-field-showcase__docs-list">';
        foreach ($docs['supports'] as $item) {
            $out .= '<li>' . esc_html((string) $item) . '</li>';
        }
        $out .= '</ul>';
    }
    if (!empty($docs['configOptions']) && is_array($docs['configOptions'])) {
        $out .= '<h4 class="gcb-field-showcase__docs-h">Config options</h4><dl class="gcb-field-showcase__docs-config">';
        foreach ($docs['configOptions'] as $opt) {
            if (!is_array($opt) || empty($opt['name'])) continue;
            $name = esc_html($opt['name']);
            $opt_type = !empty($opt['type']) ? ' <span class="gcb-field-showcase__docs-type">' . esc_html($opt['type']) . '</span>' : '';
            $default = isset($opt['default']) ? ' <span class="gcb-field-showcase__docs-default">default: ' . esc_html(wp_json_encode($opt['default'])) . '</span>' : '';
            $desc = !empty($opt['description']) ? esc_html($opt['description']) : '';
            $out .= '<dt><code>' . $name . '</code>' . $opt_type . $default . '</dt><dd>' . $desc . '</dd>';
        }
        $out .= '</dl>';
    }
    if (!empty($docs['gotchas']) && is_array($docs['gotchas'])) {
        $out .= '<h4 class="gcb-field-showcase__docs-h">Gotchas</h4><ul class="gcb-field-showcase__docs-list">';
        foreach ($docs['gotchas'] as $item) {
            $out .= '<li>' . esc_html((string) $item) . '</li>';
        }
        $out .= '</ul>';
    }
    return $out;
};

?>
<div <?php echo $wrap; ?>>
    <?php if ($inline_css !== ''): ?>
        <style data-gcb-field-showcase-inline><?php echo $inline_css; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped — author-controlled CSS file shipped with the block ?></style>
    <?php endif; ?>
    <header class="gcb-field-showcase__header">
        <h2 class="gcb-field-showcase__title">Every field type</h2>
        <p class="gcb-field-showcase__lede">One of every gcb-lite control rendered server-side. Edit any field via the Inspector or click directly on a value below — the Inspector opens at the matching control. The "Raw" toggle on each row shows the stored JSON.</p>
    </header>

    <?php
    // Group controls by their parentPanelId so the page reads in
    // sections that match the Inspector layout.
    $groups = [];
    $group_titles = [];
    foreach ($controls as $c) {
        if (($c['type'] ?? '') === 'group') {
            $group_titles[$c['id']] = $c['label'];
            $groups[$c['id']] = [];
            continue;
        }
        $pid = $c['parentPanelId'] ?? '__ungrouped';
        $groups[$pid][] = $c;
    }

    foreach ($groups as $pid => $controls_in_group):
        if (empty($controls_in_group)) continue;
    ?>
        <section class="gcb-field-showcase__group">
            <h3 class="gcb-field-showcase__group-title"><?php echo esc_html($group_titles[$pid] ?? $pid); ?></h3>
            <?php foreach ($controls_in_group as $control):
                $key = $control['attributeKey'] ?? '';
                if (!$key) continue;
                $value = $attributes[$key] ?? ($control['default'] ?? null);
            ?>
                <article class="gcb-field-showcase__field" <?php gcb_focus($key); ?>>
                    <header class="gcb-field-showcase__field-head">
                        <span class="gcb-field-showcase__type"><?php echo esc_html($control['type']); ?></span>
                        <span class="gcb-field-showcase__label"><?php echo esc_html($control['label'] ?? $key); ?></span>
                        <code class="gcb-field-showcase__key"><?php echo esc_html($key); ?></code>
                    </header>
                    <div class="gcb-field-showcase__value">
                        <?php echo $render_value($control, $value); ?>
                    </div>
                    <?php
                    $docs_html = $render_control_docs($control['type']);
                    if ($docs_html !== ''):
                    ?>
                        <details class="gcb-field-showcase__docs">
                            <summary>Docs</summary>
                            <div class="gcb-field-showcase__docs-body">
                                <?php echo $docs_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped — esc_html applied per-field inside renderer ?>
                            </div>
                        </details>
                    <?php endif; ?>
                    <details class="gcb-field-showcase__raw">
                        <summary>Raw value</summary>
                        <pre><code><?php echo esc_html(wp_json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)); ?></code></pre>
                    </details>
                </article>
            <?php endforeach; ?>
        </section>
    <?php endforeach; ?>
</div>
