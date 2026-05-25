# Authoring blocks against GCB Lite

Each block has a tiny PHP/JSON schema in the theme and one React component
in your Next.js (or Astro, or any HTTP-SSR) frontend. The same component
renders both the editor preview and the public site — WordPress hits one
route on your frontend to get the HTML when an author edits, and your
frontend renders the same component for visitors.

Two ways to render a block:

1. **PHP `render.php`** — standard WP block. The plugin auto-wires
   `render: file:./render.php` if it exists.
2. **React component on your frontend** — drop the `render.php`. The plugin
   asks your frontend to render via its `/wordpress/render/[block]` route.

A block can use either; the plugin picks based on whether `render.php`
exists. See [README.md](./README.md) for the overall architecture.

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
| **Many-of-N (checkbox column)**                    | `checkbox-group` | array       | Vertical list of checkboxes.                           |
| **Many-of-N (button row)**                         | `button-group`   | array       | Horizontal row of toggle buttons. SAME data shape as `checkbox-group` (multi-select / array). NOT single-value — use `toggle-group` for that. |
| Single boolean question                            | `checkbox`       | boolean     | When a `toggle` switch is the wrong affordance.        |
| Number                                             | `number`         | number      | Free-typed.                                            |
| Number on a fixed scale                            | `range`          | number      | Slider with min/max/step.                              |
| Colour                                             | `color`          | string      | Hex / theme palette.                                   |
| Single image                                       | `image`          | object      | `{ id, url, alt, width, height, ... }`.                |
| Gallery of images                                  | `gallery`        | array       | `[{ id, url, alt, ... }, ...]`.                        |
| Other media (PDF, video, etc.)                     | `file`           | object      |                                                        |
| Linked post / page                                 | `post-object`    | object      |                                                        |
| Linked URL                                         | `url`            | object      |                                                        |
| Date                                               | `date`           | string      | ISO date. Opens a calendar in a popover/modal.         |
| Date + time                                        | `datetime`       | string      | ISO datetime. Opens calendar + hour/minute picker (DateTimePicker). |
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
  multi-select (same array shape as `checkbox-group`, just rendered as a
  row of toggle buttons). Use `toggle-group` (single-value segmented) or
  `toggle` (boolean switch).
- Don't use `checkbox` for "is this enabled" — `toggle` reads as a real
  switch and is the WP-native affordance for on/off.
- If a control should store a non-default `attributeType` (e.g. a `text`
  field that should be `number`), set it explicitly. The auto-detection
  has sensible defaults but they're per-control-type, not per-use-case.
- When in doubt, prefer fewer controls + an InnerBlocks slot in the
  component. WordPress is good at block authoring; the Inspector is best
  for short typed atoms.

### Repeater is a special case

`type: "repeater"` looks like a control but isn't rendered as an Inspector
field. It exists in the schema/validator so a block can declare an
array-shaped attribute for nested items, but the editor never shows a
"repeater" UI in the sidebar.

Repeater behaviour comes from a `<repeater allowedblocks="..." addbuttonlabel="...">`
marker tag emitted by the React component. The editor JS (`parse-preview.js`)
finds the marker in the rendered HTML and replaces it with a constrained
`InnerBlocks` UI — Add button, drag-to-reorder, child-block scoping.

So: don't put `type: "repeater"` in your Inspector controls list expecting
a sidebar widget. Use it only when you genuinely want an array attribute
backing a `<repeater>` marker in the component. In most cases what you
actually want is the marker alone (no Inspector entry needed) — see the
Accordion test block for the working pattern.

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

## Per-field validation (user input)

Every control supports a `validation` block that the meta-box and (in
future) the block Inspector enforce client-side, with a server-side mirror
that forces the post to `draft` on save if invalid:

```json
{
  "type": "text",
  "attributeKey": "subtitle",
  "label": "Subtitle",
  "validation": {
    "required": true,
    "requiredMessage": "Subtitle is required.",
    "minLength": 3,
    "maxLength": 80,
    "min": 0,
    "max": 100,
    "pattern": "^[A-Z]",
    "patternMessage": "Must start with a capital letter."
  }
}
```

- `required` can be a boolean OR `{ "message": "..." }`.
- `requiredMessage` is a top-level shorthand for a custom required text.
- `minLength` / `maxLength` apply to string values.
- `min` / `max` apply to numbers (and numeric strings).
- `pattern` is a bare regex (no delimiters); supply `patternMessage` to
  override the generic "does not match" error.

**Hidden by conditional logic = skipped.** If a required field is hidden
by its `conditionalLogic`, it is excluded from validation entirely — it
can't block save because the user can't see it.

**Server-side authority.** `GCBLite\PostFields\Validator` mirrors the JS
rules. If a post is saved with invalid required fields, status is forced
to `draft` and an admin notice lists each error. Add new rules to BOTH
`src/validation.js` and `includes/PostFields/Validator.php` — the JS-only
client check is just nice UX.

## Conditional logic (hide a field unless its rules pass)

Every control supports a `conditionalLogic` block that hides it unless its
rules pass against sibling attribute values:

