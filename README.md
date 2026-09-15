# GCB Lite

**Use WordPress to visually manage your components. Build them any way you like.**

All WordPress needs is some HTML wrapped in `<wp-block-wrapper data-block-name="hero">`. From there you bolt on typed attributes, InnerBlocks slots, and the inspector configures itself.

Because the only contract is HTML, *how* you produced that HTML doesn't matter: PHP in your theme, React on a Next app, Vue, Astro, a static file server. WordPress pulls in the HTML and does the editor work around it.

```text
              your component's HTML
                       │
         ┌─────────────┴─────────────┐
         │                           │
    Public website         Gutenberg editor preview
    (what visitors get)     (the same render, in wp-admin)
```

What authors see in the editor is the actual rendered output. No `edit.js`, no hand-built preview state, no second implementation to keep in sync.

**The whole loop, in one sentence:** define your fields in WordPress, consume them on your frontend, mark where InnerBlocks content goes, and edit it natively in Gutenberg, with typed atoms (heading, image, CTA) on one side and free-form composition (paragraphs, columns, anything Gutenberg supports) on the other, in the same block.

- **Traditional WordPress site?** Blocks render through standard `render.php` templates and behave like any other WordPress block. Full plugin ecosystem, no frontend required.
- **Headless site?** Gutenberg becomes a true visual editor instead of a content-entry form with placeholder previews.

Each block chooses its own path. It's a per-block dial, not a stack-wide commitment.

### Who gets what

**Editors get to work with real components.**
- Component-based content: the inserter lists named sections, not generic atoms to assemble.
- Visual editing: what's in the canvas is what the public site renders.
- Editor confidence: typed fields validate at the schema level, so no broken markup and no save-then-pray.

**Developers keep ownership of the frontend.**
- Frontend freedom: PHP, React, Vue, Astro, anything that serves HTML. The plugin doesn't dictate.
- Keep WordPress, keep Gutenberg, keep `render.php` blocks where they make sense.
- Render some blocks from Next.js and get true visual editing on those, without going all-in on headless.

Editors want WYSIWYG with first-class components. Developers want to own their frontend. GCB Lite delivers both without asking you to pick.

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
Nuxt, Astro, Express, or a static file server, or anything else that can return
that shape over HTTP.

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

On any block that renders through the route, the editor preview *is* the
production render, so editor/public drift can't happen.

---

## What you get

**30+ Inspector control types**, built on `@wordpress/components` so they look and behave like native editor controls rather than a plugin's UI layered on top:

- **`image`**: media library, focal point, cover/contain/auto, width, repeat, fixed-background
- **`gallery`**: drag-to-reorder (@dnd-kit), per-image alt and ordering
- **`post-object`**: search/select published posts of any type, with filters
- **`taxonomy`**: term picker with hierarchy
- **`user`**: author picker
- **`relationship`**: bidirectional post relationships
- **`query-loop`**: paginated server-side `WP_Query` with filtering
- **`icon`**: icon picker backed by the WordPress icon registry, plus your own collection via `gcblite_custom_icons`
- **`color`**, **`range`**, **`code`**, **`datetime`**, **`url`**, **`google-map`**, **`file`**, **`wysiwyg`**, **`oembed`**
- **`select`**, **`radio`**, **`checkbox`**, **`checkbox-group`**, **`toggle`**, **`toggle-group`**, **`button-group`**
- **`size`**, **`spacing`**, **`page-link`**, **`message`**, **`text`**, **`textarea`**, **`number`**, **`email`**, **`date`**

Plus structural types (`group`, `panel`, `tools-panel`) that organise the Inspector into native collapsible sections via `parentPanelId`, and conditional logic (`==`, `!=`, `in`, `contains`, `>`, `<`) for show/hide.

**Schema Builder in wp-admin.** Author blocks and structured fields visually under the GCB Lite menu: add and reorder fields, group them into panels, set defaults and conditional logic, delete blocks, and work on drafts before publishing them to the theme. Blocks are deep-linkable by URL param. Everything it writes is the same `block.fields.json` you'd hand-author, so the visual tool and the file stay interchangeable.

