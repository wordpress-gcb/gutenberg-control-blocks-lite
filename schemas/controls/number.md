---
type: number
title: number
section: Field reference
order: 10
description: Numeric input with up/down spinners. Stores a number (not a string), with optional min, max, step and decimals (the precision it prints with).
stored: number
supports:
  - Min / max bounds and step increments
  - 'Coerces empty input to `0` so consumers always see a number'
configOptions:
  - name: min
    type: number
    description: Minimum allowed value.
  - name: max
    type: number
    description: Maximum allowed value.
  - name: step
    type: number
    default: 1
    description: Increment for the spinner / arrow keys.
  - name: decimals
    type: integer
    description: 'The precision the field prints with, as a count of decimals read off the sample in the design ("5.0" is 1, "4.95" is 2, "14,395" is 0). The render passes it to gcblite_number(); without it a value prints with the decimals it was stored with, and a default stored as a number prints "5", not "5.0".'
  - name: placeholder
    type: string
    description: Greyed-out hint shown when the input is empty.
gotchas:
  - 'Empty input becomes `0`, not `null` or empty string. If you need "unset" semantics, pair with a boolean toggle.'
  - 'Min/max are advisory — bound-checks happen via the underlying control but not enforced server-side. Validate again on save if it matters.'
example: |
  { "id": "ctrl_columns",
    "type": "number",
    "label": "Columns",
    "attributeKey": "columns",
    "default": 3,
    "min": 1,
    "max": 6,
    "parentPanelId": "panel" }
  { "id": "ctrl_rating",
    "type": "number",
    "label": "Rating",
    "attributeKey": "rating",
    "default": 5.0,
    "decimals": 1,
    "step": 0.1 }
---
