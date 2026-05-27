---
type: radio
title: radio
section: Field reference
order: 12
description: Single-select shown as a vertical list of radio buttons. Stores the chosen option's `value` as a string.
stored: string — the selected option `value`
supports:
  - Single-select from a fixed list of options
  - 'Coerces option values to strings — pick from `toggle-group` if you need a compact segmented look'
configOptions:
  - name: options
    type: "{ value, label }[]"
    description: The choices. Required.
  - name: default
    type: string
    description: Pre-selected value. Should match one of the option `value`s.
gotchas:
  - 'Option values are stringified before storage — `{ value: 1 }` becomes `"1"`. Compare with `String()` on the read side.'
  - 'For multi-select use `checkbox-group`. For a compact horizontal segmented control use `toggle-group`.'
example: |
  { "id": "ctrl_layout",
    "type": "radio",
    "label": "Layout",
    "attributeKey": "layout",
    "default": "stacked",
    "options": [
      { "value": "stacked", "label": "Stacked" },
      { "value": "side",    "label": "Side-by-side" }
    ],
    "parentPanelId": "panel" }
---
