---
type: range
title: range
section: Field reference
order: 14
description: Slider control for numeric or token-bound values. Supports raw numeric ranges, legacy `map` configs, and binding to a theme.json token group.
stored: 'number (raw range) OR the token object (`{ key, slug, value, cssVar }`) when bound to a `tokenGroup`'
supports:
  - Raw numeric range with min / max / step
  - 'Legacy `map` config — key/value pairs become labelled tick marks'
  - '`tokenGroup` binding — slider snaps between theme.json tokens (spacing scale, font sizes, etc.)'
  - Allow-reset behaviour with a fallback value
configOptions:
  - name: min
    type: number
    default: 0
    description: Minimum value (ignored when `tokenGroup` is set).
  - name: max
    type: number
    default: 100
    description: Maximum value (ignored when `tokenGroup` is set).
  - name: step
    type: number
    default: 1
    description: Slider increment (ignored when `tokenGroup` is set).
  - name: map
    type: 'object | array'
    description: 'Legacy form. Key/value pairs that produce labelled tick marks. Stored value is the token, not the key.'
  - name: tokenGroup
    type: string
    description: 'Bind to a theme.json token group (e.g. `"spacing"`). The slider snaps between tokens and stores the full token object.'
  - name: defaultOptionKey
    type: string
    description: 'When `map` or `tokenGroup` is set, the key to use as default if the saved value is empty.'
gotchas:
  - 'Stored shape depends on config: a raw range stores a number, a `tokenGroup` stores `{ key, slug, value, cssVar }`. Branch on type when reading.'
  - 'When `tokenGroup` is set the displayed min/max/step are derived from the tokens, not from `min`/`max`/`step` config keys.'
example: |
  { "id": "ctrl_columns",
    "type": "range",
    "label": "Columns",
    "attributeKey": "columns",
    "default": 3,
    "min": 1,
    "max": 6,
    "parentPanelId": "panel" }
---
