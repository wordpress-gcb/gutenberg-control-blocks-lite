---
type: embed
title: embed
section: Field reference
order: 42
description: 'A third-party widget — the snippet a provider gives you (Trustpilot, Calendly, Typeform, Elfsight…), pasted as it is. The render prints its markup and loads its `<script src>` when the host of that script is a known widget provider; any other script, inline code and HTML comments are dropped.'
stored: string — the provider's snippet, markup and script tags as pasted
supports:
  - 'Monospace textarea the snippet is pasted into'
  - 'A `<script src>` from a known widget host (the `gcblite_embed_hosts` filter) is enqueued in the footer once per page, its async / defer kept'
  - 'The markup passes wp_kses: div, span, a, p, iframe (https only), img and blockquote, with class, id, style, href, src, sizes, title and any data-* attribute'
configOptions:
  - name: rows
    type: number
    default: 8
    description: Height of the textarea, in rows.
  - name: helpText
    type: string
    description: One-line description shown below the input. Defaults to a line on what to paste.
gotchas:
  - 'Inline `<script>` code never runs, and neither does a script from a host off the list — add a provider through the `gcblite_embed_hosts` filter.'
  - 'Render it with `gcblite_embed($attributes["key"] ?? null, $fallback)` (gcb-lite includes/Render/embed.php), never by echoing the value.'
  - The widget draws itself in the browser; the block editor's preview shows its markup only.
example: |
  { "id": "ctrl_reviews",
    "type": "embed",
    "label": "Trustpilot widget",
    "attributeKey": "reviews",
    "parentPanelId": "panel" }
---

## Consume

:::codetabs
```php
<?php
// render.php — the snippet's markup, its provider's script enqueued once
echo gcblite_embed($attributes['reviews'] ?? null);
```
:::
