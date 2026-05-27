---
type: text
title: text & textarea
section: Field reference
order: 1
aliases:
  - textarea
description: The simplest controls. Single-line input (`text`) or multi-line (`textarea`). Both store a single string.
stored: string
supports:
  - Plain string values, no formatting
  - Validation rules (required, minLength, maxLength, pattern)
  - Placeholder text and inline help
configOptions:
  - name: default
    type: string
    description: Initial value if the author hasn't edited the field.
  - name: placeholder
    type: string
    description: Greyed-out hint shown when the input is empty.
  - name: helpText
    type: string
    description: One-line description shown below the input.
  - name: validation.required
    type: boolean
    description: Block save until the field is filled in.
  - name: validation.minLength
    type: number
    description: Minimum character count.
  - name: validation.maxLength
    type: number
    description: Maximum character count. Shown as "X / Y" counter in the editor.
  - name: validation.pattern
    type: string (regex)
    description: Regex the value must match. Enforced client- and server-side.
example: |
  { "id": "ctrl_eyebrow",
    "type": "text",
    "label": "Eyebrow",
    "attributeKey": "eyebrow",
    "default": "",
    "placeholder": "e.g. New in beta",
    "validation": { "maxLength": 60 },
    "parentPanelId": "panel" }
---

## Consume

:::codetabs
```jsx
export default function MyBlock({ attributes }) {
  const { eyebrow = '' } = attributes;
  return eyebrow ? <span className="eyebrow">{eyebrow}</span> : null;
}
```
```php
<?php
$eyebrow = $attributes['eyebrow'] ?? '';
if ($eyebrow): ?>
  <span class="eyebrow"><?php echo esc_html($eyebrow); ?></span>
<?php endif; ?>
```
:::
