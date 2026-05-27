---
slug: headless
title: Headless rendering
section: Headless rendering
order: 1
---

GCB Lite is built for a headless setup: WordPress holds the content, a React frontend (Next.js, Astro, Remix — anything that can run a component server) renders it. The same React components power both the WordPress block editor preview AND the public site.

## The end-to-end flow

1. **Edit in WP** — author drops blocks on a page. Each block's `block.fields.json` renders an Inspector panel; values save as typed WP attributes.
2. **Persist as block markup** — WP writes the page as a sequence of HTML comments: `<!-- wp:gcb/foo {...} /-->`.
3. **Fetch via REST** — your Next.js frontend fetches the page, reads its `blocks_raw` field (added by gcb-lite's REST extension) or falls back to `content.rendered`.
4. **Parse** — use `@wordpress/block-serialization-default-parser` to turn block markup into a tree of `{ blockName, attrs, innerBlocks }`. See [Block parser](/docs/headless/parser).
5. **Dispatch** — walk the tree and look up each block in your `WP_BLOCK_REGISTRY`. Render the matching React component with the parsed attributes. See [Block registry](/docs/headless/registry).
6. **Section blocks fetch their own data** — a brands strip block hits the brand CPT collection; a blog grid block hits `/wp/v2/posts`. Use `getCptCollection(postType, attrs)` to mirror the plugin's PHP Collection helper. See [Collection helper](/docs/headless/collection).

## Why this matters

The classic Gutenberg setup has two render paths: an `edit.js` for the editor and a `save.js` (or PHP `render.php`) for the frontend. They drift. The editor previews one thing, the public site renders another, and the editor lies about what readers will see.

GCB Lite collapses both into a single React component. The plugin SSRs your component server's output INTO the editor preview, so the preview IS the live site, fed by the live attributes. No `edit.js` to maintain.

> This is the differentiator vs. WordPress 7's declarative inspector controls. The inspector surface alone is becoming commoditised. The editor/frontend parity story is the moat.

## Read on

- [Block parser](/docs/headless/parser) — turning block markup into a tree.
- [Block registry](/docs/headless/registry) — dispatching to React components.
- [Collection helper](/docs/headless/collection) — fetching CPT records from inside a section block.
- [Deploy](/docs/headless/deploy) — Vercel + WP-on-Kinsta and other patterns.
