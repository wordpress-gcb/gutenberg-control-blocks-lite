# GCB — TODO

Gaps found building a real client kit on GCB Lite: the PMY Showman's Show
microsite (`~/sites/showmansshow`, theme `showmansshow`, 18 blocks, 2026-10-07).
Each item says what bit, the workaround that shipped, and the fix it points at.
Items in another repo are marked **[fields-sdk]**.

## High — the friction every interactive block hits

- [ ] **Per-block editor scripts.** A theme block can't ship editor-only JS
  beside its `render.php`. Touchpoint Zoom draws its pins on the canvas with an
  editor script the theme enqueues globally (`showmansshow/functions.php` →
  `assets/editor-touchpoints.js`). Honour `editorScript` / `editorStyle`
  (`file:./editor.js`) in theme `block.json` via `BlockLoader`, and document the
  pattern in AGENTS.md: a GCB block's editor overlay lives next to it.

- [ ] **Interactive blocks in the editor preview.** The preview is static SSR
  with no JS, so every scroll-driven or animated block needs a second, static
  "storyboard" layout (the kit uses an `is-live` class that only `view.js` adds).
  Options, roughly in order of effort: document the `is-live` pattern as the
  convention; let a block opt in to running its `viewScript` inside the canvas
  (flagged, so it can choose a lighter editor mode); an `editorView` hook.

- [ ] **Give controls their block.** **[fields-sdk + lite]** `renderControl`
  passes `{ control, value, onChange, attributes }` — no `clientId`. PinMap,
  Point and Hotspots all fall back to `getSelectedBlockClientId()` (see
  `docs/hotspot-field.md` §7). Pass `clientId` and `blockName`.

- [ ] **Parent ↔ child context.** A child can't know its index or count, and a
  parent's editor preview doesn't know its children (render-batch renders each
  alone). The kit numbers cards with CSS counters and draws pins from `view.js`
  and the editor script. Provide child context (index, count, parent attrs —
  e.g. via `providesContext`/`usesContext` set up from the `<Repeater>` marker),
  and optionally a children summary in the parent's render request.

- [ ] **Asset versions for block files.** Theme block `style.css` / `view.js`
  are versioned with the WP version, so browsers keep stale files after every
  edit. Set `ver` to the file's mtime for `file:` assets in `BlockLoader`.
  Workaround: an `init` loop in `showmansshow/functions.php`.

## Extension points — so a theme, Pro or the AI can add its own field types

Adding `pin-map` meant editing three places in core (`controlComponents` in
`src/index.js`, `BlockLoader::OBJECT_CONTROLS`, `BlockGcbValidator`), and
`docs/hotspot-field.md` shows what happens when the AI's field vocabulary is a
sentence in a prompt. In order:

