# gcb-lite component server — reference implementation & live demo

A small Next.js app that does two things:

1. **Reference implementation** — shows the contract any component server has
   to honour for the `gcb-lite` plugin (one route, one wrapper element).
2. **Working demo** — three real React-rendered blocks (`accordion`,
   `text-image`, `gallery`) you can drop into a WordPress page and see render
   both in the editor and on the public side.

When you clone the gcb-lite repo, this is where to start.

---

## Quick start (60 seconds)

You need a WordPress 6.x+ site running locally with the parent `gcb-lite`
plugin installed and the bundled `control-blocks-theme` active.

```bash
# 1. Start the component server
cd wp-content/plugins/gcb-lite/component-server
npm install
npm run dev
# → http://localhost:3001

# 2. In another terminal, seed a demo page that uses all three test blocks
cd /path/to/your/wp-install
bash wp-content/plugins/gcb-lite/component-server/sample-content/seed-demo-page.sh
```

The seed script creates a "GCB Lite Demo" page with one of each block. Open:

- `http://your-wp-site.test/wp-admin/edit.php?post_type=page` → click the demo
  page → edit it. The editor preview is the React component, rendered server-side.
- `http://localhost:3001/gcb-lite-demo` → the public side. Same React component,
  same markup, no separate template.

That's the elevator pitch in one screenshot: edit on the left, public site on
the right, both rendered from the same React file.

If you'd rather build the page by hand: in wp-admin, edit any page, and from
the block inserter add **Accordion (React test)**, **Text + Image (React test)**,
and/or **Gallery (React test)**.

---

## How it works

The plugin (`includes/RestAPI/RenderAPI.php`) makes a server-to-server
GET to:

```
GET /wordpress/render/{slug}?attrs={url-encoded JSON}
  → <wp-block-wrapper data-block-name="{slug}" data-cache-timestamp="{ts}">
      ...component HTML...
    </wp-block-wrapper>
```

The plugin's `HtmlExtractor` finds the `<wp-block-wrapper>` markers and
discards everything else (doctype, scripts, styles), so Next.js wrapping
its response in a full HTML document is fine.

For the public frontend, the same app exposes `/[...slug]` which fetches
WP pages over `/wp-json/wp/v2/pages`, parses block markup via
`@wordpress/block-serialization-default-parser`, and renders each block via
the registry (or hands it back to the plugin for blocks that don't have a
React component).

---

## Pointing at a different WordPress install

The plugin defaults to `http://localhost:3001` for the component server.
Override with either:

```php
// wp-config.php
define('GCBLITE_COMPONENT_SERVER_URL', 'http://localhost:4000');
```

…or via filter:

```php
add_filter('gcblite_frontend_url', fn() => 'http://localhost:4000');
```

The component server points at WordPress via an env var:

```bash
# component-server/.env.local
NEXT_PUBLIC_WP_URL=http://gcblitewp.test
```

---

## Adding a new block

The same three-step pattern that ships the test blocks:

1. **Theme:** create `themes/{active}/blocks/{slug}/` with `block.json`
   (standard WP) and optionally `block.fields.json` (gcb-lite Inspector
   controls). **Do not** add `render.php` — that would override the
   component-server path.
2. **React component:** add `components/{Name}.jsx`, default export a
   function that takes `{ attributes, innerBlocks, innerHtml }`.
3. **Registry:** add the mapping in `wordpress/config/WPBlockRegistry.js`:
   `'gcb/{slug}': MyComponent`.

No plugin code changes, no build step needed for the WordPress side. The
plugin discovers your block from `block.json` automatically.

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

You should see `<wp-block-wrapper data-block-name="text-image" ...>`. If you
do, anything that knows the contract can talk to this server.

---

## Notes for shadcn / Radix / any JS-driven UI

The editor preview is a **static SSR render with no client hydration**.
That has two consequences worth knowing about up front:

- **`<Accordion.Item>` (and similar Radix/headless-UI primitives that read
  context) crash when rendered standalone.** The editor renders each block
  independently — a child block won't be nested in its parent's `<Root>` in
  the editor preview. Wrap each item in its own `<Root>` so it's
  self-contained. See `components/AccordionItem.jsx`.
- **Anything hidden until you click stays hidden.** Use `forceMount` on
  collapsible Radix primitives so the closed state still has children in
  the DOM. Pair with an editor-only CSS override
  (`/wordpress/editor.css`) to force-open in the editor.

The same rules apply to shadcn — it's a thin layer over Radix.
