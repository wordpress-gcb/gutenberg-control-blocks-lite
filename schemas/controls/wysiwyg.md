---
type: wysiwyg
title: wysiwyg
section: Field reference
order: 4
description: 'Backwards-compat alias for `richtext`. Same Tiptap-backed editor, same stored HTML shape. Kept so existing fields configs using `"type": "wysiwyg"` continue to work; new fields should use `richtext`.'
stored: 'string — HTML, same as `richtext`'
supports:
  - 'All `richtext` features (bold, italic, lists, links, image insert, headings, three display modes)'
configOptions:
  - name: headingLevels
    type: number[]
    default: '[2, 3, 4]'
    description: Which heading levels appear in the block-type select.
  - name: allowImages
    type: boolean
    default: true
    description: Show the insert-image toolbar button.
  - name: display
    type: 'string — "inline" | "popover" | "modal"'
    description: Force a specific display mode.
gotchas:
  - 'Historically backed by TinyMCE/`wp_editor()`. Now a thin alias for `richtext` — Tiptap renders both. Stored HTML round-trips cleanly, so the rename is transparent.'
  - 'For new fields prefer `richtext` — `wysiwyg` exists for back-compat only.'
example: |
  { "id": "ctrl_body",
    "type": "wysiwyg",
    "label": "Body",
    "attributeKey": "body",
    "parentPanelId": "panel" }
---
