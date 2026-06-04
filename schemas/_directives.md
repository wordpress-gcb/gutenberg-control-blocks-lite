# Doc directives

The `.md` files under `schemas/` are authored here and rendered by the docs
site (gutenbergcontrolblocks.com), which lives in a separate repo. This file
is the contract for the custom container directives those `.md` files use, so
the authoring side and the rendering side stay in sync. It is meta — not a
published page (hence the leading underscore).

Both directives use the [remark-directive] container syntax: a line of three
or more colons opens the block, a matching line of colons closes it.

[remark-directive]: https://github.com/remarkjs/remark-directive

---

## `:::codetabs` — language tabs for one example (existing)

Wraps a run of fenced code blocks and renders them as tabs. The **tab label is
the code fence's language** (`json` → "JSON", `php` → "PHP", `jsx` → "JSX").
Used for "the same thing in different languages" — e.g. a field declared in
JSON next to the PHP that reads it.

````markdown
:::codetabs
```json
{ "attributeKey": "name" }
```
```php
<?php echo esc_html($attributes['name']); ?>
```
:::
````

Rules:
- Children are fenced code blocks only. The first fence is the default tab.
- Two fences of the same language in one `:::codetabs` is ambiguous — don't.
  (This is the limitation that motivated `:::paths` below.)

---

## `:::paths` — choose-your-stack tabs for whole sections (new)

A higher-level chooser. Where `codetabs` switches one code block between
languages, `paths` switches an **entire walkthrough** — prose, several files,
and explanation — between the two ways a developer can build a GCB block:
rendering in PHP, or rendering in their own JS frontend.

The reader picks the stack that matches them and sees only what's relevant.

### Syntax

- `:::paths` opens; a matching `:::` closes.
- Inside, each tab begins with a header line: `== Label ==` (two or more `=`,
  surrounding whitespace trimmed, the text between is the tab label verbatim).
- Everything from one `==` header until the next `==` header (or the closing
  `:::`) is that tab's body. The body is **full markdown** — headings, prose,
  multiple fenced code blocks, callouts, links — rendered normally.
- The first tab is selected by default.

````markdown
:::paths
== I'm building in PHP ==

Everything lives in your WordPress theme.

```json
{ "render": "file:./render.php" }
```

```php
<?php echo esc_html($attributes['heading']); ?>
```

== I'm building my frontend in JS ==

The markup is produced by your own frontend.

```jsx
export default function Hero({ attributes }) { /* ... */ }
```
:::
````

### Rendering

- Render as a tab group: a row of buttons (one per `== Label ==`, label text
  used as-is) above a panel showing the active tab's rendered body.
- Use the label text as the tab's identity. The current docs use exactly two:
  `I'm building in PHP` and `I'm building my frontend in JS`. Don't hardcode
  those two — render whatever labels are present, in document order — but the
  styling should comfortably fit a short sentence, not just one word.
- **Persist + sync the choice.** A reader who picks "I'm building in JS" on one
  page should land on the JS tab on the next page too. Key the selection on the
  label text, store it (e.g. `localStorage`), and apply it to every `:::paths`
  group on load. This is the whole point of the directive — the choice is about
  *the reader*, not *this one example*.
- If only one tab is present, render the body with no tab chrome.

### Accessibility

Standard tabs pattern: `role="tablist"` / `role="tab"` / `role="tabpanel"`,
arrow-key navigation between tabs, `aria-selected` on the active tab. Each tab
button controls its panel via `aria-controls` / `id`.

### Authoring notes

- Keep the two tabs **parallel** — same files in the same order, so a reader
  switching tabs sees what changed (e.g. `block.json` gains/loses its `render`
  line; `render.php` becomes a component). The point the docs make is "same
  contract, different place," and parallel structure is what shows it.
- `block.fields.json` is identical across both tabs by design. Show it in full
  in each anyway — a reader only ever sees one tab, so "same as the other tab"
  would be a dangling reference.
