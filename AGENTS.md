# Authoring blocks against GCB Lite

GCB Lite turns WordPress into a typed-field CMS for a React frontend. Each block has a tiny PHP/JSON schema and a single React component that renders both the editor preview and the public site. No `edit.js`, no `save.js`, no per-block webpack config.

Two modes per block (a block can mix them):

1. **Server-rendered via `render.php`** — standard WP block. The plugin auto-wires `render: file:./render.php` if it exists.
2. **Rendered by a React component** on a separate Next.js component server. The plugin SSR-fetches HTML for the editor preview via `wp_remote_get` and exposes a REST API the public frontend uses to fetch the same component.

See the project [README](./README.md) for positioning vs WordPress 7's `autoRegister`.

## Where blocks live

```
themes/{active-theme}/blocks/{block-name}/
├── block.json          # Standard WP block metadata
├── block.fields.json   # GCB controls config (optional)
├── render.php          # Server-side render (optional — see "Rendering with a React component")
└── style.css           # Frontend + editor styles (optional)
```

Block name = directory name. WP registers it as `gcb/{block-name}`.

## What you write

### `block.json`

Standard WP block metadata. Nothing GCB-specific in here:

```json
{
  "$schema": "https://schemas.wp.org/trunk/block.json",
  "apiVersion": 3,
  "name": "gcb/team-grid",
  "title": "Team Grid",
  "category": "widgets",
  "icon": "groups",
  "textdomain": "gcb",
  "attributes": {},
  "supports": {}
}
```

Rules:
- `supports` must be `{}` or `[]`.
- `attributes` should be `{}` — they're auto-generated from `block.fields.json`.
- `render` is auto-wired by the plugin if `render.php` exists; no need to set it.

### `block.fields.json`

GCB-specific. Declares Inspector controls; the plugin auto-generates the
WP attribute defs from these.

```json
{
  "controls": [
    {
      "id": "panel_main",
      "type": "group",
      "label": "Main",
      "controlsGroup": "settings"
    },
    {
      "id": "ctrl_heading",
      "type": "text",
      "label": "Heading",
      "attributeKey": "heading",
      "controlsGroup": "settings",
      "parentPanelId": "panel_main"
    }
  ]
}
```

For controls: `id` is unique within the block; `attributeKey` is required for non-`group` types.

The schema file is at `schemas/gcb.schema.json` — point your editor at it via `$schema` in your `block.fields.json` for autocomplete (optional).

### IMPORTANT: picking the right control type

Get this wrong and the attribute ends up the wrong shape (e.g. array instead
of string), the component reads `undefined`, and the block looks broken.
Pick by **the shape of the saved value**, not by what looks nicest in the UI:

| You want…                                          | Control          | Stored type | Notes                                                  |
|----------------------------------------------------|------------------|-------------|--------------------------------------------------------|
| Free-text single line                              | `text`           | string      |                                                        |
| Free-text multi-line                               | `textarea`       | string      |                                                        |
| Rich text (bold, links, lists)                     | `wysiwyg`        | string      | HTML. Often better as InnerBlocks — see below.         |
| **On/off toggle**                                  | `toggle`         | boolean     | A real switch. Not a checkbox.                         |
| One-of-N from a small fixed set (≤4, visual)       | `toggle-group`   | string      | Segmented control. Single-value. Use for left/right.   |
| One-of-N from a larger set                         | `select`         | string      | Dropdown.                                              |
| One-of-N visible all at once                       | `radio`          | string      | Stacked radio buttons.                                 |
| **Many-of-N**                                      | `checkbox-group` | array       | Multi-select. `button-group` is an alias for this.     |
| Single boolean question                            | `checkbox`       | boolean     | When a `toggle` switch is the wrong affordance.        |
| Number                                             | `number`         | number      | Free-typed.                                            |
| Number on a fixed scale                            | `range`          | number      | Slider with min/max/step.                              |
| Colour                                             | `color`          | string      | Hex / theme palette.                                   |
| Single image                                       | `image`          | object      | `{ id, url, alt, width, height, ... }`.                |
| Gallery of images                                  | `gallery`        | array       | `[{ id, url, alt, ... }, ...]`.                        |
| Other media (PDF, video, etc.)                     | `file`           | object      |                                                        |
| Linked post / page                                 | `post-object`    | object      |                                                        |
| Linked URL                                         | `url`            | object      |                                                        |
| Date                                               | `date`           | string      | ISO date.                                              |
| Date + time                                        | `datetime`       | string      | ISO datetime.                                          |
| Icon picker                                        | `icon`           | object      |                                                        |
| Code snippet                                       | `code`           | string      |                                                        |

