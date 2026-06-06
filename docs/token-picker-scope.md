# Token Picker — Scope (draft)

Status: **scoping** — making GCB Lite use the theme's design tokens correctly
when you build a field.

## The problem

A field that takes a value (a colour, a spacing, a heading style, a set of
choices) should let the builder **pick from the theme's real tokens**, not type
raw values. Today GCB has the *plumbing* (a `TokenParser`, a `useTokens` hook,
token references in fields) but two gaps:

1. **It doesn't read the tokens that matter most.** `TokenParser` reads
   `settings.custom.*` and `settings.spacing.spacingSizes` — but **not**
   `settings.color.palette` or `settings.typography.fontSizes`. So the two things
   the user explicitly wants (colours, heading/type styles) aren't surfaced.
2. **The picker is all-or-nothing.** The old `TokenSelector` (and the current
   model) makes a field's options = *one whole token group*. You can't uncheck
   the tokens you don't want, and you can't add a custom one.

## The goal (better than the old version)

When building a tokenable field, the builder gets a **per-token checklist**:

```
Colour field → token source: [ Theme colours ▾ ]
  ☑ Primary    #5956E9
  ☑ Accent-1   #FFDC60
  ☐ Blue-shade #6865FF      ← unchecked, won't be offered
  ☑ Link       #2522BA
  [ + Add custom… ]
```

- Reads the theme's **actual** palette / font-sizes / spacing.
- **All tokens checked by default**; uncheck the ones you don't want.
- **Add custom** inline. If the value isn't in the theme's tokens:
  *"`brand-pink` isn't in your theme tokens. Add it as a one-off on this field,
  or add it to your theme so it's reusable everywhere?"*
- The field's options come from the **checked** tokens (+ any custom).

## Decisions

### Which fields get a token source
The **tokenable** fields — any whose value is a choice from a set:
`color`, `spacing`, `size`, `select`, `radio`, `button-group`, `toggle-group`.
Each gains an optional **"use design tokens"** source. When on, its options are
driven by the checked tokens; when off, the author sets options manually (today's
behaviour). Token *type* is matched to the field where it's obvious (color field
→ colour tokens) and chosen otherwise (select → pick colour / type / spacing).

### Custom tokens — one-off OR write to theme.json
When the author adds a custom token not in `theme.json`:
- **One-off** — stored on this field's options only; `theme.json` untouched. Safe
  default, no file write.
- **Add to theme** — GCB writes the token into the active theme's `theme.json`
  `settings.custom.*` (or the right section) so it's reusable in every block.
  This **mutates a theme file**, so it carries guardrails like the render.php path:
  - requires `edit_theme_options` / write access to the theme dir;
  - writes only to `settings.custom` (never touches `color.palette` core shape
    unless explicitly chosen) — append/merge, never rewrite the file wholesale;
  - validates the slug (`^[a-z][a-z0-9-]*$`) and value before writing;
  - confirms with the author before the write (no silent file mutation).
  If the theme's `theme.json` isn't writable, fall back to one-off and say so.

## What to build

1. **PHP — extend `TokenParser`** to also read:
   - `settings.color.palette` (theme/default origins) → `color` group with
     `value` = hex and `cssVar` = `var(--wp--preset--color--{slug})`.
   - `settings.typography.fontSizes` → `typography.fontSize` group with
     `cssVar` = `var(--wp--preset--font-size--{slug})`.
   Keep the existing `custom` + `spacing` output; merge the new groups in.
2. **PHP — a token-write endpoint** (`POST /gcblite/v1/tokens/custom`): append a
   custom token to the theme's `theme.json` `settings.custom.{category}`, guarded
   as above. Returns the updated token so the builder can refresh.
3. **JS — `TokenPicker` component** (the better TokenSelector): token-type select
   → checklist of the theme's tokens (checked by default, with colour swatches /
   size previews) → "add custom" with the one-off vs add-to-theme prompt. Emits
   the chosen token list as the field's options/config.
4. **Wire it into the field builder** for the tokenable field types, behind a
   "use design tokens" toggle, replacing/augmenting the old group-picker.

## Reuses (don't rebuild)

- `GCBLite\Tokens\TokenParser` — extend, don't replace.
- `@wordpress-gcb/fields` `useTokens` / `token-helper` — the merge + path model.
- The old `TokenSelector.js` (control-blocks-website) — reference for the combobox
  + preview; we replace its all-or-nothing model with the checklist.
- `wp_get_global_settings()` — the source of truth for theme tokens.

## Open questions

1. **Storage shape on the field** — does a tokenised field store the resolved
   options array, or a `{ source, tokenType, included[], custom[] }` config the
   runtime expands? Lean: store a config so re-reading the theme stays live.
2. **theme.json write target** — `settings.custom.{category}` for everything, or
   write colours into `color.palette` / sizes into `typography.fontSizes` so they
   show in core pickers too? Lean: `settings.custom` for v1 (simplest, reversible).
3. **Child-theme vs parent** — write to the active (child) theme's `theme.json`.
