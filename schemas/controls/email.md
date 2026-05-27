---
type: email
title: email
section: Field reference
order: 8
description: Single-line input with `type="email"` so mobile keyboards show the @-key and browsers do basic validation. Stores a plain string.
stored: string
supports:
  - 'HTML5 email keyboard / browser validation via `type="email"`'
  - Default placeholder of "name@example.com" if none provided
configOptions:
  - name: placeholder
    type: string
    default: name@example.com
    description: Greyed-out hint shown when the input is empty.
  - name: helpText
    type: string
    description: One-line description shown below the input.
gotchas:
  - 'Browser-level validation is light. For stricter checks pair with `validation.pattern` or sanitise server-side with `sanitize_email()`.'
example: |
  { "id": "ctrl_contact",
    "type": "email",
    "label": "Contact email",
    "attributeKey": "contact",
    "parentPanelId": "panel" }
---