**Text fields edit in place.** The preview parser binds field elements to `RichText`, so authors type directly into the rendered component instead of into a sidebar box. Typing never triggers a refetch: inline attributes are excluded from the render key.

**Editor styling permissions.** Curate which design tokens the client may choose from, per field, in the studio's "Editor defaults" panel. A `blockEditor.useSetting.before` filter clamps the native font-size, colour, and spacing pickers to the allowed presets and closes the custom-value gate alongside them, so authors can't type around the scale. Permissions belong to the region, so nested blocks inherit them.

**Native Gutenberg authoring.** Inserter, drag-to-reorder, transforms, copy/paste, patterns, multi-select. Not a page builder.

**Repeater inner blocks.** Emit a `<repeater allowedBlocks='["gcb/team-member"]' />` marker and the editor swaps in a real InnerBlocks UI; the public side swaps in the rendered children. One declaration, two contexts, identical for PHP- and frontend-rendered parents. Six edit layouts cover the common ways of authoring repeating content, including a carousel stage with an explicit "Editing slide N / M" toolbar.

**Kit blocks that ship with the plugin.** `gcb/icon-list` and `gcb/icon-list-item` are typed lists edited natively: real `ul`/`ol` InnerBlocks with the core-list Enter grammar, where a split inherits the row's icon and Enter on an empty row exits to a paragraph. `gcb/map` renders a genuine interactive Google map through the Maps JS API, styled by a Cloud Map ID. The plugin scans its own `blocks/` directory after the theme's, so a theme can override any kit block by slug.

**Crash-safe rendering.** Every `gcb/*` block renders through a `render_callback` that try/catches the template include. A fatal in one block's `render.php` becomes graceful empty output on the front end and a small inline note in the editor, logged for diagnosis, instead of taking down the whole page through `do_blocks`.

**One batched call per page.** A 100-block page fires *one* `/render-batch` call, not one per block. A singleton coordinator debounces, supersedes in-flight requests on attribute change, and demuxes responses by `clientId`, so typing into one block never queues stale renders for the rest. This is what keeps the editor feeling local even when the frontend isn't. See *How fast, and what happens when it isn't* below.

**Stale-while-revalidate caching.** Last-good HTML paints instantly while a fresh fetch runs in the background and swaps in unobtrusively. You can run without the cache; uncached, a fetch is a brief visible load on attribute change. The cache absorbs cold loads and frontend hiccups rather than propping up the hot path, which is already fast.

**Config-driven post types.** Register custom post types and their fields from config, with per-CPT allowed blocks, through the CPT registrar and its REST API.

**Headless-ready REST surface** (public-readable): `GET .../wp/v2/pages?slug=` returns `blocks_raw`; `GET .../gcblite/v1/blocks` returns schemas + defaults; `POST .../gcblite/v1/render-batch` renders any block(s) to HTML server-side.

**theme.json integration.** Spacing, colours, and tokens flow into the editor under `window.gcbLite.tokens` and bind via `tokenGroup`. Colour, spacing, and size fields get a token picker, and custom tokens can be written back over REST.

**WP 7 Abilities API.** On 7.0+, `gcblite/list-blocks`, `gcblite/render-block`, and `gcblite/create-block` register as typed abilities for the command palette and MCP clients. Gated on `function_exists('wp_register_ability')` so it degrades on 6.x.

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
frontend, like **Gravity Forms** and SEO output, work natively with no headless
tax. Drop a Gravity Form into a PHP block and WordPress handles submission,
validation, and entries exactly as always.

For client work, this is the de-risk: the default path is the most well-trodden
code path in WordPress. Server-to-server SSR for the preview is opt-in, per
block, only when a block wants it.

---

## How fast, and what happens when it isn't

Editor previews are fast enough that the caching layer below is a backstop
rather than a requirement.