**Bias toward InnerBlocks for prose-y content.** If the field is going to
hold paragraphs of text — let alone paragraphs + lists + images — use a
free InnerBlocks slot in the React component instead of a `wysiwyg`
control. Authors get all of Gutenberg's tools, not a cramped Inspector
textarea. See "Rendering with a React component" below for how blocks emit
the `<innerblocks>` marker.

**Common AI mistakes to avoid:**

- Don't reach for `button-group` for left/right or on/off. It's a
  multi-select (alias of `checkbox-group`) and stores an array. Use
  `toggle-group` (single-value segmented) or `toggle` (boolean switch).
- Don't use `checkbox` for "is this enabled" — `toggle` reads as a real
  switch and is the WP-native affordance for on/off.
- If a control should store a non-default `attributeType` (e.g. a `text`
  field that should be `number`), set it explicitly. The auto-detection
  has sensible defaults but they're per-control-type, not per-use-case.
- When in doubt, prefer fewer controls + an InnerBlocks slot in the
  component. WordPress is good at block authoring; the Inspector is best
  for short typed atoms.

### IMPORTANT: discover the full control surface before using it

The table above tells you *which* control to pick. It does **not** list
every field a control stores. Rich controls like `image`, `gallery`,
`url`, `icon`, `spacing`, `size`, `post-object`, `relationship`, etc.
store **multi-field objects** with toggleable features (focal point,
size mode, custom width, isFixed, etc.).

If you build a component that reads only `image.url` and `image.alt`,
you have silently dropped focal-point, cover/contain, custom width,
fixed-background — every other feature the author can configure. The
block ships looking broken.

**Rule when using any control in `block.fields.json` or reading its
value in a React component:**

> **Before you write the code, Read the file `src/controls/{type}.js`
> in the plugin.** The header JSDoc comment is the authoritative API
> contract — stored shape, every field, every feature toggle.

This is on purpose: hand-maintained docs go stale the moment a control
changes. The control file is the source of truth. Reading it costs one
tool call; getting it wrong costs a re-implementation.

When wiring a component:

1. Read `src/controls/{type}.js` for the stored shape.
2. Honour **every documented field**, not just the obvious ones. If the
   control stores a focal point, your `<img>` should set `object-position`.
   If it stores `size`, set `object-fit`. If it stores `customWidth`, use
   inline width. If `isFixed`, set `background-attachment: fixed` when
   used as a background.
3. If a feature genuinely doesn't apply to this block's use case (e.g.
   the image is foreground-only so `isFixed` is meaningless), add a one-
   line comment explaining the omission. That way the next person doesn't
   wonder if it was forgotten.

Defaults reasonable when the field is absent (focal point defaults to
0.5/0.5; size defaults to `cover`; customWidth empty means no override).

### `render.php`

Standard WP render callback. Receives `$attributes`, `$content`, `$block` in scope:

```php
<?php
$heading = $attributes['heading'] ?? '';
$wrapper_attributes = get_block_wrapper_attributes(['class' => 'gcb-team-grid']);
?>
<div <?php echo $wrapper_attributes; ?>>
    <?php if ($heading) : ?>
        <h2><?php echo esc_html($heading); ?></h2>
    <?php endif; ?>
    <?php echo $content; ?>
</div>
```

Always `get_block_wrapper_attributes()` and echo it on the root element. Always escape dynamic values.

## What you do *not* write

- No `edit.js` / `save.js` — the plugin renders the Inspector UI from `gcb.controls`.
- No hand-written `attributes` in `block.json` — they're derived.
- No webpack config per block.

## Validation

The plugin validates `gcb` configs at registration. With `WP_DEBUG` on, invalid blocks emit warnings naming the exact field. The scaffold CLI rejects invalid specs before writing anything.

Before reporting a block as done:
1. `block.json` parses and has `apiVersion: 3`, `name: "gcb/{slug}"`.
2. Every non-group control in `block.fields.json` has `attributeKey`. Every `parentPanelId` matches a group's `id`.
3. If using `render.php`: `php -l render.php` passes, and every attribute referenced has a matching control in `block.fields.json`.
4. If using the component server: a route at `/wordpress/render/{slug}` returns the component wrapped in `<wp-block-wrapper data-block-name="{slug}">`.

## Rendering with a React component instead of render.php

`render.php` is optional. If it's absent, the plugin renders the block by
making a server-to-server request to a configured component server (a Next.js
app, by default). The component server returns HTML; the plugin extracts it
and hands it to the editor — same contract as render.php, no CORS, no React
bundle ever loaded inside wp-admin.

This is useful when you want to author the block with React (and pull in
libraries like shadcn, dnd-kit, etc.) and treat WordPress as a CMS that just
provides typed fields.

### How to use it

1. Create `themes/{active-theme}/blocks/{block-name}/` with **just** a
   `block.json` and (optionally) a `block.fields.json`. Do not include
   `render.php`.

