---
title: GCB Lite documentation
section: Getting started
order: 1
---

Typed Inspector fields for Gutenberg, declared as JSON files in your theme. No admin-UI field-group screens. No database-backed field config. The block's `block.fields.json` is the source of truth, version-controlled alongside its `block.json` and its render code.

Render the same block in PHP, React, or both:

:::codetabs
```json
{
  "controls": [
    { "id": "panel", "type": "group", "label": "Hello" },
    { "id": "ctrl_name",
      "type": "text",
      "attributeKey": "name",
      "label": "Name",
      "default": "world",
      "parentPanelId": "panel" }
  ]
}
```
```php
<?php
$name = $attributes['name'] ?? 'world';
?>
<h2>Hello, <?php echo esc_html($name); ?>.</h2>
```
```jsx
export default function Hello({ attributes = {} }) {
  const { name = 'world' } = attributes;
  return <h2>Hello, {name}.</h2>;
}
```
:::

> New here? Start with the [Quickstart](/docs/quickstart) — install the plugin, scaffold your first block, see it render in ten minutes.

## What you get

- **File-based schemas.** Field config lives in JSON beside its block, not in *wp_options*. Diffable in git, reviewable in PRs, mergeable.
- **No UI authoring.** There's no Field Groups screen to click through. Add a control by adding a JSON object.
- **Scaffold CLI built for stdin.** `wp gcblite scaffold` reads a field spec from stdin and writes the block files — terminal, CI, or any other process that can pipe JSON.
- **30+ typed control types.** text, textarea, image, url, post-object, taxonomy, repeater, heading-level, conditional logic, validation. See the [Field reference](/docs/fields).
- **Render PHP or React, or both.** Same `block.fields.json`, same typed attrs. Pick the render path per block.
- **Editor/frontend parity (React path).** One component renders the editor preview AND the live site — no `edit.js` to maintain in parallel.

## Where to go next

- **[Quickstart](/docs/quickstart)** — install, create your first block, render it both ways.
- **[Field reference](/docs/fields)** — every Inspector control type, the shape of its saved value, copy-paste examples.
- **[Post fields](/docs/post-fields)** — attach typed fields to CPTs using `gcblite_register_post_fields()`.
- **[Headless rendering](/docs/headless)** — parse block markup, dispatch to React components, fetch via REST.

## The shape of a GCB block

- `block.json` — WP's standard block metadata.
- `block.fields.json` — GCB's Inspector control declarations.
- `render.php` (PHP path) or a React component on your component server (React path) — or both.

gcb-lite reads `block.fields.json`, generates a typed WP attribute schema, renders the Inspector panel, and feeds the resolved attrs into whichever render path the block declares.
