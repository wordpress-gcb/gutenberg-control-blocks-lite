---
type: datetime
title: datetime
section: Field reference
order: 31
description: Date + time picker. Like `date`, but the popover also includes hour/minute selectors. Stores an ISO 8601 timestamp.
stored: 'string — ISO 8601 like "2026-05-28T14:30:00", or empty string when cleared.'
supports:
  - 12-hour time picker alongside the calendar
  - Clear button to reset to empty
configOptions:
  - name: helpText
    type: string
    description: One-line description shown below the picker.
gotchas:
  - 'Stored as a local ISO string with no timezone suffix. Treat as the author''s local time unless you explicitly convert on the server.'
example: |
  { "id": "ctrl_event_at",
    "type": "datetime",
    "label": "Event start",
    "attributeKey": "event_at",
    "parentPanelId": "panel" }
---
