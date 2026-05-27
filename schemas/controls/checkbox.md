---
type: checkbox
title: checkbox-group
section: Field reference
order: 7
aliases:
  - checkbox-group
description: Multi-select control. Alias `button-group` renders the same control with different visual styling. Use when authors need to pick zero or more options from a fixed list.
stored: array of strings — the selected option `value`s
supports:
  - Multi-select from a fixed list of options
  - Two visual styles via the alias `button-group` (same stored shape)
  - Default selection via `default` array
configOptions:
  - name: options
    type: "{ value, label }[]"
    description: The choices. Required.
  - name: default
    type: string[]
    description: Pre-selected values. Empty array if omitted.
gotchas:
  - 'For single-select use `toggle-group`. The controls are picked by the SHAPE of the saved value: array of strings (multi) vs single string (single).'
example: |
  { "id": "ctrl_categories",
    "type": "checkbox-group",
    "label": "Show categories",
    "attributeKey": "categories",
    "default": ["design"],
    "options": [
      { "value": "design",      "label": "Design" },
      { "value": "engineering", "label": "Engineering" },
      { "value": "product",     "label": "Product" }
    ],
    "parentPanelId": "panel" }
---

## Consume

:::codetabs
```jsx
export default function Filters({ attributes }) {
  const cats = Array.isArray(attributes.categories) ? attributes.categories : [];
  return (
    <ul>
      {cats.map((c) => <li key={c}>{c}</li>)}
    </ul>
  );
}
```
```php
<?php
$cats = is_array($attributes['categories'] ?? null) ? $attributes['categories'] : [];
?>
<ul>
  <?php foreach ($cats as $c): ?>
    <li><?php echo esc_html($c); ?></li>
  <?php endforeach; ?>
</ul>
```
:::
