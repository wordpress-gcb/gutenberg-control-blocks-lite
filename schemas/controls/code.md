---
type: code
title: code
section: Field reference
order: 2
description: Monospace textarea for code snippets. Same stored shape as `textarea` (plain string) but rendered with a fixed-width font for readability.
stored: string
supports:
  - Plain string values, no syntax highlighting
  - Configurable height via `rows`
configOptions:
  - name: rows
    type: number
    default: 8
    description: Height of the textarea, in rows.
  - name: placeholder
    type: string
    description: Greyed-out hint shown when the input is empty.
  - name: helpText
    type: string
    description: One-line description shown below the input.
gotchas:
  - No syntax highlighting or auto-indent — a future version may swap in CodeMirror, but for now it's a styled textarea.
  - 'Server-side: never echo the value as HTML without escaping. For executable snippets you control, render inside `<pre><code>` after `esc_html()`.'
example: |
  { "id": "ctrl_embed",
    "type": "code",
    "label": "Embed snippet",
    "attributeKey": "embed",
    "rows": 6,
    "parentPanelId": "panel" }
---
