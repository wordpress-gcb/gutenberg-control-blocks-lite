# GCB Lite

**WordPress as a typed-field CMS for a React frontend.** One component renders
both the editor preview and the public site. No `edit.js`, no `save.js`, no
per-block webpack config.

```
Theme (typed schema)         Plugin (bridge)              Component server (your React)
─────────────────────        ─────────────────            ──────────────────────────────
blocks/hero/                 /gcblite/v1/render-batch     components/Hero.jsx
  block.json                       ↓                      ──────────────────────────────
  block.fields.json          wp_remote_get → ↓
                                              /wordpress/render/hero?attrs=…
                                              returns <wp-block-wrapper>…</wp-block-wrapper>
```

You write the React component once. The plugin SSRs it for the Gutenberg
editor preview and serves it to your public Next.js (or any HTTP) frontend.
WordPress stays a content store with a familiar block-editor authoring UX.

---

## Why this and not just Gutenberg + WP 7.0 autoRegister?

WordPress 7.0 added `supports: { autoRegister: true }` which generates an
Inspector from typed block attributes. It's the right choice for many
blocks. It's not the right choice for the cases this plugin exists for.

|                                              | WP 7 autoRegister             | GCB Lite                                |
|----------------------------------------------|-------------------------------|-----------------------------------------|
| Field types                                  | string, number, boolean, enum | 30+ (image w/ focal point, gallery, post-relationship, taxonomy, icon, repeater, color, range, file, url, code, datetime, …) |
| Editor preview ↔ public site parity          | PHP HTML, both contexts       | Same React component, both contexts     |
| Headless React frontend (Next.js, Astro…)    | Not addressed                 | Built around it                         |
| Inspector panel grouping, helpText           | No                            | Yes                                     |
| Rich-control UIs (focal-point picker, drag-reorder gallery) | No             | Yes                                     |
| Authoring complexity for the simple cases    | One PHP file                  | Two files (block.json + block.fields.json) |

**Reach for autoRegister when** you have a PHP-rendered block with a few
typed atoms. It's lighter and shipped in core.

**Reach for GCB Lite when** you want rich field types, or your frontend is
React, or you want one component to drive both editor and public site.

---

## How it works

The plugin exposes three things:

- **`/gcblite/v1/blocks`** — JSON of every registered `gcb/*` block and the
  defaults of its attributes. Public-readable.
- **`/gcblite/v1/render`** and **`/gcblite/v1/render-batch`** — render a
  block to HTML server-side. Uses the theme's `render.php` if present,
  otherwise makes a server-to-server request to the configured component
  server.
- **`blocks_raw`** REST field — added to `/wp/v2/pages` and `/wp/v2/posts`
  so a headless frontend can read raw block markup (with `<!-- wp:gcb/... -->`
  comments) and walk the tree to render gcb blocks as React components.

The editor never sees the React code — only HTML. No CORS, no React bundle
shipped to wp-admin, no per-block webpack config.

For the full mechanism (batched render coordinator, HTML extractor,
`<wp-block-wrapper>` contract, `<repeater>` and `<innerblocks>` markers),
see [AGENTS.md](./AGENTS.md).

---

## Quick start

```bash
# Plugin
cd wp-content/plugins/gcb-lite
composer install
npm install
npm run build

# Component server (sample, lives beside the plugin)
cd component-server
npm install
npm run dev    # http://localhost:3001
```

In your theme, create a block:

```
themes/{theme}/blocks/team-grid/
├── block.json          # standard WP metadata
└── block.fields.json   # GCB Lite Inspector controls (optional)
```

In the component server:

```jsx
// components/TeamGrid.jsx
export default function TeamGrid({ attributes }) {
  return <section>{attributes.heading}</section>;
}

// wordpress/config/WPBlockRegistry.js
import TeamGrid from '../../components/TeamGrid';
export const WP_BLOCK_REGISTRY = {
  'gcb/team-grid': TeamGrid,
};
```

That's it. The block appears in the editor inserter; its preview renders via
the React component; the public Next.js site renders it from the same file.

To customise where the component server lives (default
`http://localhost:3001`):

```php
// wp-config.php
define('GCBLITE_COMPONENT_SERVER_URL', 'https://my-frontend.example.com');
```

or via filter: `add_filter('gcblite_frontend_url', fn () => 'https://…');`.

---

## What this plugin is NOT trying to be

- **A replacement for autoRegister for simple blocks.** Core's path is
  lighter for a button-text + colour widget. Use it.
- **A frontend framework.** The component server is yours — Next.js, Astro,
  vanilla Express, anything that can serve HTTP and SSR React. The plugin
  just speaks to it over a documented contract.
- **A page builder.** It's still Gutenberg. Authors get the standard block
  editor; this plugin shapes how custom blocks are authored on the dev side.

---

## Status

Pre-release. The plugin works end-to-end for the cases above. APIs may move
before 1.0.

---

## Documentation

- [AGENTS.md](./AGENTS.md) — block-authoring guide. Field-type table,
  component conventions, the `<repeater>` and `<innerblocks>` patterns,
  caveats around editor SSR (no client hydration). Worth reading before
  building a block.
- [component-server/README.md](./component-server/README.md) — the sample
  Next.js component server that ships alongside the plugin.
