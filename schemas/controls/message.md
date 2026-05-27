---
type: message
title: message
section: Field reference
order: 40
description: Display-only Inspector note. Renders a small grey panel with a static message. Has no input, no stored value — purely informational.
stored: 'n/a — `message` has no saved value. Leave `attributeKey` off, or expect it never to be written.'
supports:
  - Static informational text in the Inspector
  - Optional label heading above the message panel
configOptions:
  - name: message
    type: string
    description: The body text shown in the grey panel. Preferred over `helpText`.
  - name: helpText
    type: string
    description: Fallback body text when `message` is not set.
  - name: label
    type: string
    description: Optional heading shown above the message panel.
gotchas:
  - 'Not interactive — pairs well with `conditionalLogic` to display contextual hints (e.g. "Heads up: source is set to manual — pick posts below.").'
example: |
  { "id": "ctrl_hint",
    "type": "message",
    "label": "Heads up",
    "message": "Empty galleries fall back to the post's featured image.",
    "parentPanelId": "panel" }
---
