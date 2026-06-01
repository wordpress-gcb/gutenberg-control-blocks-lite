# GCB Lite

**Use WordPress to visually manage your components. Build them any way you like.**

All WordPress needs is some HTML wrapped in `<wp-block-wrapper data-block-name="hero">`. From there you bolt on typed attributes, InnerBlocks slots, and the inspector configures itself.

Because the only contract is HTML, *how* you produced that HTML doesn't matter — PHP in your theme, React on a Next app, Vue, Astro, a static file server. WP just pulls in the HTML and does the editor work around it.

```text
              your component's HTML
                       │
         ┌─────────────┴─────────────┐
         │                           │
    Public website         Gutenberg editor preview
    (what visitors get)     (the same render, in wp-admin)
```

What authors see in the editor is the actual rendered output. No `edit.js`, no hand-built preview state, no second implementation to keep in sync.

- **Traditional WordPress site?** Blocks render through standard `render.php` templates and behave like any other WordPress block — full plugin ecosystem, no frontend required.
- **Headless site?** Gutenberg becomes a true visual editor instead of a content-entry form with placeholder previews.

Each block chooses its own path. It's a per-block dial, not a stack-wide commitment.

---

## The contract

The entire protocol between WordPress and your frontend is one HTTP route that
returns your component's rendered HTML, wrapped in a single element so GCB Lite
can cache and invalidate:

```html
<wp-block-wrapper data-block-name="hero" data-cache-timestamp="1716435847">
  <!-- your component's HTML, entirely yours -->
</wp-block-wrapper>
```

That wrapper is the only structure GCB Lite imposes. Everything inside it is
your output, rendered by whatever produced it. Implement the route in Next,
Nuxt, Astro, Express, or a static file server — anything that can return that
shape over HTTP.

**This is not a third moving part.** The frontend that serves visitors is the
same frontend that serves the editor preview. You add one route to the app you
already deploy.

```
┌──────────────────┐        ┌─────────────────────┐        ┌──────────────────────┐
│  wp-admin editor │  REST  │  GCB Lite plugin    │  HTTP  │  Your frontend       │
│  author edits    │ ─────▶ │  (this repo)        │ ─────▶ │  (renders blocks)    │
│  Hero block      │ ◀───── │  /render-batch      │ ◀───── │  GET /render/hero    │
└──────────────────┘  HTML  └─────────────────────┘  HTML  └──────────────────────┘
                                                                      ▲
                                                       Visitors hit ──┘ the same app
```

Because the editor preview is the production render, editor/public drift is
impossible by construction — on any block that renders through the route.

---

## What you get

**30+ Inspector control types**, built on `@wordpress/components` so they look and behave like native editor controls — not a plugin's UI layered on top:

- **`image`** — media library, focal point, cover/contain/auto, width, repeat, fixed-background
- **`gallery`** — drag-to-reorder (@dnd-kit), per-image alt and ordering
- **`post-object`** — search/select published posts of any type, with filters
- **`taxonomy`** — term picker with hierarchy
- **`user`** — author picker
- **`relationship`** — bidirectional post relationships
- **`icon`** — Dashicons picker (Lucide / custom sources planned)
- **`color`**, **`range`**, **`code`**, **`datetime`**, **`url`**, **`google-map`**, **`file`**, **`wysiwyg`**, **`oembed`**
- **`select`**, **`radio`**, **`checkbox`**, **`checkbox-group`**, **`toggle`**, **`toggle-group`**, **`button-group`**
- **`size`**, **`spacing`**, **`page-link`**, **`message`**, **`text`**, **`textarea`**, **`number`**, **`email`**, **`date`**

Plus structural types (`group`, `panel`, `tools-panel`) that organise the Inspector into native collapsible sections via `parentPanelId`, and basic conditional logic (`==`, `!=`, `in`, `contains`, `>`, `<`) for show/hide.

**Native Gutenberg authoring.** Inserter, drag-to-reorder, transforms, copy/paste, patterns, multi-select — all standard. Not a page builder.

**Repeater inner blocks.** Emit a `<repeater allowedBlocks='["gcb/team-member"]' />` marker and the editor swaps in a real InnerBlocks UI; the public side swaps in the rendered children. One declaration, two contexts — identical for PHP- and frontend-rendered parents.

**One batched call per page.** A 100-block page fires *one* `/render-batch` call, not one per block. A singleton coordinator debounces, supersedes in-flight requests on attribute change, and demuxes responses by `clientId`, so typing into one block never queues stale renders for the rest. This is the load-bearing piece that keeps the editor feeling local even when the frontend isn't local. See *How fast, and what happens when it isn't* below.

