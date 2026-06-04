---
slug: blocks/inner
title: The InnerBlocks repeater
section: Blocks
order: 3
---

The **InnerBlocks repeater** repeats whole *blocks* of inner content. It's what you reach for when each repeated item is a self-contained chunk with its own structure and its own markup — a block in its own right, not just a row of fields.

**Good for:**

- **Cards** — a grid of cards, each with an image, heading, body, and link.
- **Accordions** — a list of expandable panels, each holding a title and rich content.
- **Feature grids** — repeating feature items, each with an icon, heading, and description.
- **Tabs, slides, FAQs, team members** — anything where each item is itself content with its own editable body.

> Looking to repeat a small *set of fields* instead — rows of data like links, stats or address lines? That's a different tool: the [repeater **field**](/docs/fields/repeater), which stores an array on a single attribute. This page is about repeating whole **blocks**.

When each item is itself a block, you don't store an attribute at all. The children live in the parent's `innerBlocks`, and you mark *where* they render with a `<Repeater>` (or `<InnerBlocks>`) tag — the parent template never hard-codes the children.

**Everything about the children lives on that one marker.** Which child types are allowed, how many to seed, the min/max, the Add-button label — they're all attributes on the `<Repeater>` tag, right where the children render. There's no second place to keep in sync: `block.fields.json` stays purely your *own* fields, and the marker owns the children.

The parent's `block.fields.json` is just its regular fields — nothing repeater-specific:

```json
{
  "controls": [
    { "id": "panel", "type": "group", "label": "Header" },
    { "id": "ctrl_heading", "type": "text", "label": "Heading", "attributeKey": "heading", "default": "" }
  ]
}
```

The parent renders its own fields, then drops the marker — carrying the child rules as attributes — where the children belong:

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

Because you named it in `allowedBlocks`, GCB scopes it to this parent using WordPress's native [`parent` block setting](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-registration/#parent) — so `gcb/feature-item` only appears in the inserter *inside* a feature-trio, never on its own. That's standard WP block nesting; GCB just wires it up from the marker so you don't hand-maintain a `parent` array in each child's `block.json`.

> `<Repeater>` is sugar for WordPress's [`<InnerBlocks>`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-editor/#innerblocks) with an add-button affordance. Use `<InnerBlocks />` directly when you want a freeform slot rather than a repeating list of one child type.

### What the marker tag actually does

The same `<Repeater>` / `<InnerBlocks>` tag is swapped for different things depending on context — that's how one template serves both the editor and the public site:

- **Editor preview** — swapped for a real WordPress `InnerBlocks` slot (the draggable, editable canvas region). On the React side, `<InnerBlocks />` with no `blocks` prop emits a lowercase `<innerblocks>` marker that the editor's parse step replaces.
- **Public render (PHP)** — `InnerBlocksReplacer` runs on the `render_block` filter, recursively renders each child via `render_block()`, and substitutes the result for the marker tag.
- **Public render (React)** — `BlockRenderer` passes the parsed `innerBlocks` array straight into `<Repeater blocks={innerBlocks} …>`, which recurses through `BlockRenderer` to render each child component.

So in PHP the children arrive pre-rendered as `$content` (and the marker is replaced), while in React you receive the structured `innerBlocks` array and render it yourself. Either way the parent template never hard-codes the children — they're authored on the canvas.

## `<Repeater>` options

Every attribute you can put on a `<Repeater>` marker (PHP) or pass as a prop to the `<Repeater>` component (React). All are optional.

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `allowedBlocks` | array with **one** block name | — | The child block this repeats. Give it a single-entry array (`["gcb/feature-item"]`) — that one type is what the Add button inserts and what seeding creates. A repeater repeats *one* kind of thing; if you want a slot that accepts arbitrary mixed blocks, use [`<InnerBlocks>`](#innerblocks-options) instead. With no `allowedBlocks` there's nothing to add or seed. |
| `addButtonLabel` | string | `"Add item"` | Label on the Add button shown below the children in the editor. |
| `min` | number | `0` | Minimum children. The block seeds up to this on insert; delete below it and the save is **rejected** — both client-side (a notice naming the block, with a "Find the block" action) and server-side, in the post editor **and** the Site Editor. |
| `max` | number | `0` (unlimited) | Maximum children. At the cap, the Add button hides; saving over the cap is rejected the same way as `min`. |
| `defaultChildren` | number | `0` | How many children to seed when the block is first inserted. If `min` is higher, `min` wins. Ignored when a `template` is set (WP seeds that instead). |
| `template` | array (WP block template) | — | A starting inner-block template, in WP's `[ [ name, attrs ] ]` shape. When set, it drives the initial children (and `defaultChildren` is ignored). |

Every attribute except `allowedBlocks` is **optional**. PHP marker attributes are strings/JSON; React props are real values:

:::codetabs
```php
<Repeater
  allowedBlocks='["gcb/feature-item"]'  <!-- optional: restrict child types; first = what Add inserts -->
  addButtonLabel="Add feature"          <!-- optional: Add-button label -->
  min="1"                               <!-- optional: minimum children, enforced -->
  max="6"                               <!-- optional: maximum children -->
  defaultChildren="3"                   <!-- optional: how many to seed on insert -->
/>
```
```jsx
<Repeater
  blocks={innerBlocks}                  // required on the frontend: the saved children to render
  allowedBlocks={['gcb/feature-item']}  // optional: restrict child types; first = what Add inserts
  addButtonLabel="Add feature"          // optional: Add-button label
  min={1}                               // optional: minimum children, enforced
  max={6}                               // optional: maximum children
  defaultChildren={3}                   // optional: how many to seed on insert
/>
```
:::

## `<InnerBlocks>` options

`<InnerBlocks>` is the freeform slot (no Add button, no min/max). Use it when the parent should accept arbitrary content rather than a repeating list of one child type.

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `allowedBlocks` | array of block names, or `"all"` | `"all"` | Restrict which blocks can be inserted into the slot. |
| `template` | array (WP block template) | — | Starting inner-block template. |
| `templateLock` | `"all"` \| `"insert"` \| `false` | `false` | WordPress's native [`templateLock`](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-templates/#locking): `"all"` locks the structure (no add/remove/move); `"insert"` allows moving but not adding/removing; `false` is fully editable. |

```jsx
<InnerBlocks
  allowedBlocks={['core/heading', 'core/paragraph', 'gcb/cta']}
  templateLock={false}
/>
```

On the frontend, `<InnerBlocks blocks={innerBlocks} />` / `<Repeater blocks={innerBlocks} />` render the children; with no `blocks` they emit the editor marker. The `allowedBlocks` / `template` / etc. options only apply in the editor — they're ignored on the public render, where the children already exist.

## Core container blocks (cover, group, columns)

Core WordPress containers don't use the marker tag; they carry an `innerContent` array where `null` entries are child slots. The React `BlockRenderer` reconstructs them by walking `innerContent`, filling each `null` with the next rendered child. If core blocks render unstyled in a headless setup, link the WordPress block-library stylesheet into your layout — the markup is correct but the `.wp-block-*` selectors are unstyled without it.
