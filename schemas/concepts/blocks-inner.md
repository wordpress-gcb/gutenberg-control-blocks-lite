---
slug: blocks/inner
title: Inner blocks & the repeater pattern
section: Blocks
order: 2
---

There are two ways to repeat content in a GCB block, and they store data in completely different places. Pick by whether each repeated item is *a few fields* or *a whole block*.

| | Repeater **control** | Repeater **of inner blocks** |
| --- | --- | --- |
| Each item is | a small set of fields | a full child block |
| Stored as | one `array` attribute on the parent | the parent's `innerBlocks` |
| Edited via | a form-of-forms in the Inspector | dragging/editing blocks on the canvas |
| Use when | links, stats, FAQ rows | feature cards, slides, anything with its own rich body |

## 1. The repeater control — array of objects

A `repeater` control is a field whose value is an **array of row objects**. Each row has the sub-fields you declare, plus a stable `_id`:

```json
{
  "type": "repeater",
  "attributeKey": "links",
  "label": "Links",
  "collapsedTitle": "label",
  "addButtonLabel": "Add link",
  "fields": [
    { "attributeKey": "label", "type": "text", "label": "Label" },
    { "attributeKey": "url",   "type": "url",  "label": "URL" }
  ]
}
```

Stored value:

```json
[
  { "_id": "r1", "label": "Docs",   "url": { "url": "/docs",   "text": "Docs",   "opensInNewTab": false } },
  { "_id": "r2", "label": "GitHub", "url": { "url": "https://github.com/…", "text": "GitHub", "opensInNewTab": true } }
]
```

Config keys: `fields` (the sub-controls), `collapsedTitle` (which sub-field labels each collapsed row), `addButtonLabel`, and `default` (seed rows — include an `_id`). You iterate the array on render:

:::codetabs
```php
<?php
$links = $attributes['links'] ?? [];
foreach ($links as $row) :
  $url = $row['url']['url'] ?? '';
  if (!$url) continue; ?>
  <a href="<?php echo esc_url($url); ?>"
     <?php if (!empty($row['url']['opensInNewTab'])) : ?>target="_blank" rel="noopener"<?php endif; ?>>
    <?php echo esc_html($row['label'] ?? ''); ?>
  </a>
<?php endforeach; ?>
```
```jsx
export default function Links({ attributes = {} }) {
  const { links = [] } = attributes;
  return links
    .filter((row) => row.url?.url)
    .map((row) => (
      <a
        key={row._id}
        href={row.url.url}
        target={row.url.opensInNewTab ? '_blank' : undefined}
        rel={row.url.opensInNewTab ? 'noopener' : undefined}
      >
        {row.label}
      </a>
    ));
}
```
:::

See the [`repeater` field reference](/docs/fields/repeater) for the full control config.

## 2. Inner blocks — children are the data

When each item is itself a block, you don't store an attribute at all. The children live in the parent's `innerBlocks`, and you mark *where* they render with a `<Repeater>` (or `<InnerBlocks>`) tag.

A parent declares which children it accepts and the child constraints in `block.fields.json`:

```json
{
  "controls": [
    { "id": "panel", "type": "group", "label": "Header" },
    { "id": "ctrl_heading", "type": "text", "label": "Heading", "attributeKey": "heading", "default": "" }
  ],
  "allowed_blocks": ["gcb/feature-item"],
  "child_constraints": {
    "defaultChildren": 3,
    "minChildren": 1,
    "addButtonLabel": "Add feature"
  }
}
```

The parent renders its own fields, then drops the marker where children belong:

:::codetabs
```php
<?php
$heading = $attributes['heading'] ?? '';
$wrap = get_block_wrapper_attributes(['class' => 'gcb-feature-trio']);
?>
<section <?php echo $wrap; ?>>
  <?php if ($heading) : ?><h2><?php echo esc_html($heading); ?></h2><?php endif; ?>
  <div class="grid">
    <Repeater
      allowedBlocks='["gcb/feature-item"]'
      addButtonLabel="Add feature"
      min="1"
      defaultChildren="3"
    />
  </div>
</section>
```
```jsx
import Repeater from './Repeater';

export default function FeatureTrio({ attributes = {}, innerBlocks = [] }) {
  const { heading = '' } = attributes;
  return (
    <section className="gcb-feature-trio">
      {heading && <h2>{heading}</h2>}
      <div className="grid">
        <Repeater
          blocks={innerBlocks}
          allowedBlocks={['gcb/feature-item']}
          addButtonLabel="Add feature"
          min={1}
          defaultChildren={3}
        />
      </div>
    </section>
  );
}
```
:::

The child block (`gcb/feature-item`) is an ordinary GCB block with its own `block.fields.json` — `icon`, `title`, `body` fields — and its own `render.php` / component.

> `<Repeater>` is sugar for `<InnerBlocks>` with an add-button affordance. Use `<InnerBlocks />` directly when you want a freeform slot rather than a repeating list of one child type.

### What the marker tag actually does

The same `<Repeater>` / `<InnerBlocks>` tag is swapped for different things depending on context — that's how one template serves both the editor and the public site:

- **Editor preview** — swapped for a real WordPress `InnerBlocks` slot (the draggable, editable canvas region). On the React side, `<InnerBlocks />` with no `blocks` prop emits a lowercase `<innerblocks>` marker that the editor's parse step replaces.
- **Public render (PHP)** — `InnerBlocksReplacer` runs on the `render_block` filter, recursively renders each child via `render_block()`, and substitutes the result for the marker tag.
- **Public render (React)** — `BlockRenderer` passes the parsed `innerBlocks` array straight into `<Repeater blocks={innerBlocks} …>`, which recurses through `BlockRenderer` to render each child component.

So in PHP the children arrive pre-rendered as `$content` (and the marker is replaced), while in React you receive the structured `innerBlocks` array and render it yourself. Either way the parent template never hard-codes the children — they're authored on the canvas.

### Core container blocks (cover, group, columns)

Core WordPress containers don't use the marker tag; they carry an `innerContent` array where `null` entries are child slots. The React `BlockRenderer` reconstructs them by walking `innerContent`, filling each `null` with the next rendered child. If core blocks render unstyled in a headless setup, link the WordPress block-library stylesheet into your layout — the markup is correct but the `.wp-block-*` selectors are unstyled without it.
