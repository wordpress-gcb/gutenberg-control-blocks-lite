---
slug: blocks/tokens
title: Design tokens
section: Blocks
order: 5
---

GCB reads your theme's **design tokens** — the colours, font sizes and spacing
defined in `theme.json` — so a field can offer *your* design system as its
choices instead of free-typed values. Pick a brand colour, a heading size, a
spacing step from a list that always reflects the active theme.

## Where tokens come from

Everything is sourced from the active theme's `theme.json`, via WordPress's own
[`theme.json` settings](https://developer.wordpress.org/block-editor/reference-guides/theme-json-reference/theme-json-living/).
GCB surfaces three preset types plus your custom tokens:

| Token type     | theme.json source                  | CSS variable                              |
| -------------- | ---------------------------------- | ----------------------------------------- |
| **Colours**    | `settings.color.palette`           | `var(--wp--preset--color--{slug})`        |
| **Typography** | `settings.typography.fontSizes`    | `var(--wp--preset--font-size--{slug})`    |
| **Spacing**    | `settings.spacing.spacingSizes`    | `var(--wp--preset--spacing--{slug})`      |
| **Custom**     | `settings.custom.{group}`          | `var(--wp--custom--{group}--{name})`      |

Because GCB references the **CSS variable**, not a baked-in value, a field that
uses `primary` keeps tracking the theme — change `primary` in `theme.json` and
every block that used it updates. No re-saving blocks.

> These are WordPress's native preset variables. GCB doesn't invent a parallel
> system — it reads the same `theme.json` the editor's own colour and typography
> controls read, so your block fields and core blocks stay in lockstep.

## Tokenable fields

Two kinds of field can be driven by tokens, and they surface the picker slightly
differently:

**Single-value fields — `color`, `spacing`, `size`.**
These show a **Design tokens** section automatically in the field builder (no
toggle to find). The picker is scoped to the right token type — a colour field
only offers colours, a spacing field only offers spacing:

```
Design tokens
  Which of your theme tokens should this field offer?
  (All by default — uncheck to narrow.)

  ☑ Primary      primary    ●   ○
  ☑ Accent 1     accent-1   ●   ○ ← default
  ☐ Blue shade   blue-shade ●   ○   (unchecked: not offered)
  Offering 2 of 8 tokens.            ○ = default

  Custom colours (not in your theme)
  [🎨] [ #ff3399 ]  [ Add ]
```

- **All tokens are checked by default** — uncheck the ones this field shouldn't offer.
- The **○ radio** on each row marks that token the field's **default**.
- Colour fields also take **custom (non-token) colours** — see below.

**Choice fields — `select`, `radio`, `button-group`, `toggle-group`.**
On the field's `options` row you get a **Manual | From design tokens** toggle.
Switch to *From design tokens* to pick a token group and check which tokens
become the field's options.

### What gets stored

A tokenised field stores a small **config** (flat props on the control), not a
frozen copy of resolved values:

```json
{
  "type": "color",
  "attributeKey": "accentColor",
  "tokenGroup": "color:palette",
  "tokenKeys": ["primary", "accent-1", "link"],
  "tokenCustom": ["#ff3399"],
  "default": "accent-1"
}
```

- `tokenGroup` — which token group the field draws from (e.g. `color:palette`,
  `spacing:presets`). Empty `tokenKeys` means "offer the whole group".
- `tokenKeys` — the **checked** token slugs.
- `tokenCustom` — any non-token values added directly (colour fields).
- `default` — the token slug (or custom value) marked with the ○ radio.

Because it stores *which* tokens (by slug), not their resolved values, the field
stays live: edit a colour in `theme.json` and the field reflects it without any
change to `block.fields.json`.

## Custom colours (not in the theme)

A colour field isn't locked to theme tokens. Under the checklist there's a
**Custom colours** box — pick a colour (native colour picker) or type a value
(`#ff3399`, `rgb(...)`) and **Add**. Custom colours appear alongside the theme
tokens, can be set as the default (the ○ radio), and removed. They're stored in
`tokenCustom` on the field and aren't written to `theme.json`.

## Adding a token to your theme

If you want a value reusable across **every** block (not just one field), add it
to the theme. GCB can write a custom token into the active theme's `theme.json`
under `settings.custom.{group}` via the builder's token API
(`POST /gcblite/v1/builder/tokens/custom`).

Because that mutates a theme file, it's deliberately careful:

- It needs the `edit_themes` capability — the same permission that gates the
  built-in theme file editor.
- It only ever writes to `settings.custom.{group}` — it never rewrites your
  `color.palette` or `typography.fontSizes`, and it merges into the existing JSON
  rather than replacing the file (written atomically via a temp file + rename).
- The slug and value are validated (`^[a-z][a-z0-9-]*$`, non-empty).
- If `theme.json` is missing or not writable (or `DISALLOW_FILE_EDIT` /
  `GCBLITE_BUILDER_DISABLE_WRITES` is set), GCB declines the write and reports
  why, so you can fall back to a per-field custom value instead.

A token added this way becomes `var(--wp--custom--{group}--{name})` and shows up
in the picker from then on, alongside the theme's own tokens.

## Using a token in your markup

Tokens resolve to CSS variables, so you use them the way you'd use any custom
property — there's nothing GCB-specific on the render side:

```php
<div
  class="gcb-cta"
  style="--cta-bg: <?php echo esc_attr( $attributes['accentColor'] ); ?>;"
>
  …
</div>
```

If the stored attribute is a token slug (e.g. `primary`), map it to the variable
in your template — `var(--wp--preset--color--<?php echo esc_attr( $slug ); ?>)`
— or store the resolved `var(--wp--preset--color--…)` string directly, depending
on how you set the field up. See [Blocks & attributes](/docs/blocks) for how
attribute values reach `render.php`.

> **Why CSS variables and not hard-coded values?** It keeps your blocks themeable.
> The same block dropped into a different theme picks up that theme's `primary`,
> `large`, `section` — because the value lives in `theme.json`, not in the block.
