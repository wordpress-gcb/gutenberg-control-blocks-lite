---
type: richtext
title: richtext
section: Field reference
order: 3
description: 'Tiptap-backed rich text editor. Lighter than the TinyMCE `wysiwyg` control — no jQuery, no global state. Renders inline on wide surfaces and as a popover/modal in the narrow block Inspector.'
stored: 'string — HTML, e.g. `<p>Hello <strong>world</strong></p>`. Empty document normalises to `""`.'
supports:
  - Bold / italic / strike / inline code
  - Bullet and numbered lists, blockquote
  - Headings (configurable allowed levels)
  - Links via a popover
  - Image insertion via the media library
  - Undo / redo
  - 'Three display modes: inline, popover, modal'
configOptions:
  - name: headingLevels
    type: number[]
    default: '[2, 3, 4]'
    description: Which heading levels appear in the block-type select.
  - name: allowImages
    type: boolean
    default: true
    description: Show the insert-image toolbar button. Set to `false` for caption-style fields.
  - name: display
    type: 'string — "inline" | "popover" | "modal"'
    description: 'Force a specific display mode. Default behaviour: `popover` in sidebar variants, `inline` on wide surfaces.'
  - name: placeholder
    type: string
    description: Greyed-out hint shown on the collapsed button in popover/modal mode.
gotchas:
  - 'Empty editor returns `""`, not `"<p></p>"`. Required-validation works correctly.'
  - 'The TinyMCE-based `wysiwyg` control is a backwards-compat alias for this — same component, same stored HTML shape.'
example: |
  { "id": "ctrl_body",
    "type": "richtext",
    "label": "Body",
    "attributeKey": "body",
    "headingLevels": [2, 3],
    "parentPanelId": "panel" }
---

## Consume

:::codetabs
```jsx
export default function Body({ attributes }) {
  const html = attributes.body || '';
  return <div className="body" dangerouslySetInnerHTML={{ __html: html }} />;
}
```
```php
<?php
$html = $attributes['body'] ?? '';
?>
<div class="body"><?php echo wp_kses_post($html); ?></div>
```
:::
