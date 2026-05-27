---
type: size
title: size
section: Field reference
order: 22
description: CSS length input with a unit dropdown (px, em, rem, %, vh, vw). Stores a single CSS-ready string you can drop straight into `style`.
stored: 'string — a CSS length like `"16px"`, `"1.5rem"`, `"100%"`. Empty string when unset.'
supports:
  - 'Numeric input + unit selector via WP''s `UnitControl`'
  - 'Supported units: px, em, rem, %, vh, vw'
  - Plain-text fallback when `UnitControl` isn't available
configOptions:
  - name: helpText
    type: string
    description: One-line description shown below the input.
gotchas:
  - 'Stored value is a CSS string, not a number — pass it directly to `style.width` / `style.padding` in React, or echo it inside a `style` attribute in PHP.'
  - 'For spacing-scale presets (None / S / M / L) use `spacing` instead — `size` is for free-form CSS lengths.'
example: |
  { "id": "ctrl_width",
    "type": "size",
    "label": "Container width",
    "attributeKey": "container_width",
    "default": "960px",
    "parentPanelId": "panel" }
---