```json
{
  "type": "textarea",
  "attributeKey": "extra_notes",
  "label": "Extra notes",
  "conditionalLogic": {
    "enabled": true,
    "operator": "and",
    "rules": [
      { "field": "show_extra", "operator": "==", "value": true },
      { "field": "count",      "operator": ">",  "value": 0 }
    ]
  }
}
```

Operators: `==`, `!=`, `>`, `<`, `>=`, `<=`, `contains` (string), `in`
(value-in-array). `operator: "and" | "or"` joins multiple rules; default
is `and`. Rules can reference any other control in the same form (cross-
panel is fine — useful for "show advanced field when upstream setting
matches").

## Post-fields: gcb-lite controls on a custom post type

Themes (or other plugins) can attach the gcb-lite control library to any
CPT to render a meta-box of typed fields, REST-exposed via `meta`:

```php
register_post_type('testimonial', [
    'label'        => 'Testimonials',
    'public'       => true,
    'show_in_rest' => true,
    'supports'     => ['title'],   // 'editor' is auto-stripped when fields are registered
]);

gcblite_register_post_fields('testimonial', [
    // 'has_body' => true,   // opt back in to the block editor body
    'controls' => [ /* same shape as block.fields.json */ ],
]);
```

- The same control library (text, image, gallery, color, post-object, …)
  used in block Inspectors renders inside a classic add_meta_box.
- Each field becomes `meta.{attributeKey}` on the CPT's REST endpoint
  (`/wp/v2/{post_type}?_fields=id,title,meta`), suitable for a headless
  React frontend.
- By default the block editor body is removed (record-style CPTs don't
  need a content body). Pass `'has_body' => true` to keep it.
- `validation` + `conditionalLogic` work here exactly as in blocks.

## Config validation (registration-time)

The plugin validates `gcb` configs at registration. With `WP_DEBUG` on, invalid blocks emit warnings naming the exact field. The scaffold CLI rejects invalid specs before writing anything.

Before reporting a block as done:
1. `block.json` parses and has `apiVersion: 3`, `name: "gcb/{slug}"`.
2. Every non-group control in `block.fields.json` has `attributeKey`. Every `parentPanelId` matches a group's `id`.
3. If using `render.php`: `php -l render.php` passes, and every attribute referenced has a matching control in `block.fields.json`.
4. If rendering via your Next.js frontend: a route at `/wordpress/render/{slug}` on that frontend returns the component wrapped in `<wp-block-wrapper data-block-name="{slug}">`.

## Rendering with a React component instead of render.php

`render.php` is optional. If it's absent, the plugin renders the block by
making a server-to-server request to a route on your Next.js (or Astro,
Express, anything HTTP) frontend. That route returns HTML for the component;
the plugin extracts it and hands it to the editor — same contract as
`render.php`, no CORS, no React bundle ever loaded inside wp-admin.

This is the headless mode: author the block with React (shadcn, dnd-kit,
anything), and treat WordPress as a CMS that holds typed fields.

The starter [gcb-next-starter](https://github.com/wordpress-gcb/gcb-next-starter)
repo implements this contract end-to-end. Treat it as the reference;
clone it and grow it into your real site, or copy from it into an
existing Next.js project.

### How to use it

1. Create `themes/{active-theme}/blocks/{block-name}/` with **just** a
   `block.json` and (optionally) a `block.fields.json`. Do not include
   `render.php`.

2. Make sure WordPress can reach your frontend's `/wordpress/render/[block]`
   route. Defaults to `http://localhost:3001`. Override with either:
   - `define('GCBLITE_COMPONENT_SERVER_URL', 'https://your-frontend.example.com');`
     in `wp-config.php`, or
   - `add_filter('gcblite_frontend_url', fn() => 'https://...');`.

3. The frontend's `/wordpress/render/[slug]?attrs={url-encoded-json}` route
   must return HTML wrapped in
   `<wp-block-wrapper data-block-name="{slug}" data-cache-timestamp="{ts}">…</wp-block-wrapper>`.
   The wrapper element is the contract — the plugin's HTML extractor finds
   the markers and discards everything else (doctype, scripts, styles).
   `data-cache-timestamp` is optional but recommended; the plugin uses it to
   invalidate the per-attribute cache when your frontend restarts.

4. The same React component renders both the editor preview and the public
   frontend. If you need different behaviour per context (e.g. lighter
   preview, heavier frontend with animation), export `{ admin, frontend }`
   instead of a single default — the admin route picks the admin variant.

5. Wire up the frontend's block registry so the slug after `gcb/` maps to a
   React component. In the starter that's
   `WP_BLOCK_REGISTRY['gcb/hero'] = Hero`.

### Mental model

```
Editor in wp-admin              WordPress              Your Next.js frontend
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
                                                       Renders React component
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

Your frontend renders the component once (server-side) and returns the HTML.
WordPress injects that HTML into the editor as a string; React **never
hydrates** in the editor. The public frontend hydrates as normal.

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
   Your frontend publishes two stylesheets:
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
