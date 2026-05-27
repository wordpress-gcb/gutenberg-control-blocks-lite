---
type: select
title: select
section: Field reference
order: 11
description: Dropdown single-select. Supports plain options, legacy `map` configs, and `tokenGroup` binding to theme.json tokens.
stored: 'string for plain options OR a full token object (`{ key, slug, value, cssVar }`) when bound to a `tokenGroup`'
supports:
  - Plain `{ value, label }` option lists
  - 'Legacy `map` configs (key/value pairs that map keys to richer values)'
  - '`tokenGroup` binding — options come from a theme.json token group'
  - 'Optional `tokenKeys` filter to narrow a token group to specific keys'
  - 'Auto-prepended placeholder option when no `defaultOptionKey` is set'
configOptions:
  - name: options
    type: "{ value, label }[]"
    description: The choices for plain-list mode.
  - name: map
    type: 'object | array'
    description: Legacy form. Key/value pairs mapping option keys to richer values.
  - name: tokenGroup
    type: string
    description: Bind to a theme.json token group (e.g. `"color"`, `"font-size"`). Stored value becomes the full token object.
  - name: tokenKeys
    type: string[]
    description: 'When `tokenGroup` is set, restrict to these token keys only.'
  - name: defaultOptionKey
    type: string
    description: Initial value if the field is empty.
  - name: placeholder
    type: string
    description: Label for the auto-prepended empty option.
gotchas:
  - 'Stored shape depends on config: plain options store the string value, `tokenGroup` stores `{ key, slug, value, cssVar }`. Branch on type when reading.'
  - 'For multi-select use `checkbox-group` (vertical) or `button-group` (horizontal).'
example: |
  { "id": "ctrl_size",
    "type": "select",
    "label": "Size",
    "attributeKey": "size",
    "default": "m",
    "options": [
      { "value": "s", "label": "Small" },
      { "value": "m", "label": "Medium" },
      { "value": "l", "label": "Large" }
    ],
    "parentPanelId": "panel" }
---