- **Hot path: typing a character in the inspector.** Same region (Vercel +
  managed WP, or both on the same VPC): 20 to 60ms wall-clock to a fresh paint,
  dominated by the WP REST round-trip. Cross-region (US WP, EU frontend):
  120 to 200ms, still under the "is this typing lag?" threshold of about 250ms.
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
  block renders an inline placeholder, "Frontend unavailable: gcb/hero", with
  the configured frontend URL, and the inspector still works. Authors can
  edit attributes, save the post, and the placeholder resolves to the real
  render the next time the frontend comes back. The editor never gets stuck
  and the page is still saveable.

For client work: pin the WP and frontend deploys to the same region, run the
cache, and treat the SSR contract as opt-in per block. Most blocks should be
`render.php` anyway, since SSR-to-the-frontend is for the blocks that earn it.

---

## Security and trust

The render pipeline has two trust boundaries. Both have explicit answers.

**WordPress → frontend (outbound).** `POST /gcblite/v1/render-batch` and its inbound twin `/render` are unauthenticated by design, because the editor would have to ship credentials client-side to authenticate them, which would leak the credentials. Defences in lieu of auth:

- **Allowlist.** Only `gcb/*` block names that are actually `register_block_type`-registered on this install can render. Unknown or unregistered slugs return 404. Attackers can't summon blocks that don't exist.
- **Render path.** If a block has `render.php`, the request runs locally, with no outbound traffic at all. Only blocks without a `render.php` reach the frontend, and only with attributes the registered schema accepts.
- **Cost asymmetry.** Without rate-limiting, a public `/render-batch` can be hit at scale; the cost is a transient write per attribute hash and, for headless blocks, an outbound HTTP call. Put `/render-batch` behind your CDN or origin firewall in production, the same way you'd protect any other public REST route.

