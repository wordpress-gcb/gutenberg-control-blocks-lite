---
type: toggle
title: toggle / toggle-group
section: Field reference
order: 6
aliases:
  - toggle-group
description: Two related controls. `toggle` is an on/off switch storing a boolean. `toggle-group` is a single-select segmented control storing the chosen `value` as a string.
stored: 'boolean (`toggle`) or string (`toggle-group`)'
supports:
  - Simple on/off boolean via `toggle`
  - Single-select segmented control via `toggle-group`
  - Pairs naturally with `conditionalLogic` to gate other fields
configOptions:
  - name: options
    type: "{ value, label }[]"
    description: '`toggle-group` only. The choices shown as segments. Required for `toggle-group`.'
  - name: default
    type: boolean or string
    description: 'For `toggle` a boolean; for `toggle-group` the pre-selected `value` (should match one of the options or no segment will be active).'
gotchas:
  - 'For multi-select use `checkbox-group` (alias: `button-group`). The two are picked by the SHAPE of the saved value, not by visual style.'
example: |
  // toggle
  { "id": "ctrl_pinned",
    "type": "toggle",
    "label": "Pin to top",
    "attributeKey": "is_pinned",
    "default": false,
    "parentPanelId": "panel" }

  // toggle-group
  { "id": "ctrl_source",
    "type": "toggle-group",
    "label": "Source",
    "attributeKey": "source",
    "default": "latest",
    "options": [
      { "value": "latest", "label": "Latest" },
      { "value": "manual", "label": "Pick" }
    ],
    "parentPanelId": "panel" }
---

## Consume

:::codetabs
```jsx
export default function Collection({ attributes }) {
  const source = attributes.source === 'manual' ? 'manual' : 'latest';
  // ... branch on `source`
}
```
```php
<?php
$source = ($attributes['source'] ?? 'latest') === 'manual' ? 'manual' : 'latest';
// ... branch on $source
```
:::
