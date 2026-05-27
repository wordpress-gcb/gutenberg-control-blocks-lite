---
type: date
title: date
section: Field reference
order: 30
description: Date picker. Author clicks a button to open a calendar popover (or modal in metabox contexts). Stores a date-only ISO string.
stored: 'string — ISO date like "2026-05-28", or empty string when cleared.'
supports:
  - Calendar popover with Clear button
  - Works in both sidebar (popover) and metabox (modal) variants
configOptions:
  - name: helpText
    type: string
    description: One-line description shown below the picker.
gotchas:
  - 'No min/max date config — if you need bounded dates, enforce in your render code or filter saved values server-side.'
example: |
  { "id": "ctrl_publish_at",
    "type": "date",
    "label": "Publish date",
    "attributeKey": "publish_at",
    "parentPanelId": "panel" }
---
