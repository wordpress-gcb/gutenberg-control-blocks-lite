=== GCB Lite ===
Contributors: TODO-your-wp-org-username
Tags: gutenberg, blocks, headless, react, nextjs
Requires at least: 7.0
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

WordPress as a typed-field CMS for a React frontend. One React component renders both the editor preview and the public site.

== Description ==

GCB Lite turns Gutenberg into a typed-field authoring layer for a React frontend (Next.js, Astro, anything that can SSR React). Each block has a tiny PHP/JSON schema in your theme and one React component on your frontend. The same component renders the editor preview *and* the public site — no `edit.js` to maintain in parallel with your real frontend.

= The gap this exists to close =

Headless WordPress has been viable for years. Headless WordPress with a good editor experience hasn't:

* **Vanilla Gutenberg** assumes a PHP frontend. Build a custom block and you write `edit.js`, `save.js`, and your real React component. Three representations drifting apart.
* **WP 7's autoRegister** gives typed Inspector controls for simple blocks but renders in PHP.
* **ACF Blocks** give rich field types and PHP render. Nothing about a React frontend.
* **Headless + WPGraphQL** gives you the data but punts on the editor preview.

GCB Lite stops forcing a trade between Gutenberg authoring parity and a real React frontend.

= How it works =

A `gcb/*` block points at a React component on your Next.js (or Astro, etc.) frontend. When the editor needs a preview, WordPress calls your frontend server-to-server and embeds the returned HTML. When a visitor hits the public site, the same component renders directly. There is no React inside wp-admin — just rendered HTML.

The contract between WordPress and your frontend is one HTTP route returning one wrapper element. Implement it in any HTTP-capable React renderer.

Each block can also opt out of React entirely and use a standard `render.php` — the plugin auto-wires it. So you can adopt GCB Lite for the typed-field schema alone, ship every block as PHP, and never run a React frontend.

= What you get =

* 30+ Inspector control types including image with focal point, gallery with drag-to-reorder, post relationships, taxonomy, icon, repeater, color, range, code, datetime, url, google-map.
* Conditional logic on any field (show/hide based on sibling attribute values).
* Inspector panel grouping via structural `group` / `panel` / `tools-panel` types.
* Native Gutenberg authoring — inserter, drag-to-reorder, transforms, patterns, copy/paste, multi-select.
* InnerBlocks via `<repeater>` and `<innerblocks>` marker tags emitted from your render output — works identically for PHP-rendered and React-rendered parents.
* Batched preview rendering — one HTTP call for an N-block page, not N.
* Caching with proper invalidation (timestamp-based, restart-friendly).
* `blocks_raw` REST field exposing raw block markup for headless frontends.
* WordPress 7 Abilities API integration — `gcblite/list-blocks` and `gcblite/render-block` discoverable to the WP command palette and MCP clients (Claude Desktop, the WordPress MCP adapter). Gated on WP 7.0+; harmless on earlier WordPress.
* WP-CLI scaffold command for generating new blocks.

= External services =

If a block omits `render.php`, the plugin renders that block by making a server-to-server HTTP request to a Next.js (or any HTTP-SSR) frontend that you deploy and configure. **No external service is contacted unless you explicitly configure one** by defining `GCBLITE_COMPONENT_SERVER_URL` in `wp-config.php` (or via the `gcblite_frontend_url` filter).

The reference frontend implementation is the open-source `gcb-next-starter` repo: https://github.com/wordpress-gcb/gcb-next-starter

What is sent to the frontend service:

* The block's slug (e.g. `hero`).
* The block's saved attributes as URL-encoded JSON.
* Nothing else — no user data, no post metadata, no site secrets.

The frontend service returns rendered HTML wrapped in a documented wrapper element; nothing else is consumed.

You may host the frontend service anywhere (your own infrastructure, Vercel, Netlify, an internal VPN). The plugin's default URL is `http://localhost:3001`, which contacts nothing unless your WordPress install can reach that address.

For the contract details and the open-source reference implementation, see the documentation links below.

= REST endpoints =

The plugin registers REST routes under `/wp-json/gcblite/v1/`:

* `GET  /blocks` — schemas and defaults for every registered gcb/* block. Public-readable.
* `POST /render`, `POST /render-batch` — render a gcb/* block to HTML server-side. Public-readable.
* The plugin also adds a `blocks_raw` field to `/wp-json/wp/v2/pages` and `/wp-json/wp/v2/posts` so headless frontends can walk the block tree.

The render endpoints proxy to a frontend URL that is **only settable via `wp-config.php` constant or a PHP filter** — never via a public option or POST body. An attacker cannot redirect the proxy without filesystem access. The endpoints render only blocks registered as `gcb/*` on the site; arbitrary URLs are not reachable.

== Installation ==

1. Upload the `gcb-lite` directory to `/wp-content/plugins/`.
2. Activate the plugin through the **Plugins** menu in WordPress.
3. In your active theme, create a `blocks/{slug}/` directory containing `block.json` and (optionally) `block.fields.json`. The plugin auto-registers blocks it finds.
4. Add either a `render.php` to the same directory (PHP-rendered block) or wire a React component on your frontend (React-rendered block).
5. Optional: configure the React frontend URL by adding to `wp-config.php`:

       define('GCBLITE_COMPONENT_SERVER_URL', 'https://your-frontend.example.com');

For a working starter and three reference blocks, clone https://github.com/wordpress-gcb/gcb-next-starter — see also the live demo at https://gcb-next-starter.vercel.app/

== Frequently Asked Questions ==

= Do I have to use Next.js? =

No. The plugin defines a small HTTP contract; any service that can SSR React (Next.js, Astro, Express, custom Node) works. The starter happens to use Next.js because it's the most common choice.

= Can I use this without a React frontend at all? =

Yes. Use `render.php` for every block; the plugin acts as a typed-fields layer over standard Gutenberg, and no external service is contacted.

= Does this conflict with autoRegister in WordPress 7? =

No. They target different use cases. Reach for `supports.autoRegister` when you have a PHP-rendered block with a handful of typed atoms. Reach for GCB Lite when you need richer fields (image with focal point, gallery, post relationships) or a React frontend.

= Is this production-ready? =

Pre-1.0. The architecture is settled; specific APIs may move before 1.0. Pin to a release tag and follow the issue tracker for breaking changes.

== Changelog ==

= 0.1.0 =
* Initial public alpha. Registers gcb/* blocks from the active theme's `blocks/` directory. REST endpoints for block introspection and server-side rendering. WP 7 Abilities API integration. WP-CLI scaffold command.

== Upgrade Notice ==

= 0.1.0 =
First public release. Pre-1.0 alpha — APIs may move before 1.0.