- [x] **1. Registration API.** *(Done 2026-10-07 — `includes/Fields/ControlTypes.php`,
  `src/control-hub.js`, AGENTS.md "Adding your own field type"; checked end to
  end with a field type registered from a throwaway mu-plugin.)* One call per field type: PHP
  `gcblite_register_control_type($type, ['shape', 'doc', 'script'])` + the
  `gcblite_control_types` filter; JS `window.gcbLiteControls.register(type,
  Component)`, picked up by all three editor bundles. The registered type is
  typed as an attribute, known to the validator, and — with its doc file — part
  of the control vocabulary (`ControlDocs` / `Contract\Fields::control_types()`),
  so Pro's AI sees it with no edit on Pro's side. Lite's own object fields
  register through it instead of hard-coded lists. Register on the
  `gcblite_register_control_types` action (init/4): blocks are typed at
  init/5, and a later registration warns. The validator now refuses unknown
  types (row fields included) and names the nearest real one ("Did you mean
  `image`?") — all 3,529 block.fields.json files on the dev machine pass.
  Follow-up: the JSON schema's `type` enum only knows Lite's own types.
- [x] **2. The AI's vocabulary comes from the registry.** *(Done 2026-10-07.)*
  `Contract\Fields::control_shape()` / `control_source()` / `list_controls()`
  (contract 1.1) and the `gcblite/list-controls` ability. gcb-pro's FieldTypes
  now takes each type's stored shape from lite instead of its hand-kept column
  (which had drifted: heading-level `string` against lite's `{ text, level }` —
  and ChildBlockParser types generated blocks' attributes from it), and builds
  the prompt's type list from lite's whole documented vocabulary, still narrowed
  to what Build carries. Listing every type's derived shape turned up five
  types the PHP fields SDK typed against their own docs — button-group,
  page-link, query-loop, heading, taxonomy — fixed in php-sdk (7001f08, 9747fc7)
  and corrected in lite (`ControlTypes::SDK_CORRECTIONS`) until that release is
  vendored. **Drop SDK_CORRECTIONS once php-sdk ≥ those commits ships.**
  Not done: a registered type reaches the prompt only if Build can carry it —
  Build needs an emitter per type (compile/leaf.js + ChildBlockParser), so a new
  type's AI path is still a Build change (see 5).
- [x] **3. Each field type ships a contract check.** *(Done 2026-10-07 —
  `includes/Fields/ContractChecks.php`, `'check'` on a registered type, the
  `gcblite/check-blocks` ability, WP_DEBUG warnings as blocks load.)* Lite's
  own: pin-map (a child to place; single mode a declared point field — WP drops
  an undeclared attribute; grouped mode the repeater, and its point row key a
  point if declared) and layout (a repeater to lay out). Its first run flagged
  the Touchpoint card's locations having no declared point sub-field — fine
  for rows (the map writes it), so the rule was made exact rather than the
  block changed. Not done: hotspots' markup rules (no name, a rival `<img>`,
  six pins) are gcb-pro manuscript checks — they belong in pro's check suite.
- [ ] **4. An editor bridge for per-block overlays** (with per-block
  `editor.js`, above): `getChildren()`, `selectChild()`, `updateChild()`,
  `onPreviewRendered()` — the AI-writable layer, so an overlay like
  `editor-touchpoints.js` needs no `wp.data` / iframe / refresh knowledge.
- [ ] **5. Fields that edit children, as one kind.** The layout grid and the
  pin map are the same idea; at the third (a timeline placing milestones along
  a line) make it one declared kind — `editor: "map" | "grid" | "timeline"` —
  that the AI picks rather than builds.

Line drawn: the AI composes registered, tested parts and writes overlays
through the bridge; it does not generate React field components at build time
(unreviewed code in wp-admin, a JSX build, a different field per site). A new
field type is a spec a person builds and registers — as pin-map was.

## Medium

- [ ] **Icon picker paging loop.** **[fields-sdk]** `controls/icon.js`
  `fetchAllIconPages()` keeps asking while a page is "full", but
  `/wp/v2/icons` ignores `page`/`per_page` and returns everything each time —
  with 100+ icons it makes 49 identical requests and the field shows
  "Unknown icon" meanwhile. Stop on a repeated page / use `X-WP-TotalPages`.
  Lite now pages the endpoint itself (`KitBlocks::paginate_icons`); keep that
  even after the SDK fix, since core's endpoint is the bug.

- [ ] **Line icons through the registry.** `wp_register_icon` strips `stroke*`
  attributes and `<g>`, so stroke icons render as filled blobs (in the picker
  too). It keeps `class` on `<svg>` and `fill` on `<path>`. Let
  `gcblite_custom_icons` take `'style' => 'line'`, add a class, and ship the
  stroke CSS once (front, canvas and admin) so themes don't each reinvent it.

- [ ] **More inline-edit tags.** `INLINE_TAGS` (`src/utils/inline-fields.js`)
  skips `dt`, `dd`, `li`, `figcaption`, `blockquote`, `td`, `th` — the kit had to
  wrap fields in spans. Add them (check each against RichText's tagName).

- [ ] **`supports` must be `{}`** (AGENTS.md) — so no `align`, `anchor` or
  `className` for theme blocks, although generated mx blocks already use
  `align`. Decide which supports are safe and document them.

- [ ] **Hide a repeater's Add button.** Blocks whose children are created
  elsewhere (Touchpoint Zoom adds cards from its pin map) need the canvas Add
  button off. The kit hides `.gcb-replayout__add` with CSS. Add a marker
  attribute (e.g. `addButton="none"`), or have a `pin-map` field turn it off
  for the repeater it manages.

## Pin map / point follow-ups

- [ ] Pin-map popover can be clipped on short viewports — give the board a
  max-height with its own scroll, or open it in a Modal at a larger size.
- [ ] Pin-map: show each pin's card title on hover; keyboard way to add a pin.
- [ ] `PointControl` now uses GCB's own zoomable picker instead of core's
  `FocalPointPicker` for **every** point field — check the hotspots blocks on
  gcb-test still behave.
- [ ] `HotspotsControl` (pins in the field) and `pin-map` (pins as child blocks)
  overlap — decide whether Hotspots stays, and say which to use when in AGENTS.md.

## Process

- [ ] Pre-1.0 changes routinely span fields-sdk → lite → theme, with an npm
  release in the middle. A single changelog (or release notes per version
  across the repos) would make a cross-repo fix traceable.

## Landed 2026-10-07 on `shared-components` (b15c830, e60b094, 9089397) — needs review

Built during the Showman's Show work, tested in the editor and on the page
(JS 141 / PHP unit 186 passing).

- `pin-map` field — `src/controls/PinMapControl.jsx`, `src/controls/pin-map-value.js`,
  `schemas/controls/pin-map.md`, `tests/js/pin-map.test.js`; registered in
  `src/index.js`; typed in `BlockLoader::OBJECT_CONTROLS` and
  `BlockGcbValidator`; styles in `src/editor.scss`. Single and grouped
  (`pointsKey`) modes; the "Adding to 06 ×" mode pill.
- `PointControl.jsx` — own picker with zoom (1–6×), small blue pin.
- Repeater rows edited in place — `data-gcb-row` / `data-gcb-subfield`
  (`src/utils/inline-fields.js`, `src/utils/parse-preview.js`,
  `src/hooks/usePHPPreview.js`, `tests/js/inline-rows.test.js`, AGENTS.md).
- `KitBlocks::paginate_icons` — pages `/wp/v2/icons`.
