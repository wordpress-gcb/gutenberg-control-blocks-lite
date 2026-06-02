---
slug: blocks/build
title: Build a block
section: Blocks
order: 1
---

The whole point of GCB. A block is **a folder with three files** in your theme. Here's one from nothing to rendered, no detours.

We'll build a "callout" block: a heading, some body text, and a link.

## 1. Make the folder

Blocks live under `blocks/` in your active theme. The folder name is the block's slug:

```bash
cd wp-content/themes/your-theme
mkdir -p blocks/callout
```

You'll end up with three files in there:

```
blocks/callout/
├── block.json          ← standard WordPress block metadata
├── block.fields.json   ← your fields (the GCB part)
└── render.php          ← how it renders
```

## 2. `block.json` — name the block

Standard WordPress, nothing GCB-specific. The `render` line points at your PHP file:

```json
{
  "$schema": "https://schemas.wp.org/trunk/block.json",
  "apiVersion": 3,
  "name": "mytheme/callout",
  "title": "Callout",
  "category": "design",
  "icon": "megaphone",
  "render": "file:./render.php"
}
```

## 3. `block.fields.json` — declare the fields

This is the GCB file. Each control becomes a typed attribute the author edits in the Inspector sidebar. No `attributes` map to hand-write — GCB generates it from here.

```json
{
  "controls": [
    { "id": "panel", "type": "group", "label": "Callout" },

    { "id": "ctrl_heading", "type": "text", "label": "Heading",
      "attributeKey": "heading", "default": "Heads up",
      "parentPanelId": "panel" },

    { "id": "ctrl_body", "type": "textarea", "label": "Body",
      "attributeKey": "body", "default": "",
      "parentPanelId": "panel" },

    { "id": "ctrl_link", "type": "url", "label": "Link",
      "attributeKey": "link",
      "parentPanelId": "panel" }
  ]
}
```

Three fields: `heading` (a string), `body` (a string), `link` (a `url` object — `{ url, text, opensInNewTab }`). The `group` is just the panel they sit in.

## 4. `render.php` — turn fields into HTML

`$attributes` arrives as an associative array, keyed by the `attributeKey`s you declared. Read them, escape them, echo markup:

```php
<?php
/** @var array $attributes */
$heading = $attributes['heading'] ?? '';
$body    = $attributes['body']    ?? '';
$link    = $attributes['link']    ?? null;

$wrap = get_block_wrapper_attributes(['class' => 'callout']);
?>
<aside <?php echo $wrap; ?>>
  <?php if ($heading) : ?>
    <h3 class="callout__heading"><?php echo esc_html($heading); ?></h3>
  <?php endif; ?>

  <?php if ($body) : ?>
    <p class="callout__body"><?php echo esc_html($body); ?></p>
  <?php endif; ?>

  <?php if ($link && !empty($link['url'])) : ?>
    <a
      class="callout__link"
      href="<?php echo esc_url($link['url']); ?>"
      <?php if (!empty($link['opensInNewTab'])) : ?>target="_blank" rel="noopener"<?php endif; ?>
    >
      <?php echo esc_html($link['text'] ?: 'Learn more'); ?>
    </a>
  <?php endif; ?>
</aside>
```

That's a complete block. Three files.

## 5. See it

Activate (or reload) the theme. Open any page in the block editor, click **+**, search **Callout**, insert it. You'll see it render with the defaults, and the Inspector on the right shows your three fields. Edit them — the preview updates. Save, view the page on the front end — same markup. Done.

> **Each field's stored shape is documented.** `text` stores a string, `url` stores `{ url, text, opensInNewTab }`, `image` stores an object with `url`/`alt`/`focalPoint`/…. See the [field reference](/docs/fields) for every control and exactly what value it saves.

## Rendering in React instead

Everything above renders server-side in PHP — the simplest path, and all you need for a classic WordPress site. If your front end is React (Next.js, Astro, Remix), you write a component instead of `render.php` and register it; the **same `block.fields.json`** drives both. The component receives the same fields as props:

```jsx
export default function Callout({ attributes = {} }) {
  const { heading = '', body = '', link } = attributes;
  return (
    <aside className="callout">
      {heading && <h3 className="callout__heading">{heading}</h3>}
      {body && <p className="callout__body">{body}</p>}
      {link?.url && (
        <a
          className="callout__link"
          href={link.url}
          target={link.opensInNewTab ? '_blank' : undefined}
          rel={link.opensInNewTab ? 'noopener' : undefined}
        >
          {link.text || 'Learn more'}
        </a>
      )}
    </aside>
  );
}
```

Keep the two renderers emitting the same markup so the editor preview matches the live site. The full headless setup — registry, component server, deploy — is covered under [Headless rendering](/docs/headless).

## Next

- Add more field types → [Field reference](/docs/fields)
- Understand how fields become attributes → [Blocks & attributes](/docs/blocks)
- Nest child blocks or repeat rows → [Inner blocks & the repeater pattern](/docs/blocks/inner)
