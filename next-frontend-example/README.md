# next-frontend-example — runnable starter for the GCB Lite contract

A small Next.js app that implements the GCB Lite plugin's frontend contract.
Two things at once:

1. **Reference implementation** — shows what your real Next.js frontend
   needs to do: implement one route (`/wordpress/render/[block]`), wrap
   output in `<wp-block-wrapper>`, register a block-name → React component
   map.
2. **Live demo** — three React-rendered blocks (`accordion`, `text-image`,
   `gallery`) you can drop into a WordPress page and see render both in the
   editor and on the public side.

In production, you don't run this as a separate service. The pattern fits
into the Next.js (or Astro, or Express) app you already deploy to your
users — same Tailwind, same components, same deployment. This folder is
where to start; copy the bits you need into your own project.

When you clone the GCB Lite repo, this is where to start.

---

## Quick start (60 seconds)

You need a WordPress 6.x+ site running locally with the parent `gcb-lite`
plugin installed and the bundled `control-blocks-theme` active.

```bash
# 1. Start the example frontend
cd wp-content/plugins/gcb-lite/next-frontend-example
npm install
npm run dev
# → http://localhost:3001

# 2. In another terminal, seed a demo page with all three test blocks
cd /path/to/your/wp-install
bash wp-content/plugins/gcb-lite/next-frontend-example/sample-content/seed-demo-page.sh
```

The seed script creates a "GCB Lite Demo" page with one of each block. Open:

- `http://your-wp-site.test/wp-admin/edit.php?post_type=page` → click the
  demo page → edit it. The editor preview is the React component, rendered
  server-side by this app.
- `http://localhost:3001/gcb-lite-demo` → the public side, served by the
  same app. Same React component, same markup, no separate template.

Edit on the left, public site on the right, both from the same React file.

If you'd rather build the page by hand: in wp-admin, edit any page, and
from the block inserter add **Accordion (React test)**, **Text + Image
(React test)**, and/or **Gallery (React test)**.

---

## What this implements

Two responsibilities:

### 1. Render endpoint for the editor

```
GET /wordpress/render/{slug}?attrs={url-encoded JSON}
  → <wp-block-wrapper data-block-name="{slug}" data-cache-timestamp="{ts}">
      ...component HTML...
    </wp-block-wrapper>
```

The plugin (`includes/RestAPI/RenderAPI.php`) calls this server-to-server
when an editor preview needs HTML. The plugin's `HtmlExtractor` finds the
`<wp-block-wrapper>` markers and discards everything else (doctype, scripts,
styles), so Next.js wrapping its response in a full HTML document is fine.

### 2. Public-frontend page renderer

`app/[...slug]/page.jsx` fetches WordPress pages via `/wp-json/wp/v2/pages`,
parses block markup with `@wordpress/block-serialization-default-parser`,
and renders each block via the registry (or hands it back to the plugin for
blocks that don't have a React component).

If your existing Next.js project already does its own page rendering, you
only need the first piece — drop the route into your `app/` and register
the gcb-lite block components.

---

## Pointing at a different WordPress install

The plugin defaults to `http://localhost:3001` for the frontend it talks
to. Override with either:

```php
// wp-config.php
define('GCBLITE_COMPONENT_SERVER_URL', 'https://your-frontend.example.com');
```

…or via filter:

```php
add_filter('gcblite_frontend_url', fn() => 'https://your-frontend.example.com');
```

The frontend points at WordPress via an env var:

```bash
# next-frontend-example/.env.local
NEXT_PUBLIC_WP_URL=http://your-wp-site.test
```

---

## Adding a new block

Same three-step pattern that ships the test blocks:

1. **Theme:** create `themes/{active}/blocks/{slug}/` with `block.json`
   (standard WP) and optionally `block.fields.json` (gcb-lite Inspector
   controls). **Do not** add `render.php` — that would route the editor
   preview through PHP instead of your frontend.
2. **React component:** add `components/{Name}.jsx`, default export a
   function that takes `{ attributes, innerBlocks, innerHtml }`.
3. **Registry:** add the mapping in `wordpress/config/WPBlockRegistry.js`:
   `'gcb/{slug}': MyComponent`.

No plugin code changes, no build step on the WordPress side. The plugin
discovers your block from `block.json` automatically.

For the full authoring contract (control types, Inspector grouping,
`<repeater>` / `<innerblocks>` patterns, editor-preview caveats), see
[../AGENTS.md](../AGENTS.md).

---

## End-to-end smoke test (no WordPress required)

```bash
npm run dev

# in another terminal
curl -s 'http://localhost:3001/wordpress/render/text-image?attrs=%7B%22heading%22%3A%22Hello%22%7D' \
  | grep -oE '<wp-block-wrapper[^>]*>'
```

You should see `<wp-block-wrapper data-block-name="text-image" ...>`. If
you do, anything that speaks the contract can talk to this app — including
the WordPress plugin.

---

## Notes for shadcn / Radix / any JS-driven UI

The editor preview is **static SSR with no client hydration**. That has
two consequences worth knowing about up front:

- **`<Accordion.Item>` (and similar Radix/headless-UI primitives that read
  context) crash when rendered standalone.** The editor renders each block
  independently — a child block won't be nested in its parent's `<Root>`
  in the editor preview. Wrap each item in its own `<Root>` so it's
  self-contained. See `components/AccordionItem.jsx`.
- **Anything hidden until you click stays hidden.** Use `forceMount` on
  collapsible Radix primitives so the closed state has children in the
  DOM anyway. Pair with an editor-only CSS override
  (`/wordpress/editor.css`) to force-open in the editor.

The same rules apply to shadcn — it's a thin layer over Radix.
