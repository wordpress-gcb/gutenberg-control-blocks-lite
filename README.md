# GCB Lite

**WordPress as a typed-field CMS for a React frontend.** Write one component,
render it in both the Gutenberg editor and your public Next.js site. No
`edit.js` to maintain in parallel with your real frontend. No headless-WP
authoring blind spots.

```
You write:                 wp-admin shows:           Public site shows:
─────────────              ────────────────          ──────────────────
Hero.jsx                   Hero.jsx                  Hero.jsx
  + Hero.fields.json         (SSR via plugin)         (rendered directly)
```

One source of truth. The editor preview is the same React component you ship
to production, server-rendered and handed to wp-admin as HTML.

**[See the live demo →](https://gcb-next-starter.vercel.app/)** — a landing
page built from three composed GCB Lite blocks.

---

## The gap this exists to close

Headless WordPress has been viable for years. Headless WordPress with a
good editor experience hasn't.

- **Vanilla Gutenberg** assumes your frontend is PHP. Build a custom block
  and you write `edit.js` (editor preview), `save.js` (saved markup), and
  your real React component. Three representations of the same thing,
  drifting from each other forever.
- **WP 7's `autoRegister`** gives you typed Inspector controls for simple
  blocks. Render is still PHP. Doesn't help when your public site is Next,
  Astro, or anything else.
- **ACF Blocks** give you rich field types and PHP render. Nothing about
  your React frontend.
- **Headless + WPGraphQL** gives you the data but punts on the editor
  preview. Authors edit blind, see a placeholder in wp-admin, and reload
  the public site to find out what they made.

You want Gutenberg's authoring UX (inserter, drag-and-drop, transforms,
patterns), ACF's field richness, and a real React frontend — all at once.
GCB Lite is what happens when those stop being mutually exclusive.

---

## The architecture

The plugin defines a narrow protocol between WordPress and your frontend.
What sits on either side is your call.

### 1. One component, two contexts

