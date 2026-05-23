# GCB Lite

**Your Next.js frontend also renders blocks inside the WordPress editor.**
One React component per block, two consumers: your visitors and WordPress's
block editor. No `edit.js`, no `save.js`, no separate preview templates to
keep in sync.

```
WordPress (CMS)                                Next.js (your frontend)
─────────────────                              ──────────────────────────
Author edits a block                           Renders pages publicly
        ↓                                      Same React components
  block fields persist as typed attributes     ↓
        ↓                                      Exposes ONE route for WP:
Editor needs a preview ──────────────────────→ /wordpress/render/[block]
                                               returns the same React HTML
        ↓                                      that visitors see
HTML lands in the editor canvas
```

WordPress hits one route on the frontend you already have. The route returns
the same component you ship to visitors. That's the entire architecture.

---

## Why this exists

Real headless WordPress projects keep one painful invariant: the editor and
the public site drift apart. Faust.js, WPGraphQL, raw REST — they all give
the public site rich rendering, while the editor still shows a flat
PHP-rendered preview or a `ServerSideRender` placeholder. Authors edit
something that doesn't look like the live site.

GCB Lite fixes that at the contract level. WordPress holds typed fields and
asks your frontend to render. There is one component per block, and it is
the same one your visitors see.

You also get rich Inspector controls — image with focal point, gallery,
post relationships, taxonomy, repeater, range, color, datetime — that
WordPress 7's built-in `autoRegister` doesn't cover.

---

## When to use it

**Use GCB Lite when:**

- The frontend is React (Next.js, Astro, anything that SSRs React).
- You want the editor preview to match the public site, exactly.
- You want rich field types beyond core's `string / number / boolean / enum`.
- Your team is comfortable with React and is willing to own a small contract
  with the plugin (see *Production reality* below).

**Reach for something else when:**

- The site is classic WordPress, PHP-rendered, no separate frontend — core's
  [block bindings](https://developer.wordpress.org/news/2024/03/new-feature-the-block-bindings-api/)
  + ACF or `supports.autoRegister` is simpler.
- The team has no React capacity. Headless WordPress is React-heavy by
  definition; GCB Lite leans into that.
- The block library is two or three trivial blocks. The setup cost is real.

---

## Architecture

Two systems, one contract:

1. **WordPress + GCB Lite plugin** — registers blocks, holds typed fields,
   exposes REST endpoints, renders editor previews by calling your frontend.
2. **Your Next.js (or Astro, or Express) frontend** — already renders React
   components for visitors. You add one route (`/wordpress/render/[block]`)
   that returns the same components as HTML when WordPress asks.

There is no third service. The "component server" idea from earlier docs was
a documentation artefact, not architecture — the route lives in the same
Next.js deployment that serves your homepage.

For development, the [next-frontend-example/](./next-frontend-example/)
folder is a runnable starter that already implements the contract, including
three reference blocks (accordion, text+image, gallery). Use it as a
reference or copy from it into your project.

---

## What the plugin exposes

REST endpoints, all under `/wp-json/gcblite/v1/`:

- **`GET /blocks`** — every registered `gcb/*` block with its attribute
  schema and defaults. Public.
- **`POST /render`** and **`POST /render-batch`** — render a block (or many)
  to HTML server-side. The plugin uses the theme's `render.php` when present,
  otherwise calls into your frontend's `/wordpress/render/[block]` route.
- **`blocks_raw`** field on `/wp/v2/pages` and `/wp/v2/posts` — raw block
  markup with comments preserved, so a headless frontend can walk the block
  tree.

Plus WordPress 7's [Abilities API](https://make.wordpress.org/core/2026/03/24/client-side-abilities-api-in-wordpress-7-0/)
integrations:

- **`gcblite/list-blocks`** — discoverable by the WP command palette and
  MCP clients (Claude desktop, etc.) for introspecting available blocks.
- **`gcblite/render-block`** — same, for rendering blocks programmatically.

---

## Quick start

There's a 60-second walkthrough in
[next-frontend-example/README.md](./next-frontend-example/README.md) that
gets you to a working demo page on a real WordPress site.

The shape of authoring a new block:

```
themes/{theme}/blocks/team-grid/
├── block.json          # standard WP metadata
└── block.fields.json   # GCB Lite Inspector controls (optional)
```

```jsx
// In your Next.js frontend
export default function TeamGrid({ attributes }) {
  return <section>{attributes.heading}</section>;
}
```

Register it once in the frontend's block registry. The block appears in the
WordPress inserter; the editor preview is the React component; the public
site renders the same component. No second template, no parallel
implementation.

Full authoring guide: [AGENTS.md](./AGENTS.md) — field types, the `<repeater>`
and `<innerblocks>` patterns, editor-SSR caveats.

---

## Production reality

This is an alpha. Two things every team considering GCB Lite for a real
project should weigh:

**The contract is bespoke.** WordPress-fetches-HTML-from-your-Next-app is
not a path a million people have walked. WPGraphQL → JSON → React is.
The advantage is the editor/frontend parity nothing else gives you; the
disadvantage is that if this plugin's maintainers disappear, the team
adopting it inherits ~1,500 lines of PHP and JS to keep running. The code
is straightforward and the contract is documented — it's forkable. But it
is a thing to own.

**Pre-1.0 means the contract can shift.** APIs may move before 1.0. Every
breaking change will be documented and migration paths provided, but a
team launching to production this week should be willing to upgrade
deliberately.

If those trade-offs are wrong for your client, use WPGraphQL + Next.js. It's
the boring, well-trodden path, and "boring" is the right answer for a lot of
projects.

---

## Documentation

- [AGENTS.md](./AGENTS.md) — block-authoring guide. Field-type reference,
  Inspector patterns, editor-SSR caveats. Read this before building a block.
- [next-frontend-example/README.md](./next-frontend-example/README.md) —
  the runnable starter frontend.

## License

GPL-2.0-or-later. See [LICENSE](./LICENSE).