**Frontend → WordPress (inbound, your frontend's `/wordpress/render/*`).** WP attaches an `x-gcblite-render-secret` header on every outbound render call so the frontend can refuse calls that didn't originate from a paired WP install. Without this, anyone who discovers the URL could hit `/wordpress/render/{slug}?attrs=…` directly and burn your render compute.

Configure on both ends:

```php
// wp-config.php
define('GCBLITE_RENDER_SECRET', 'long-random-string');
```

```bash
# .env on the frontend
RENDER_SECRET=long-random-string
```

Or set it in Settings → GCB Lite → *Render auth secret* (with a Generate button). gcb-next-starter ships a `middleware.js` that does a constant-time compare of `RENDER_SECRET` against the incoming header and 401s anything else. If the env is unset the route stays open, which is fine for `npm run dev` smoke tests and unsafe for production. **Set the secret on both ends or pin the frontend behind a private network.**

What's not gated by that secret: `/wordpress/styles.css` and `/wordpress/editor.css`. Those are stylesheets the browser fetches from the editor's `<link>` tag, and the browser doesn't have the WP-to-frontend secret. Treat them as public.

**HTML coming back from the frontend is not sanitised.** The plugin strips `<script>`, `<style>`, and `<link>` tags from `<wp-block-wrapper>` payloads as defence-in-depth, but it does not run `wp_kses`. Inline event handlers, `javascript:` URLs, and inline styles all pass through. **The frontend is treated as a trusted internal service:** run it on infrastructure you own, deploy it through your normal pipeline, and treat it the way you'd treat any internal service whose output renders in your admin. Blocks shipped via `render.php` don't cross this boundary at all.

---

## A block, end to end

Three files in your active theme.

**`blocks/hero/block.json`** is standard WordPress block metadata with no
GCB-specific keys. `attributes` is empty on purpose, generated from controls.

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

**`blocks/hero/block.fields.json`** holds the typed fields. GCB Lite validates
this, generates WP attributes with correct types/defaults, and renders the
Inspector. The Schema Builder writes this same file if you'd rather click than
type.

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

**Then pick a render path**, either a `render.php` (renders in WordPress, no
frontend needed) or a component on your frontend wired into its block registry.
Either way the block appears in the inserter, the Inspector renders the controls
(with a real focal-point picker and media-library connection on the image
field), and the preview matches what visitors see.

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
| Editor preview      | PHP        | PHP               | None                 | Same component as the public site|
| Plugin ecosystem    | Works      | Works             | Lost on the frontend | Works on every PHP block         |
| Headless option     | No         | No                | Yes                  | Yes, per block, any framework    |
| Editor/public drift | Low        | Low               | Severe (no preview)  | None on frontend blocks          |

Replacing ACF? The first three rows are the story. Weighing headless? The last
three are.

---

## When to reach for something else

**A PHP-only block with a few typed atoms and no rich fields needed?** WP 7's
`supports: { autoRegister: true }` is lighter and ships in core.

Reach for GCB Lite when you want rich, native-feeling typed fields *and* the
freedom to render any block in PHP or any SSR-capable frontend, without
committing the whole stack to either.

---

## Quick start

Install the plugin and activate it. No frontend is required for this part.

```bash
cd wp-content/plugins
git clone https://github.com/wordpress-gcb/gutenberg-control-blocks-lite gcb-lite
cd gcb-lite && composer install && npm install && npm run build
```

Then build your first block, either way:

- **Visually:** open **GCB Lite → Blocks** in wp-admin and add fields in the
  Schema Builder.
- **By hand:** in your active theme, create `blocks/{slug}/` with `block.json`
  and `block.fields.json`, then add a `render.php`.
- **From the CLI:** `wp gcblite scaffold hero --title="Hero" --controls="heading:text"`

The block shows up in the inserter with its Inspector controls, rendering
through `render.php` like any other WordPress block. That is the whole loop for
a PHP-rendered site.

### Adding a frontend (optional)

Only needed for blocks you want rendered by your own app instead of PHP. The
reference implementation is [gcb-next-starter](https://github.com/wordpress-gcb/gcb-next-starter),
which ships a working route, three example blocks and the `middleware.js` secret
check, with a live demo at https://gcb-next-starter.vercel.app/

Clone and run it (or implement the one route yourself in any framework), then
point the plugin at it:

```php
// wp-config.php
define('GCBLITE_COMPONENT_SERVER_URL', 'https://your-frontend.example.com');
// …or: add_filter('gcblite_frontend_url', fn () => 'https://your-frontend.example.com');
```

Blocks with no `render.php` now render through that URL, in the editor and on
the public site alike.

---

## Production status

Version 0.4.0, beta. GCB Lite runs in production on a number of live sites
across PHP-rendered builds, headless builds, and mixed stacks. The core
contracts (`block.fields.json`, the `<wp-block-wrapper>` render route, the REST
surface) have held stable through that use, and the architecture is settled.

Blocks rendered through `render.php` sit on the most well-trodden code path in
WordPress and carry no headless surface area at all. Blocks rendered through a
frontend add the wire contract, which is deliberately small: one HTTP route
returning one wrapper element, documented above and exercised in production
daily.

Pre-1.0 means APIs can still move. Breaking changes ship with a migration path.
Pin to a tagged release and follow the issue tracker.

---

## Documentation

- `AGENTS.md`: block-authoring guide covering field types, the `<repeater>` and
  `<innerblocks>` patterns, editor-SSR caveats, and UI conventions.
- [gcb-next-starter](https://github.com/wordpress-gcb/gcb-next-starter): the
  reference frontend, with three example blocks and a demo seed script.

## Contributing

GPL-2.0-or-later. The wire contract is intentionally minimal; what sits on
either side is yours. High-value contributions right now: reference frontends in
**Nuxt, Astro, and a plain-HTML endpoint** (these close out the
framework-agnostic test matrix above), tests around the marker swap and batch
coordinator, more example blocks, and production feedback.

## License

GPL-2.0-or-later. See `LICENSE`.