2. Run a component server reachable from PHP (default
   `http://localhost:3001`). Override with either:
   - `define('GCBLITE_COMPONENT_SERVER_URL', 'http://localhost:3001');` in
     `wp-config.php`, or
   - `add_filter('gcblite_frontend_url', fn() => 'http://...');`.

3. The component server must expose a route at
   `/wordpress/render/{slug}?attrs={url-encoded-json}` that returns HTML
   wrapped in `<wp-block-wrapper data-block-name="{slug}" data-cache-timestamp="{ts}">…</wp-block-wrapper>`.
   The wrapper element is the contract — the plugin's HTML extractor finds
   the markers and discards everything else (doctype, scripts, styles).
   `data-cache-timestamp` is optional but recommended; the plugin uses it to
   invalidate the per-attribute cache when your component server restarts.

4. The same component renders both the editor preview and the public frontend.
   If you need different behaviour per context (e.g. lighter preview, heavier
   frontend with animation), export `{ admin, frontend }` instead of a single
   default — the admin route picks the admin variant.

5. Wire up your component server's block registry so the slug after
   `gcb/` maps to a React component. With the reference Next.js setup that
   looks like `WP_BLOCK_REGISTRY['gcb/hero'] = Hero`.

### Mental model

```
Editor in wp-admin              WordPress              Component server (Next.js)
─────────────────────           ────────────           ──────────────────────────
useBlockProps()
  └─ usePHPPreview()
        ↓ apiFetch
   POST /gcblite/v1/render-batch
        ↓
                          render_one()
                            ├─ render.php exists?
                            │    └─ run it locally
                            └─ otherwise:
                                 wp_remote_get
                                    ────────────→  GET /wordpress/render/{slug}
                                                            ↓
                                                       Component component
                                                       wrapped in <wp-block-wrapper>
                                    ←────────────  HTML
                                 HtmlExtractor::extract
                                 BlockWrapperParser::parse
        ↓ { html, wrapperAttributes }
   Editor injects HTML, applies wrapper attrs via useBlockProps
```

The same HTTP exchange happens for every attribute change (debounced into one
batch per tick). Cache hits skip the wp_remote_get round-trip.

### IMPORTANT: editor preview is static SSR — no client hydration

The component server renders your component once (server-side) and returns the
HTML. WordPress injects that HTML into the editor as a string; React on the
component-server side **never hydrates** in the editor. The public frontend
hydrates as normal.

Concrete consequences when designing a block:

1. **Anything that requires JS to be visible will look broken in the editor.**
   Examples:
   - Radix accordion items render closed; clicking the trigger does nothing.
   - `useEffect` never fires.
   - Hover/focus state managed by JS never updates.
   - Animations that start on mount never play.

2. **Components that read context from a Provider crash if rendered standalone.**
   The editor calls each block's render endpoint *independently* — a child
   block is fetched on its own, not nested inside its parent. So if you use
   a library like Radix UI where `Accordion.Item` reads context from
   `Accordion.Root`, and you render only `Accordion.Item`, SSR returns 500.
   Fix: wrap the standalone component in its own provider (small overhead,
   nested providers in the public-frontend case are harmless).

3. **Use `forceMount` on collapsible Radix primitives.**
   `<RadixAccordion.Content forceMount>` ensures children are in the DOM even
   when closed. Otherwise the editor preview has empty panels by definition.

4. **Editor-only CSS overrides live in `/wordpress/editor.css`.**
   The component server publishes two stylesheets:
   - `/wordpress/styles.css` — frontend + editor canvas.
   - `/wordpress/editor.css` — editor only.
   For things like "force accordion open so the author can see the content",
   put the rule in `editor.css` (scoped under `.editor-styles-wrapper`).

5. **`<Repeater />` and `<InnerBlocks />` are marker tags, not actual rendering.**
   When the editor receives `<repeater>` or `<innerblocks>` in the SSR HTML,
   gcb-lite's `parse-preview.js` swaps the marker for the real WP InnerBlocks
   UI (with Add button, drag-to-reorder, etc.). The marker mode is what
   surfaces the editor authoring affordances — your component should emit
   it when no `blocks`/`children`/`html` is passed.

If your block depends on JS to be useful (carousels, modals, complex
interactions), the editor preview will show the static state only. That's
usually fine for authoring; just don't fight it.

## Scaffolding

```bash
# Single command, no boilerplate.
wp gcblite scaffold team-grid --title="Team Grid" --controls="heading:text,intro:textarea"

# Or pipe a JSON spec from an AI:
cat spec.json | wp gcblite scaffold --stdin
```

Spec shape:

```json
{
  "block_name": "team-grid",
  "meta": { "title": "Team Grid", "icon": "groups", "category": "widgets" },
  "gcb": {
    "controls": [...]
  }
}
```
