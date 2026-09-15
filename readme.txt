=== GCB Lite ===
Contributors: TODO-your-wp-org-username
Tags: gutenberg, blocks, headless, react, nextjs
Requires at least: 7.0
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 0.4.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Typed-field blocks with native Inspector controls. Render them in PHP, or from your own frontend so the editor preview is the real thing.

== Description ==

GCB Lite turns Gutenberg into a typed-field authoring layer. Each block gets a small JSON schema in your theme, and GCB Lite generates the attributes and renders a native Inspector from it.

Blocks render one of two ways, chosen per block:

* **PHP (the default).** Add a `render.php` and the block behaves like any other WordPress block. No frontend, no external service, and the whole plugin ecosystem keeps working.
* **Your own frontend (optional).** Omit `render.php` and WordPress fetches the block's HTML from an app you deploy. The same render serves the editor preview and the public site, so there is no `edit.js` to keep in sync and no drift between them.

The frontend path is one HTTP route returning your HTML in a wrapper element, so anything that serves HTML works: Next.js, Astro, Nuxt, Express, a static file server.

= The gap this exists to close =

Headless WordPress has been viable for years. Headless WordPress with a good editor experience hasn't:

* **Vanilla Gutenberg** makes you write `edit.js`, `save.js`, and your real component for a custom block. Three representations drifting apart.
* **WP 7's autoRegister** gives typed Inspector controls for simple blocks, but only basic field types.
* **ACF Blocks** give rich field types and PHP render, with a bolted-on Inspector and nothing for a custom frontend.
* **Headless + WPGraphQL** gives you the data but punts on the editor preview.

GCB Lite stops forcing a trade between Gutenberg authoring parity and owning your own frontend.

= How it works =

A `gcb/*` block declares its fields in `block.fields.json`. GCB Lite validates that, generates the WordPress attributes with correct types and defaults, and renders a native Inspector from it.

If the block has a `render.php`, WordPress runs it locally and the block is an ordinary WordPress block.

If it doesn't, WordPress calls your frontend server-to-server and embeds the returned HTML. A visitor hitting the public site gets that same render, so the editor preview and the published page cannot drift. Nothing runs inside wp-admin except rendered HTML.

The contract is one HTTP route returning one wrapper element, so any framework that serves HTML can implement it.

= What you get =

* 30+ Inspector control types including image with focal point, gallery with drag-to-reorder, post relationships, taxonomy, icon, repeater, query-loop, color, range, code, datetime, url, google-map.
* Conditional logic on any field (show/hide based on sibling attribute values).
* Inspector panel grouping via structural `group` / `panel` / `tools-panel` types.
* Schema Builder: author blocks and structured fields visually in wp-admin, with drafts, deletion and deep links. It writes the same `block.fields.json` you would hand-author.
* Text fields edit in place: authors type directly into the rendered component, not a sidebar box.
* Editor styling permissions: curate which design tokens the client may pick from, per field, clamping the native pickers.
* Kit blocks shipped with the plugin: `gcb/icon-list` (typed lists with the core-list Enter grammar) and `gcb/map` (a real interactive Google map via the Maps JS API). A theme can override either by slug.
* Crash-safe rendering: a fatal in one block's `render.php` cannot white-screen the page.
* Native Gutenberg authoring: inserter, drag-to-reorder, transforms, patterns, copy/paste, multi-select.
* InnerBlocks via `<repeater>` and `<innerblocks>` marker tags emitted from your render output, working identically for PHP-rendered and frontend-rendered parents. Six repeater edit layouts.
* Batched preview rendering: one HTTP call for an N-block page, not N.
* Caching with proper invalidation (timestamp-based, restart-friendly).
* Design tokens read from theme.json, with a token picker on color/spacing/size fields.
* Config-driven custom post types, with per-CPT allowed blocks.
* `blocks_raw` REST field exposing raw block markup for headless frontends.
* WordPress 7 Abilities API integration: `gcblite/list-blocks`, `gcblite/render-block` and `gcblite/create-block` discoverable to the WP command palette and MCP clients (Claude Desktop, the WordPress MCP adapter). Gated on WP 7.0+; harmless on earlier WordPress.
* WP-CLI scaffold command for generating new blocks.

= External services =

If a block omits `render.php`, the plugin renders that block by making a server-to-server HTTP request to a frontend that you deploy and configure. **No external service is contacted unless you explicitly configure one** by defining `GCBLITE_COMPONENT_SERVER_URL` in `wp-config.php` (or via the `gcblite_frontend_url` filter).

The reference frontend implementation is the open-source `gcb-next-starter` repo: https://github.com/wordpress-gcb/gcb-next-starter

What is sent to the frontend service:

* The block's slug (e.g. `hero`).
* The block's saved attributes as URL-encoded JSON.
* Nothing else: no user data, no post metadata, no site secrets.

The frontend service returns rendered HTML wrapped in a documented wrapper element; nothing else is consumed.

You may host the frontend service anywhere (your own infrastructure, Vercel, Netlify, an internal VPN). The plugin's default URL is `http://localhost:3001`, which contacts nothing unless your WordPress install can reach that address.

For the contract details and the open-source reference implementation, see the documentation links below.

= REST endpoints =

The plugin registers REST routes under `/wp-json/gcblite/v1/`:

