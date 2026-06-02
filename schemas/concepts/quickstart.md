---
slug: quickstart
title: Quickstart
section: Getting started
order: 2
---

GCB blocks render two ways: server-side in PHP (classic Gutenberg) or client-side in React on a Next.js / Astro / Remix component server. Pick the path that matches your stack — or use both. The same block, the same typed fields.

> You'll need WordPress 6.5+ with the block editor and a theme you can edit. For the React path you also need a component server — this guide uses Next.js.

## 1. Install the plugin

Clone into your plugins directory and build:

```bash
cd wp-content/plugins
git clone https://github.com/wordpress-gcb/gutenberg-control-blocks-lite gcb-lite
cd gcb-lite && composer install && npm install && npm run build
```

Then activate it under *Plugins* in wp-admin.

After activation, visit *Settings → GCB Lite*. If you're going to render in React, set the component server URL (e.g. `http://localhost:3001`). If you're rendering in PHP only, leave it blank.

## 2. Scaffold a block

From your theme's `blocks/` directory:

```bash
mkdir -p blocks/hello && cd blocks/hello
```

### `block.json`

Same as any WP block. The `render` field tells WP which path you want. Choose one:

:::codetabs
```json
{
  "$schema": "https://schemas.wp.org/trunk/block.json",
  "apiVersion": 3,
  "name": "myplugin/hello",
  "title": "Hello",
  "category": "common",
  "render": "file:./render.php"
}
```
```json
{
  "$schema": "https://schemas.wp.org/trunk/block.json",
  "apiVersion": 3,
  "name": "myplugin/hello",
  "title": "Hello",
  "category": "common"
}
```
:::

### `block.fields.json`

This is the GCB-specific bit. Declare your Inspector controls and their typed attributes — gcb-lite generates the WP attribute schema and renders the sidebar panel. **Identical for both paths.**

```json
{
  "controls": [
    { "id": "panel", "type": "group", "label": "Hello settings" },

    { "id": "ctrl_name",
      "type": "text",
      "label": "Name",
      "attributeKey": "name",
      "default": "world",
      "parentPanelId": "panel" },

    { "id": "ctrl_intro",
      "type": "textarea",
      "label": "Intro",
      "attributeKey": "intro",
      "validation": { "maxLength": 200 },
      "parentPanelId": "panel" }
  ]
}
```

## 3. Render the block

This is where the two paths diverge. Pick your tab:

:::codetabs
```php
<?php
/**
 * Same file referenced by block.json "render".
 * $attributes is an associative array of typed values matching
 * the keys you declared in block.fields.json.
 */
$name  = $attributes['name']  ?? 'world';
$intro = $attributes['intro'] ?? '';
?>
<section class="hello">
  <h2>Hello, <?php echo esc_html($name); ?>.</h2>
  <?php if ($intro): ?>
    <p><?php echo esc_html($intro); ?></p>
  <?php endif; ?>
</section>
```
```jsx
// components/Hello.jsx
export default function Hello({ attributes = {} }) {
  const { name = 'world', intro = '' } = attributes;
  return (
    <section className="hello">
      <h2>Hello, {name}.</h2>
      {intro && <p>{intro}</p>}
    </section>
  );
}

// Register in your block registry:
export const WP_BLOCK_REGISTRY = {
  'myplugin/hello': Hello,
  // ...
};
```
:::

## 4. Use it

Open the block editor for any page. Insert a new block, search for "Hello". You'll see the rendered output (PHP or React, whichever you wired) with the default values, and the Inspector sidebar showing the two fields from `block.fields.json`.

Edit the fields — the preview updates. Save the page and view it on the public site: same render, same markup. That's the parity.

> Next: read the [Field reference](/docs/fields) to see every control type and what shape of value it stores, or [Post fields](/docs/post-fields) to add typed fields to your CPTs.
