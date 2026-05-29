---
type: message
title: message
section: Field reference
order: 40
description: Display-only Inspector note. Renders a coloured panel with a static message. Has no input, no stored value — purely informational. Pairs naturally with conditionalLogic for context-sensitive warnings, hints, and confirmations.
stored: 'n/a — `message` has no saved value. Leave `attributeKey` off, or expect it never to be written.'
supports:
  - Five variants (neutral / info / warning / danger / success), each with its own colour palette and glyph
  - Conditional display via conditionalLogic — show a warning when another field is empty, a success when it has a valid value, etc.
  - Optional label heading above the message panel
configOptions:
  - name: message
    type: string
    description: The body text shown in the message panel. Preferred over `helpText`.
  - name: helpText
    type: string
    description: Fallback body text when `message` is not set.
  - name: label
    type: string
    description: Optional heading shown above the message panel.
  - name: variant
    type: 'string ("neutral" | "info" | "warning" | "danger" | "success")'
    description: Visual treatment of the panel. Defaults to "neutral" (grey). Use `warning` (amber) for "be careful," `danger` (red) for "this won't work," `success` (green) for "looks good," `info` (blue) for tips.
gotchas:
  - 'Not interactive — pairs well with `conditionalLogic` to display contextual hints (e.g. "Heads up: source is set to manual — pick posts below.").'
  - Use the `danger` variant sparingly. If a field's value is actually invalid, prefer the field's own `validation` rules (which block save). A `danger` message is for guidance, not enforcement.
example: |
  { "id": "ctrl_warning",
    "type": "message",
    "variant": "warning",
    "label": "Heads up",
    "message": "This image is over 2 MB — consider compressing it.",
    "conditionalLogic": {
      "field": "image_size_kb",
      "operator": ">",
      "value": 2048
    },
    "parentPanelId": "panel" }
---
