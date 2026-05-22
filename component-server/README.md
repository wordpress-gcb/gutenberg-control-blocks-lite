# gcb-lite component server

A small Next.js app that hosts React components for `gcb-lite` blocks. The
plugin's editor previews and public-frontend renders both call into this
server for any block whose theme folder has **no** `render.php`.

## What it serves

```
GET /wordpress/render/{slug}?attrs={url-encoded JSON}
  → <wp-block-wrapper data-block-name="{slug}" data-cache-timestamp="{ts}">
      ...component HTML...
    </wp-block-wrapper>
```

The plugin (`includes/Rendering/HtmlExtractor.php`) finds the `<wp-block-wrapper>`
markers and discards everything else from the response, so it doesn't matter
that Next.js wraps this in a full HTML document.

## Test blocks shipped with this server

Each one has its schema in
`wp-content/themes/control-blocks-theme/blocks/{slug}/`
and its React component in `components/`.

| slug             | shows off                                      |
|------------------|------------------------------------------------|
| `accordion-test` | Radix accordion primitive, several text fields |
| `text-image`     | text + WYSIWYG + image control + layout toggle |
| `gallery-test`   | gallery control (array of media)               |

## Running it

```bash
cd wp-content/plugins/gcb-lite/component-server
npm install
npm run dev       # http://localhost:3001
```

That's the URL the plugin defaults to. To point at a different URL:

```php
// wp-config.php
define('GCBLITE_COMPONENT_SERVER_URL', 'http://localhost:4000');
```

…or via filter:

```php
add_filter('gcblite_frontend_url', fn() => 'http://localhost:4000');
```

## End-to-end test (no editor required)

```bash
# in one terminal
npm run dev

# in another
curl -s 'http://localhost:3001/wordpress/render/text-image?attrs=%7B%22heading%22%3A%22Hello%22%7D' \
  | grep -oE '<wp-block-wrapper[^>]*>'
```

You should see `<wp-block-wrapper data-block-name="text-image" ...>` in the
output. If you do, the plugin can talk to this server.

To test the WordPress side of the round-trip, log into wp-admin → Pages →
Add New → insert a "Text + Image (React test)" block. The editor preview
should be the same SSR output you saw via curl.

## Adding a new block

1. **Theme:** create `wp-content/themes/control-blocks-theme/blocks/{slug}/`
   with `block.json` (standard WP) and optionally `block.fields.json` (gcb-lite
   Inspector controls). **Do not** add `render.php` — that would override the
   component-server path.
2. **Component:** add `components/{Name}.jsx` here, default export a function
   that takes `{ attributes, innerBlocks, innerHtml }`.
3. **Registry:** add the mapping in `wordpress/config/WPBlockRegistry.js`:
   `'gcb/{slug}': MyComponent`.

That's it — no plugin code changes, no build step needed for the WP side.

## Notes for shadcn / Radix users

The accordion test uses `@radix-ui/react-accordion` and pre-mounts content
with `forceMount`. This matters because the editor preview is a static SSR
render with no client hydration — without `forceMount`, Radix omits the
content of closed items and the editor shows empty panels.

If you bring in shadcn components, the same rule applies: anything that
relies on JS to reveal content needs to be visible in the initial server
render, or the editor preview won't show it.