**Stale-while-revalidate caching as a backstop.** Last-good HTML paints instantly; a fresh fetch runs in the background and swaps in unobtrusively. You can run without the cache — uncached, a fetch is a brief visible load on attribute change. The cache exists to absorb cold loads and frontend hiccups, not to make the hot path acceptable; the hot path is already fast enough that the cache is a comfort, not a requirement.

**Headless-ready REST surface** (public-readable): `GET .../wp/v2/pages?slug=` returns `blocks_raw`; `GET .../gcblite/v1/blocks` returns schemas + defaults; `POST .../gcblite/v1/render-batch` renders any block(s) to HTML server-side.

**theme.json integration.** Spacing, colors, and tokens flow into the editor under `window.gcbLite.tokens` and bind via `tokenGroup`.

**WP 7 Abilities API.** On 7.0+, `gcblite/list-blocks` and `gcblite/render-block` register as typed abilities for the command palette and MCP clients. Gated on `function_exists('wp_register_ability')` so it degrades on 6.x.

**WP-CLI scaffold**, JSON-spec-from-stdin friendly for agent-driven authoring:

```
wp gcblite scaffold team-grid --title="Team Grid" --controls="heading:text,intro:textarea"
```

---

## PHP and React are first-class peers

Each block picks its render path by file existence:

| If the block has… | GCB Lite…                             |
| ----------------- | ------------------------------------- |
| `render.php`      | Runs it locally. A standard WP block. |
| no `render.php`   | Calls your frontend for the HTML.     |

A `render.php` block is just a normal WordPress block, so plugins that own the
frontend — **Gravity Forms**, SEO output, the whole ecosystem — work natively
with no headless tax. Drop a Gravity Form into a PHP block and WordPress handles
submission, validation, and entries exactly as always.

For client work, this is the de-risk: the default path is the most well-trodden
code path in WordPress. The novel piece — server-to-server SSR for the preview
— is opt-in, per block, only when a block wants it.

---

## How fast, and what happens when it isn't

Editor previews are fast enough that the caching layer below is a backstop, not
a load-bearing requirement.

- **Hot path: typing a character in the inspector.** Same region (Vercel +
  managed WP, or both on the same VPC): 20–60ms wall-clock to a fresh paint,
  dominated by the WP REST round-trip. Cross-region (US WP, EU frontend):
  120–200ms — still under the "is this typing lag?" threshold (~250ms).
  Single batched call per change, debounced, so a 30-block page costs *one*
  round-trip, not thirty.
- **Cold load: opening a saved page.** Cached HTML paints instantly from the
  plugin's transient store; a fresh fetch happens in the background and swaps
  in if anything changed. You see content, never a spinner.
- **Frontend slow.** Last-good HTML stays on screen while the new request is
  in flight. The author keeps editing other blocks; only the affected block
  shows a brief stale state, then resyncs.
