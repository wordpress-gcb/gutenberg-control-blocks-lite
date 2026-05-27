---
type: heading
title: heading-level
section: Field reference
order: 5
description: A compound control — a text input for the heading text plus a dropdown that picks the heading level (h1..h6, p, div, span). Stores both together as a single attribute.
stored: '{ text: string, level: string } — text and chosen tag in one object'
supports:
  - Editable heading text + semantic level in a single field
  - Restrict the level whitelist via `levels`
  - 'Default text and level via `default: { text, level }`'
configOptions:
  - name: default
    type: "{ text, level }"
    description: Initial value. Both keys are optional; missing pieces fall back to empty string / first item of `levels`.
  - name: levels
    type: string[]
    description: Subset of `h1, h2, h3, h4, h5, h6, p, div, span` the author can choose. Default is all six h-levels.
gotchas:
  - Always validate the saved `level` against a whitelist before rendering — never echo it as a tag name directly, otherwise a bad attribute could render arbitrary HTML.
example: |
  { "id": "ctrl_heading",
    "type": "heading-level",
    "label": "Heading",
    "attributeKey": "heading",
    "default": { "text": "Selected projects", "level": "h2" },
    "levels": ["h2", "h3"],
    "validation": { "required": true },
    "parentPanelId": "panel" }
---

## Consume

Render the right tag dynamically. Validate the level against a whitelist so a bad attribute doesn't render arbitrary HTML.

:::codetabs
```jsx
const HEADING_LEVELS = new Set(['h1','h2','h3','h4','h5','h6','p','div','span']);

export default function Section({ attributes }) {
  const heading = attributes.heading || {};
  const Tag = HEADING_LEVELS.has(heading.level) ? heading.level : 'h2';
  return <Tag className="title">{heading.text || ''}</Tag>;
}
```
```php
<?php
$allowed_levels = ['h1','h2','h3','h4','h5','h6','p','div','span'];
$heading = $attributes['heading'] ?? [];
$tag  = in_array($heading['level'] ?? '', $allowed_levels, true)
      ? $heading['level']
      : 'h2';
$text = $heading['text'] ?? '';
?>
<<?php echo $tag; ?> class="title"><?php echo esc_html($text); ?></<?php echo $tag; ?>>
```
:::
