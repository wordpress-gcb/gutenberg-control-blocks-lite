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
$render_value = function (array $control, $value) {
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
        case 'icon':
        case 'select':
        case 'radio':
        case 'size':
        case 'spacing':
        case 'oembed':
            return '<code class="gcb-field-showcase__inline">' . esc_html((string) $value) . '</code>';

        case 'number':
        case 'range':
            return '<code class="gcb-field-showcase__inline">' . esc_html((string) $value) . '</code>';

        case 'checkbox':
        case 'toggle':
            return '<code class="gcb-field-showcase__inline">' . ($value ? 'true' : 'false') . '</code>';

        case 'checkbox-group':
        case 'button-group':
            if (!is_array($value)) return '—';
            return '<span class="gcb-field-showcase__chips">'
                . implode('', array_map(fn($v) => '<span class="gcb-field-showcase__chip">' . esc_html((string) $v) . '</span>', $value))
                . '</span>';

        case 'toggle-group':
            return '<span class="gcb-field-showcase__chip gcb-field-showcase__chip--active">' . esc_html((string) $value) . '</span>';

        case 'url':
            $url = is_array($value) ? ($value['url'] ?? '') : (string) $value;
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
            if (!is_array($value)) return '—';
            $color = $value['color'] ?? '';
            $gradient = $value['gradient'] ?? '';
            $fill = $gradient ?: $color;
            if (!$fill) return '—';
            return '<span class="gcb-field-showcase__swatch" style="background:' . esc_attr($fill) . '"></span>'
                . '<code class="gcb-field-showcase__inline">' . esc_html($fill) . '</code>';

        case 'image':
            if (!is_array($value) || empty($value['url'])) return '—';
            return sprintf(
                '<img class="gcb-field-showcase__image" src="%s" alt="%s" />',
                esc_url($value['url']),
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
            return '<div class="gcb-field-showcase__html">' . wp_kses_post((string) $value) . '</div>';

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
        case 'taxonomy':
        case 'user':
        case 'relationship':
            // Reference fields store id(s). For demo purposes show
            // the raw id; the real React frontend would dereference.
            return '<code class="gcb-field-showcase__inline">' . esc_html(is_array($value) ? wp_json_encode($value) : (string) $value) . '</code>';

        case 'google-map':
            if (!is_array($value) || (!isset($value['lat']) && !isset($value['lng']))) return '—';
            return '<code class="gcb-field-showcase__inline">'
                . esc_html(($value['lat'] ?? '?') . ', ' . ($value['lng'] ?? '?'))
                . '</code>';

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

?>
<div <?php echo $wrap; ?>>
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
                    <details class="gcb-field-showcase__raw">
                        <summary>Raw value</summary>
                        <pre><code><?php echo esc_html(wp_json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)); ?></code></pre>
                    </details>
                </article>
            <?php endforeach; ?>
        </section>
    <?php endforeach; ?>
</div>