A `gcb/*` block points at a React component on your Next.js frontend (or
Astro, or any HTTP-SSR service — Next is the default; the reference
starter lives at [wordpress-gcb/gcb-next-starter](https://github.com/wordpress-gcb/gcb-next-starter)).
When the
editor needs a preview, WordPress calls your frontend server-to-server
and embeds the returned HTML. When a visitor hits the public site, the
same component renders directly. There is no React inside wp-admin — just
rendered HTML.

```
┌──────────────────┐        ┌─────────────────────┐        ┌──────────────────────┐
│  wp-admin editor │  REST  │  GCB Lite plugin    │  HTTP  │  Your Next.js app    │
│                  │ ─────▶ │  (this repo)        │ ─────▶ │  (renders blocks)    │
│  author edits    │        │                     │        │                      │
│  Hero block      │ ◀───── │  /render-batch      │ ◀───── │  GET /wordpress/     │
│                  │  HTML  │  HtmlExtractor      │  HTML  │  render/hero         │
└──────────────────┘        └─────────────────────┘        └──────────────────────┘
                                                                      ▲
                                                                      │
                                                       Visitors hit ──┘
                                                       the same app
```

The contract is one HTTP route returning one wrapper element:

```html
<wp-block-wrapper data-block-name="hero" data-cache-timestamp="1716435847">
  <!-- your component's HTML -->
</wp-block-wrapper>
```

That's the entire protocol. Implement it in Next.js, Astro, Express,
anything that can SSR React. The reference Next.js implementation —
[wordpress-gcb/gcb-next-starter](https://github.com/wordpress-gcb/gcb-next-starter) —
ships with three working blocks and a richer block library on its
[`examples` branch](https://github.com/wordpress-gcb/gcb-next-starter/tree/examples).

**Crucially: this is not a third moving part.** The frontend that serves
visitors is the same frontend that serves the editor preview. You add
one route to the Next.js app you already deploy.

### 2. PHP and React are first-class peers

Each block picks its own render path by file existence:

| If the block has…       | The plugin…                                  |
|-------------------------|----------------------------------------------|
| `render.php`            | Runs it locally. Standard WP block.          |
| no `render.php`         | Calls your frontend for HTML.                |

You can adopt GCB Lite for the typed-field schema alone, ship every block
as `render.php`, and never run a React frontend. Or write one block in
React and leave the rest in PHP. Or go all-in. It's per-block, not
stack-wide.

For client work, this is the de-risk: the novel piece — server-to-server
React SSR — is opt-in per block. The boring fallback — PHP render callback
— is the most well-trodden code path in WordPress.

---

## A block, end to end

Three files in your active theme.

**`themes/{your-theme}/blocks/hero/block.json`**

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

Standard WordPress block metadata. No GCB-specific keys. `attributes` is
empty on purpose — they're generated from the controls.

**`themes/{your-theme}/blocks/hero/block.fields.json`**

```json
{
  "controls": [
    {
      "id": "ctrl_heading",
      "type": "text",
      "label": "Heading",
      "attributeKey": "heading"
    },
    {
      "id": "ctrl_image",
      "type": "image",
      "label": "Background",
      "attributeKey": "image",
      "enableFocalPoint": true,
      "enableFixedBackground": true
    },
    {
      "id": "ctrl_align",
      "type": "toggle-group",
      "label": "Alignment",
      "attributeKey": "align",
      "options": [
        { "label": "Left",   "value": "left" },
        { "label": "Center", "value": "center" }
      ],
      "default": "center"
    }
  ]
}
```

The plugin validates this, generates WP block attributes with correct types
and defaults, and renders the Inspector panel. No `edit.js`, no `save.js`.

**Pick your render path**

A. PHP — `themes/{your-theme}/blocks/hero/render.php`:

```php
<?php
$wrap = get_block_wrapper_attributes([
    'class'      => 'hero',
    'data-align' => $attributes['align'],
]);
$image = $attributes['image'] ?? [];
?>
<section <?php echo $wrap; ?> style="background-image: url('<?php echo esc_url($image['url'] ?? ''); ?>')">
  <h1><?php echo esc_html($attributes['heading']); ?></h1>
</section>
```

B. React — in your Next.js frontend's `components/Hero.jsx`:

```jsx
export default function Hero({ attributes }) {
  const { heading, image, align } = attributes;
  const fpx = image?.focalPoint?.x ?? 0.5;
  const fpy = image?.focalPoint?.y ?? 0.5;
  return (
    <section className={`hero hero--${align}`}>
      <img
        src={image?.url}
        alt={image?.alt}
        style={{ objectFit: 'cover', objectPosition: `${fpx*100}% ${fpy*100}%` }}
      />
      <h1>{heading}</h1>
    </section>
  );
}
```

…wired into the frontend's block registry:

```js
import Hero from '../../components/Hero';
export const WP_BLOCK_REGISTRY = { 'gcb/hero': Hero };
```

That's it. Either path, the block appears in the inserter, the Inspector
renders three controls (with a real focal point picker and a media library
connection on the image field), and the editor preview is server-rendered
HTML that matches what visitors see.

---

## What you get

**30+ Inspector control types**, with the rich ones being the point:

- **`image`** — media library, focal point picker, cover/contain/auto, custom width, repeat, fixed-background toggles
- **`gallery`** — drag-to-reorder via @dnd-kit, per-image alt text and ordering
- **`post-object`** — search and select published posts of any type, with filters
- **`taxonomy`** — pick terms with hierarchy support
- **`user`** — author picker
- **`relationship`** — bidirectional post relationships
- **`icon`** — Dashicons picker (Lucide / custom sources planned)
- **`color`**, **`range`**, **`code`**, **`datetime`**, **`url`**, **`google-map`**, **`file`**, **`wysiwyg`**, **`oembed`**
- **`select`**, **`radio`**, **`checkbox`**, **`checkbox-group`**, **`toggle`**, **`toggle-group`**, **`button-group`**
- **`size`**, **`spacing`**, **`page-link`**, **`message`**, **`text`**, **`textarea`**, **`number`**, **`email`**, **`date`**

Plus structural types (`group`, `panel`, `tools-panel`) that organise the
Inspector into collapsible sections via `parentPanelId` references. Plus
basic conditional logic (`==`, `!=`, `in`, `contains`, `>`, `<` over sibling
attribute values) for show/hide on any field.

**Native Gutenberg authoring.** Authors get the standard inserter,
drag-to-reorder, transforms, copy/paste, patterns, multi-select. GCB Lite
is not a page builder. It's how the dev side of Gutenberg should have
shipped.

**Repeater inner blocks.** Emit a `<repeater allowedBlocks='["gcb/team-member"]' />`
marker from your render output and the editor swaps it for a real
InnerBlocks UI — Add button, drag-to-reorder, child-type constraints. On
the public side, the same marker swaps for the rendered children. One
declaration, two contexts. Works identically for PHP-rendered and
React-rendered parents.

**Batched rendering.** Open a 30-block page in the editor; GCB Lite fires
one `/render-batch` HTTP call, not thirty. A singleton coordinator
debounces 1ms, supersedes in-flight requests on attribute change, and
demuxes responses by `clientId`.

**Caching with proper invalidation.** Per-block-per-attribute-hash
transients, keyed on a `data-cache-timestamp` your frontend stamps into
every response. Restart the frontend, the timestamp changes, the cache
invalidates. Network failures fall back to the last good HTML instead of
breaking the editor.

**Headless-ready REST surface**, public-readable:

| Endpoint                                        | What it gives you                                                                                            |
|-------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| `GET /wp-json/wp/v2/pages?slug=...`             | Includes `blocks_raw` — raw markup with block comments intact, so your frontend can walk the tree.           |
| `GET /wp-json/gcblite/v1/blocks`                | Schemas + defaults for every registered block. WordPress only persists attrs that differ from defaults.      |
| `POST /wp-json/gcblite/v1/render-batch`         | Render any block(s) to HTML server-side. Useful for blocks you haven't React-implemented yet.                |

**theme.json integration.** Your spacing, colors, and custom tokens flow
into the editor under `window.gcbLite.tokens` and are consumed by controls
that bind via `tokenGroup`. Authors pick from your design system, not a
free-form colour wheel.

**WP 7 Abilities API.** On WordPress 7.0+, `gcblite/list-blocks` and
`gcblite/render-block` are registered as typed abilities — surfaced to
the WP command palette and to MCP clients (Claude Desktop, the WordPress
MCP adapter, anything that speaks the protocol) for LLM tool use. AI
agents can introspect your block library and render blocks server-side
without anyone writing custom glue. Gated on
`function_exists('wp_register_ability')` so the plugin continues to work
fine on WP 6.x.

**WP-CLI scaffold.**

```bash
wp gcblite scaffold team-grid --title="Team Grid" --controls="heading:text,intro:textarea"
```

Also reads JSON specs from stdin, designed for AI agents to drive
end-to-end.

---

## How it compares

|                              | Vanilla Gutenberg | WP 7 autoRegister | ACF Blocks | Headless + WPGraphQL | **GCB Lite**                          |
|------------------------------|-------------------|-------------------|------------|----------------------|---------------------------------------|
| Field types                  | Basic             | Basic typed       | Rich       | Whatever you wire    | 30+, including focal point, gallery   |
| Editor preview               | `edit.js` (parallel) | PHP            | PHP        | None / broken        | Same component as the public site     |
| Public render                | `save.js` HTML    | PHP               | PHP        | Your stack           | PHP or React, your call per block     |
| Authoring UX                 | Gutenberg         | Gutenberg         | Gutenberg  | Gutenberg (blind)    | Gutenberg, with full preview parity   |
| Headless-ready               | Hard              | Hard              | Hard       | Yes                  | Built for it                          |
| Editor/public drift          | High              | Low               | Low        | Severe (no preview)  | Impossible — same source              |

Every other approach forces a trade between Gutenberg authoring parity and
a real React frontend. GCB Lite stops making that a choice.

---

## When to reach for autoRegister instead

If you have a PHP-rendered block with a handful of typed atoms and no
headless frontend in the picture, WP 7's `supports: { autoRegister: true }`
is lighter, ships in core, and is the right call.

Reach for GCB Lite when any of these are true:

- You need richer field types than core gives you (image with focal point,
  gallery, post relationships, etc.).
- Your frontend is React (Next, Astro, Remix) and you want one component
  driving both contexts.
- You're shipping a block library across multiple client sites and want
  one schema-driven authoring story.

---

## Quick start

Want to see what you're getting first?
**[Open the live demo](https://gcb-next-starter.vercel.app/)** — it's the
gcb-next-starter `examples` branch deployed as-is. The whole page is
composed from three GCB Lite blocks (Hero, FeatureTrio, Cta) rendered in
React.

```bash
# 1. Plugin
cd wp-content/plugins
git clone https://github.com/wordpress-gcb/gutenberg-control-blocks-lite gcb-lite
cd gcb-lite
composer install
npm install
npm run build

# 2. Reference Next.js frontend (skip if you only ship PHP-rendered blocks).
# Lives in its own repo; clone anywhere convenient.
cd ~/code   # or wherever you keep your projects
git clone https://github.com/wordpress-gcb/gcb-next-starter
cd gcb-next-starter
cp .env.local.example .env.local   # set NEXT_PUBLIC_WP_URL
npm install
npm run dev   # http://localhost:3001
```

Activate the plugin in wp-admin. In your active theme, create a
`blocks/{slug}/` directory with `block.json` and `block.fields.json` as
shown above. Add either a `render.php` or a React component plus a
registry entry on the frontend. The block shows up in the inserter on the
next editor load.

To point the plugin at a different frontend URL:

```php
// wp-config.php
define('GCBLITE_COMPONENT_SERVER_URL', 'https://your-frontend.example.com');
```

…or via filter:

```php
add_filter('gcblite_frontend_url', fn () => 'https://your-frontend.example.com');
```

For a 60-second demo against three working blocks, see the
[gcb-next-starter quick start](https://github.com/wordpress-gcb/gcb-next-starter#quick-start-60-seconds).

---

## Production reality

Version 0.1.0, public alpha. The architecture is settled; specific APIs
may move before 1.0. If you're shipping client work on it, pin to a
commit and follow the issue tracker.

Two trade-offs every team adopting GCB Lite for a real project should
weigh:

**The contract is bespoke.** WordPress-fetches-HTML-from-your-Next-app is
not a path a million people have walked. WPGraphQL → JSON → React is.
The advantage is editor/frontend parity nothing else gives you; the
trade-off is that if the maintainers walk, the adopter inherits ~1,500
lines of PHP and JS to keep running. The code is straightforward and the
contract is documented — it's forkable. But it is a thing to own.

**Pre-1.0 means the contract can shift.** APIs may move before 1.0. Every
breaking change will be documented with a migration path, but if you're
launching to production this week, expect to upgrade deliberately.

If those trade-offs are wrong for your client, use WPGraphQL + Next.js.
It's the boring, well-trodden path, and "boring" is the right answer for
a lot of projects.

---

## Documentation

- [AGENTS.md](./AGENTS.md) — block-authoring guide. Field types in detail,
  the `<repeater>` and `<innerblocks>` patterns, editor-SSR caveats,
  conventions for shadcn/Radix UI. Required reading before building a
  non-trivial block.
- [gcb-next-starter](https://github.com/wordpress-gcb/gcb-next-starter) —
  reference Next.js frontend (separate repo). Has three working blocks
  on `main`, a richer library on the `examples` branch.

---

## Contributing

GCB Lite is GPL-2.0-or-later. The wire contract is intentionally minimal —
what sits on either side of it is yours — and the implementation around
that contract is still early. Good first contributions:

- More example blocks in [gcb-next-starter](https://github.com/wordpress-gcb/gcb-next-starter)'s
  `examples` branch covering common patterns: forms, embeds, navigation,
  image-text variants.
- Tests, especially around the editor-side marker swap
  (`src/utils/parse-preview.js`) and the batched render coordinator.
- Reference frontends in Astro and Remix to prove out the wire-contract
  portability claim.
- Real-world feedback. If you're using GCB Lite in production, that's the
  most valuable signal we can get right now — open an issue and say hi.

---

## License

GPL-2.0-or-later. See [LICENSE](./LICENSE).
