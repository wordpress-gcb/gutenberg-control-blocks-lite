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

Any field whose value is a *choice from a set* can be driven by tokens:

- `color` — pick from the palette
- `select`, `radio`, `button-group`, `toggle-group` — options come from a token group
- `spacing`, `size` — pick from the spacing scale

When you build one of these fields, choose **Use design tokens** as its source.
You then see the theme's tokens as a checklist:

```
Colour  →  source: Theme colours
   ☑ Primary    #5956E9
   ☑ Accent     #FFDC60
   ☐ Blue shade #6865FF      ← unchecked: not offered on this field
   ☑ Link       #2522BA
   [ + Add custom… ]
```

- **All tokens are checked by default** — uncheck the ones you don't want this
  field to offer.
- The field's options are the **checked** tokens (plus any custom you add).
- Turn the source off to set plain options by hand instead.

### What gets stored

A tokenised field stores a small **config**, not a frozen copy of the options:

```json
{
  "type": "color",
  "attributeKey": "accentColor",
  "tokens": {
    "source": "color:palette",
    "included": ["primary", "accent", "link"],
    "custom": [{ "slug": "brand-pink", "value": "#ff3399", "label": "Brand Pink" }]
  }
}
```

Because it stores *which* tokens (by slug), not their resolved values, the field
stays live: edit a colour in `theme.json` and the field reflects it without any
change to `block.fields.json`.

## Adding a custom token

If you need a value that isn't in the theme yet, **Add custom…** lets you add it
inline. GCB asks how far it should go:

- **One-off on this field** — the custom value is stored on this field's `tokens.custom`
  only. `theme.json` is untouched. Safe, reversible, no file write.
- **Add to my theme** — GCB writes the token into the active theme's
  `theme.json` under `settings.custom.{group}`, so it's reusable in **every** block.

The "add to my theme" path mutates a theme file, so it's deliberately careful:

- It needs the `edit_themes` capability — the same permission that gates the
  built-in theme file editor.
- It only ever writes to `settings.custom.{group}` — it never rewrites your
  `color.palette` or `typography.fontSizes`, and it merges into the existing JSON
  rather than replacing the file.
- The slug and value are validated (`^[a-z][a-z0-9-]*$`, non-empty).
- If `theme.json` is missing or not writable (or `DISALLOW_FILE_EDIT` /
  `GCBLITE_BUILDER_DISABLE_WRITES` is set), GCB declines the write and falls back
  to a one-off, telling you why.

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