- **Frontend down, with a cached render.** Last-good HTML stays. The
  inspector still works, edits still save, and the public site (which doesn't
  use the editor's cache) keeps rendering whatever the frontend's own
  deployment is serving.
- **Frontend down, no cached render (first edit of a brand-new block).** The
  block renders an inline placeholder — "Frontend unavailable: gcb/hero" with
  the configured frontend URL — and the inspector still works. Authors can
  edit attributes, save the post, and the placeholder resolves to the real
  render the next time the frontend comes back. The editor never gets stuck;
  the page is still saveable.

If you're shipping client work and these failure modes matter: pin the WP and
frontend deploys to the same region, run the cache, and treat the SSR contract
as an opt-in per block. Most blocks should be `render.php` anyway —
SSR-to-the-frontend is for the blocks that earn it.

---

## A block, end to end

Three files in your active theme.

**`blocks/hero/block.json`** — standard WordPress block metadata, no
GCB-specific keys; `attributes` is empty on purpose (generated from controls).

```json
{
  "$schema": "https://schemas.wp.org/trunk/block.json",
  "apiVersion": 3,
  "name": "gcb/hero",
  "title": "Hero",
  "category": "widgets",
  "icon": "cover-image",
  "textdomain": "gcb",
  "attributes": {},
  "supports": {}
}
```

**`blocks/hero/block.fields.json`** — the typed fields. GCB Lite validates this,
generates WP attributes with correct types/defaults, and renders the Inspector.

```json
{
  "controls": [
    { "id": "ctrl_heading", "type": "text", "label": "Heading", "attributeKey": "heading" },
    {
      "id": "ctrl_image", "type": "image", "label": "Background", "attributeKey": "image",
      "enableFocalPoint": true, "enableFixedBackground": true
    },
    {
      "id": "ctrl_align", "type": "toggle-group", "label": "Alignment", "attributeKey": "align",
      "options": [ { "label": "Left", "value": "left" }, { "label": "Center", "value": "center" } ],
      "default": "center"
    }
  ]
}
```

**Then pick a render path** — a `render.php` (renders in WordPress, no frontend
needed) or a component on your frontend wired into its block registry. Either
way the block appears in the inserter, the Inspector renders the controls (with
a real focal-point picker and media-library connection on the image field), and
the preview matches what visitors see.

---

## How it compares

GCB Lite sits across two decisions teams usually make separately: *how to
author typed fields* and *whether to go headless*. Which columns it competes
with depends on which you're weighing.

|                     | ACF Blocks | WP 7 autoRegister | Headless + WPGraphQL | **GCB Lite**                     |
| ------------------- | ---------- | ----------------- | -------------------- | -------------------------------- |
| Field types         | Rich       | Basic typed       | Whatever you wire    | 30+, incl. focal point, gallery  |
| Inspector UI        | Bolted-on  | Native            | N/A                  | Native (`@wordpress/components`) |
| Default render      | PHP        | PHP               | Your stack           | PHP (frontend opt-in per block)  |
| Editor preview      | PHP        | PHP               | None / blind         | Same component as the public site|
| Plugin ecosystem    | Works      | Works             | Lost on the frontend | Works on every PHP block         |
| Headless option     | No         | No                | Yes                  | Yes, per block, any framework    |
| Editor/public drift | Low        | Low               | Severe (no preview)  | Impossible on frontend blocks    |

Replacing ACF? The first three rows are the story. Weighing headless? The last
three are.

---

## When to reach for something else

- **A PHP-only block with a few typed atoms and no rich fields needed?** WP 7's
  `supports: { autoRegister: true }` is lighter and ships in core.
- **A team that wants someone else to own uptime, patching, and the feature
  still existing in three years, with no appetite to own a contract?** A managed
  headless platform transfers that risk — real value GCB Lite doesn't provide.

Reach for GCB Lite when you want rich, native-feeling typed fields *and* the
freedom to render any block in PHP or any SSR-capable frontend, without
committing the whole stack to either.

---

## Quick start

```
# 1. Plugin
cd wp-content/plugins
git clone https://github.com/wordpress-gcb/gutenberg-control-blocks-lite gcb-lite
cd gcb-lite && composer install && npm install && npm run build

# 2. Reference Next.js frontend (skip if you only ship PHP-rendered blocks)
cd next-frontend-example
cp .env.local.example .env.local   # set NEXT_PUBLIC_WP_URL
npm install && npm run dev          # http://localhost:3001
```

Activate the plugin. In your active theme, create `blocks/{slug}/` with
`block.json` and `block.fields.json`, then add either a `render.php` or a
frontend component plus a registry entry. Point the plugin at a frontend:

```php
// wp-config.php
define('GCBLITE_COMPONENT_SERVER_URL', 'https://your-frontend.example.com');
// …or: add_filter('gcblite_frontend_url', fn () => 'https://your-frontend.example.com');
```

60-second demo: see `next-frontend-example/README.md` and run
`bash next-frontend-example/sample-content/seed-demo-page.sh`.

---

## Production reality

Version 0.1.0, public alpha. The architecture is settled; specific APIs may move
before 1.0. Shipping client work on it? Pin to a commit and follow the issue
tracker.

**The frontend wire contract is yours to own.** WordPress-fetches-HTML-from-
your-frontend is not a path a million people have walked. The payoff is editor/
frontend parity nothing else gives you; the cost is ~1,500 lines an adopter
inherits if the maintainers walk. It only applies to blocks you render through a
frontend — PHP blocks carry none of it.

**Pre-1.0 means the contract can shift.** Breaking changes ship with a migration
path, but launch deliberately.

---

## Documentation

- `AGENTS.md` — block-authoring guide: field types, the `<repeater>` /
  `<innerblocks>` patterns, editor-SSR caveats, UI conventions.
- `next-frontend-example/README.md` — reference frontend and the demo seed.

## Contributing

GPL-2.0-or-later. The wire contract is intentionally minimal; what sits on
either side is yours. High-value contributions right now: reference frontends in
**Nuxt, Astro, and a plain-HTML endpoint** (these close out the framework-
agnostic test matrix above), tests around the marker swap and batch coordinator,
more example blocks, and real-world production feedback.

## License

GPL-2.0-or-later. See `LICENSE`.