* `GET  /blocks`: schemas and defaults for every registered gcb/* block. Public-readable.
* `POST /render`, `POST /render-batch`: render a gcb/* block to HTML server-side. Public-readable.
* The plugin also adds a `blocks_raw` field to `/wp-json/wp/v2/pages` and `/wp-json/wp/v2/posts` so headless frontends can walk the block tree.

The render endpoints proxy to a frontend URL that is **only settable via `wp-config.php` constant or a PHP filter**, never via a public option or POST body. An attacker cannot redirect the proxy without filesystem access. The endpoints render only blocks registered as `gcb/*` on the site; arbitrary URLs are not reachable.

== Installation ==

1. Upload the `gcb-lite` directory to `/wp-content/plugins/`.
2. Activate the plugin through the **Plugins** menu in WordPress.
3. In your active theme, create a `blocks/{slug}/` directory containing `block.json` and (optionally) `block.fields.json`. The plugin auto-registers blocks it finds.
4. Add a `render.php` to the same directory (PHP-rendered block), or omit it and wire a component on your own frontend (frontend-rendered block).
5. Optional, for frontend-rendered blocks only: configure the frontend URL by adding to `wp-config.php`:

       define('GCBLITE_COMPONENT_SERVER_URL', 'https://your-frontend.example.com');

For a working starter and three reference blocks, clone https://github.com/wordpress-gcb/gcb-next-starter, and see the live demo at https://gcb-next-starter.vercel.app/

== Frequently Asked Questions ==

= Do I have to use Next.js? =

No. The plugin defines a small HTTP contract, and any service that can return HTML works: Next.js, Astro, Nuxt, Express, custom Node, even a static file server. The starter happens to use Next.js because it's the most common choice.

= Can I use this without a separate frontend at all? =

Yes. Use `render.php` for every block; the plugin acts as a typed-fields layer over standard Gutenberg, and no external service is contacted.

= Does this conflict with autoRegister in WordPress 7? =

No. They target different use cases. Reach for `supports.autoRegister` when you have a PHP-rendered block with a handful of typed atoms. Reach for GCB Lite when you need richer fields (image with focal point, gallery, post relationships), the Schema Builder, or rendering from your own frontend.

= Is this production-ready? =

Yes. GCB Lite runs in production on a number of live sites, across PHP-rendered builds, headless builds and mixed stacks, and the core contracts have held stable through that use. Still pre-1.0, so remaining API changes ship with a migration path. Pin to a release tag and follow the issue tracker.

== Changelog ==

= 0.4.0 =
* Editor styling permissions: curate which design tokens the client may pick from, per field. A `blockEditor.useSetting.before` filter clamps the native font-size, colour and spacing pickers to the allowed presets and closes the custom-value gate with them, so authors cannot type around the scale. Permissions belong to the region, so nested blocks inherit them.
* Text fields edit in place: the preview parser binds field elements to RichText, so authors type into the rendered component. Typing never refetches, because inline attributes stay out of the render key.
* Editor grid: chrome wrappers go `display:contents` inside a gcb grid, so per-child grid placements apply in the editor instead of collapsing into one auto cell.
* Scaffolder: block meta may carry `supports` and `attributes` overrides.
* Icon list items centre-align on the row text, and the old optical margin hack is gone.
* Formatting: wp-prettier pass across the JS sources and tests. No behaviour change.

= 0.3.0 =
* Beta. Months of real-world use across many projects; core contracts stable.
* Native-edit kit blocks: gcb/icon-list (typed, edited in place) and gcb/map (real front-end Google Map via the Maps JS API, styled by Cloud Map ID).
* Repeater edit-layouts: six ways to author repeating content.
* query-loop field: paginated server-side WP_Query with filtering.
* Design tokens: palette/font sizes read from theme.json, token picker on color/spacing/size fields, REST to write custom tokens.
* Config-driven post types: CPT registrar + REST API, per-CPT allowed blocks.
* Schema Builder: delete blocks, draft-workspace editing, deep links via URL param.
* BlockLoader: crash-safe render (a bad block can never white-screen the page), `gcblite_block_dirs` filter for companion plugins, WP 7.0 `render.php` callback fix.
* Field/inspector UI now consumed from the published @wordpress-gcb/fields SDK.
* Abilities: gcblite/create-block for typed-fields-only block creation.

= 0.2.0 =
* Schema Builder: visual block + structured-field editor in wp-admin.
* Structured fields: ACF-parity feature pass; richtext and heading-level control types.
* Shared-secret auth on outbound render calls (`GCBLITE_RENDER_SECRET`).
* Click-to-focus: click a preview element to focus and flash its Inspector field.
* WP 7.0 native icons; richtext popover in the sidebar.
* Complete control reference docs, single-sourced from `schemas/`; all-fields showcase block and `wp gcblite seed-showcase`.

= 0.1.0 =
* Initial public alpha. Registers gcb/* blocks from the active theme's `blocks/` directory. REST endpoints for block introspection and server-side rendering. WP 7 Abilities API integration. WP-CLI scaffold command.

== Upgrade Notice ==

= 0.4.0 =
Adds editor styling permissions and in-place text editing. No breaking changes from 0.3.0.

= 0.3.0 =
Now beta after months of production use. Core contracts stable; pre-1.0 API changes ship with migration paths.

= 0.1.0 =
First public release. Pre-1.0 alpha. APIs may move before 1.0.
