---
title: GCB Lite documentation
section: Getting started
order: 1
---

# Build in code. Edit visually.

GCB gives developers complete control over Gutenberg block development while delivering a premium editing experience for clients. Fields and configuration live in code. Frontends stay flexible. No duplicate implementations, no unnecessary abstractions. Just Gutenberg, on your terms.
GCB came from a real need: using WordPress as a CMS for high-profile client work again.

There's no shortage of CMS options today, and WordPress has drifted a long way from the developer-focused platform it once was. But it still offers something almost nothing else can: the ability to build exactly what you want, quickly, without giving up ownership or flexibility. GCB brings that feeling back to Gutenberg.
No opinionated architecture. No prescribed workflows. Just a native Gutenberg experience that lets you build blocks your way. You control the block, its fields, its capabilities, its validation, and its rendering, all in code, where it belongs. Build inside WordPress or use it purely as a CMS behind a headless frontend; either way, GCB stays out of the way.

And it isn't only blocks. The same field library powers structured content you'd rather not edit visually. Say you've got a People Pages section: define the data in structured fields and relate it to a component, using the exact same edit fields you'd use anywhere else. Drop those fields into options pages, taxonomies and terms, user profiles, wherever you need them. One field library, everywhere, all native.
The frontend is yours. React, Vue, Astro, plain PHP, something that doesn't exist yet. It doesn't matter. Your frontend connects to WordPress as a CMS and stays visually editable through Gutenberg, with full access to its editing capabilities and no separate editor to maintain.

Build once. Edit visually. No duplication.
For clients, the result feels less like WordPress and more like a premium CMS built around their needs. Every field, option, layout, and workflow is yours to shape. You decide how much flexibility they get, where the guardrails belong, and how content is validated.
Point. Click. Edit. Your clients get a world-class editing experience while you get the most out of Gutenberg.
Maximum control. Minimum moving parts.

Visual building, point, click and edit. 

while getting the most out of Gutenberg 


Typed Inspector fields for Gutenberg, declared as JSON files in your theme. The block's `block.fields.json` is the source of truth, version-controlled alongside its `block.json` and its render code.

## The contract

Here's the part that makes the rest easy: **Gutenberg only ever sees HTML.**

It doesn't care how you produced it — PHP, React, Vue, a template engine, a hand-written string. By the time Gutenberg is involved, it's just markup. Your whole job is to hand it HTML with two things marked in it:

1. **Where attributes wire in** — read a value (`name`, `heading`, whatever you named it in `block.fields.json`) and drop it into your markup.
2. **Where child blocks go** — a `<Repeater />` or `<InnerBlocks />` marker, if the block nests other blocks. Skip it if it doesn't.

That's it. GCB takes your HTML and, wherever it finds the marker, swaps in the rendered child blocks. It's display — you describe what to show and where the children land.

So the two paths below aren't two systems to learn. They're the **same contract, produced in two different places.** Tell us how you build:

:::paths
== I'm building in PHP ==

Everything lives in your WordPress theme. Three files in `blocks/{slug}/`.

**`block.fields.json`** — the controls your client sees. `attributeKey` is the name you read in your markup.

```json
{
  "controls": [
    { "id": "panel", "type": "group", "label": "Hello" },
    { "id": "ctrl_name", "type": "text", "label": "Name",
      "attributeKey": "name", "default": "world", "parentPanelId": "panel" }
  ]
}
```

**`block.json`** — WP's standard block metadata; `render` points at your file.

```json
{
  "$schema": "https://schemas.wp.org/trunk/block.json",
  "apiVersion": 3,
  "name": "gcb/hello",
  "title": "Hello",
  "category": "widgets",
  "render": "file:./render.php"
}
```

**`render.php`** — your HTML. Read attributes off `$attributes`; that's the whole job.

```php
<?php
$name = $attributes['name'] ?? 'world';
?>
<h2>Hello, <?php echo esc_html($name); ?>.</h2>
```

== I'm building my frontend in JS ==

The markup is produced by your own frontend — React, Vue, Astro, anything that speaks HTTP. The work splits across two homes.

**In your WordPress theme**, two files — the typed-CMS half only. No `render.php`; WP stores attributes, it doesn't render the block.

**`block.fields.json`** — identical to the PHP path. The controls don't change.

```json
{
  "controls": [
    { "id": "panel", "type": "group", "label": "Hello" },
    { "id": "ctrl_name", "type": "text", "label": "Name",
      "attributeKey": "name", "default": "world", "parentPanelId": "panel" }
  ]
}
```

**`block.json`** — same metadata, minus the `render` line. There's no PHP file to point at.

```json
{
  "$schema": "https://schemas.wp.org/trunk/block.json",
  "apiVersion": 3,
  "name": "gcb/hello",
  "title": "Hello",
  "category": "widgets"
}
```

**In your frontend**, the component holds the markup — same contract as `render.php`, in your framework:

```jsx
export default function Hello({ attributes = {} }) {
  const { name = 'world' } = attributes;
  return <h2>Hello, {name}.</h2>;
}
```
:::

> The only difference between the two paths is **where the HTML comes from.** The controls, the attribute names, the marker — identical. Move a block from PHP to a JS frontend by deleting `render.php` and writing the component; nothing else changes.

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
