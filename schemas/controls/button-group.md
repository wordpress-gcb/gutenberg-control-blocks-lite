---
type: button-group
title: button-group
section: Field reference
order: 13
description: Multi-select shown as a row of pressable buttons. Same stored shape as `checkbox-group` — only the visual affordance differs (buttons-in-a-row vs checkboxes-in-a-column).
stored: array of strings — the selected option `value`s
supports:
  - Multi-select from a fixed list of options
  - Horizontal, compact visual style
  - Default selection via `default` array
configOptions:
  - name: options
    type: "{ value, label }[]"
    description: The choices. Required.
  - name: default
    type: string[]
    description: Pre-selected values. Empty array if omitted.
gotchas:
  - 'Not single-select. For a segmented single-choice control use `toggle-group` — `button-group` stores an ARRAY of values.'
example: |
  { "id": "ctrl_sizes",
    "type": "button-group",
    "label": "Sizes",
    "attributeKey": "sizes",
    "default": ["m"],
    "options": [
      { "value": "s", "label": "S" },
      { "value": "m", "label": "M" },
      { "value": "l", "label": "L" }
    ],
    "parentPanelId": "panel" }
---
