---
type: file
title: file
section: Field reference
order: 52
description: Non-image attachment picker (PDFs, documents, archives, etc.). Opens the WP media library and stores a small attachment object.
stored: '{ id: number, url: string, filename: string, title: string }'
supports:
  - Media library picker constrained by MIME type
  - Replace and Remove actions on the selected file
configOptions:
  - name: allowedTypes
    type: string[]
    default: '["application", "text", "image", "video", "audio"]'
    description: 'MIME top-level types to allow in the media library picker (e.g. `["application", "text"]` for PDFs and docs).'
gotchas:
  - Despite the broad default `allowedTypes`, this control is intended for non-image uploads. Use `image` for images and `gallery` for collections.
  - 'When the value is unset the object is still present with empty fields — always check `value?.url` rather than truthiness of `value`.'
example: |
  { "id": "ctrl_brochure",
    "type": "file",
    "label": "Brochure PDF",
    "attributeKey": "brochure",
    "allowedTypes": ["application"],
    "parentPanelId": "panel" }
---

## Consume

:::codetabs
```jsx
export default function Download({ attributes }) {
  const f = attributes.brochure;
  if (!f?.url) return null;
  return <a href={f.url} download>{f.title || f.filename}</a>;
}
```
```php
<?php
$f = $attributes['brochure'] ?? null;
if (!$f || empty($f['url'])) return;
?>
<a href="<?php echo esc_url($f['url']); ?>" download>
  <?php echo esc_html($f['title'] ?? $f['filename'] ?? ''); ?>
</a>
```
:::
