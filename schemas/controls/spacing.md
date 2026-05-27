---
type: spacing
title: spacing
section: Field reference
order: 21
description: Preset spacing scale (None / S / M / L) with a custom-value escape hatch. Stores either a preset key or a CSS length string.
stored: 'string — one of `"none" | "small" | "medium" | "large"`, OR a CSS length like `"2rem"` when the custom escape hatch is used.'
supports:
  - 'Toggle-group of presets (defaults: None / S / M / L)'
  - Custom CSS-length input with validation
  - Configurable preset list
configOptions:
  - name: presets
    type: "{ value, label }[]"
    default: '[{ value: "none", label: "None" }, { value: "small", label: "S" }, { value: "medium", label: "M" }, { value: "large", label: "L" }]'
    description: Override the preset toggle group.
gotchas:
  - 'Stored value is EITHER a preset key (`"medium"`) OR a CSS length (`"2rem"`). The renderer must map preset keys to your spacing scale before applying.'
  - 'Custom values must match `^(\d*\.?\d+)(px|rem|em|%|vw|vh|vmin|vmax)?$` — invalid input is rejected with an inline warning.'
example: |
  { "id": "ctrl_gap",
    "type": "spacing",
    "label": "Section gap",
    "attributeKey": "gap",
    "default": "medium",
    "parentPanelId": "panel" }
---
