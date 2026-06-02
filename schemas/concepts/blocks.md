---
slug: blocks
title: Blocks & attributes
section: Blocks
order: 2
---

A GCB block is three files in a folder:

- `block.json` — the standard WordPress block metadata (name, title, category, the render entry point).
- `block.fields.json` — the Inspector: a `controls` array that becomes the block's typed attributes. This is the GCB-specific piece.
- `render.php` and/or a React component — how the saved attributes turn into markup.

The block's attributes are *derived from* `block.fields.json` — you don't hand-write an `attributes` map in `block.json`. Every control with an `attributeKey` becomes one attribute, typed automatically from the control type.

## A block, end to end

A minimal hero. The `block.fields.json` declares four fields:

```json
{
  "controls": [
    { "id": "panel", "type": "group", "label": "Content" },
    { "id": "ctrl_eyebrow", "type": "text",    "label": "Eyebrow", "attributeKey": "eyebrow", "default": "" },
    { "id": "ctrl_heading", "type": "text",    "label": "Heading", "attributeKey": "heading", "default": "" },
    { "id": "ctrl_body",    "type": "wysiwyg", "label": "Body",    "attributeKey": "body",    "default": "" },
    { "id": "ctrl_image",   "type": "image",   "label": "Image",   "attributeKey": "image" }
  ]
}
```

That produces these WordPress attributes automatically:

| `attributeKey` | Stored type | Why |
| --- | --- | --- |
| `eyebrow` | `string` | `text` control |
| `heading` | `string` | `text` control |
| `body` | `string` | `wysiwyg` control |
| `image` | `object` | `image` control stores `{ url, alt, width, height, focalPoint, … }` |

Then you render those attributes — in PHP, React, or both:

:::codetabs
```php
<?php
/** @var array $attributes */
$eyebrow = $attributes['eyebrow'] ?? '';
$heading = $attributes['heading'] ?? '';
$image   = $attributes['image']   ?? null;

$wrap = get_block_wrapper_attributes(['class' => 'gcb-hero']);
?>
<section <?php echo $wrap; ?>>
  <?php if ($eyebrow) : ?><p class="eyebrow"><?php echo esc_html($eyebrow); ?></p><?php endif; ?>
  <?php if ($heading) : ?><h1><?php echo esc_html($heading); ?></h1><?php endif; ?>
  <?php if ($image && !empty($image['url'])) : ?>
    <img src="<?php echo esc_url($image['url']); ?>" alt="<?php echo esc_attr($image['alt'] ?? ''); ?>">
  <?php endif; ?>
</section>
```
```jsx
export default function Hero({ attributes = {} }) {
  const { eyebrow = '', heading = '', image } = attributes;
  return (
    <section className="gcb-hero">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      {heading && <h1>{heading}</h1>}
      {image?.url && <img src={image.url} alt={image.alt || ''} />}
    </section>
  );
}
```
:::

Same field, same key, same source of truth — `render.php` reads `$attributes['heading']`, the React component reads `attributes.heading`. Keep the two twins emitting the same markup (classes, conditional branches); drift breaks editor previews.

## How control types map to attribute types

You rarely set a stored type yourself. The control type decides it:

- **string** — `text`, `textarea`, `email`, `code`, `wysiwyg`, `richtext`, `select`, `radio`, `button-group`, `oembed`, `page-link`, `size`, `spacing`
- **number** — `number`, `range`
- **boolean** — `toggle`, `checkbox`
- **array** — `checkbox-group`, `gallery`, `taxonomy`, `relationship`, `repeater`
- **object** — `image`, `file`, `url`, `post-object`, `user`, `google-map`, `color`, `icon`
- **no attribute** — `group`, `panel`, `tools-panel` (layout only), `heading`, `message` (display only)

To override — e.g. a `toggle-group` that should store a `string` value rather than the default — set `attributeType` explicitly on the control:

```json
{
  "type": "toggle-group", "label": "Image position", "attributeKey": "imageSide",
  "attributeType": "string", "default": "right",
  "options": [
    { "label": "Left",  "value": "left"  },
    { "label": "Right", "value": "right" }
  ]
}
```

For the exact stored shape of any control (what keys an `image` or `url` object holds, etc.), see the [field reference](/docs/fields).

## Defaults

A control's `default` becomes the attribute's default. WordPress only persists values that *differ* from the default, so on render you merge saved attributes over defaults. The React renderer does this for you via the block-defaults endpoint; in PHP the registered default fills in `$attributes['key'] ?? $default` automatically.

## Inner blocks

Blocks can nest. A "feature trio" parent that holds repeated "feature item" children is the canonical case — see [Inner blocks & the repeater pattern](/docs/blocks/inner).
