---
type: gallery
title: gallery
section: Field reference
order: 51
description: Multi-image picker with per-item focal point, size, repeat, and fixed-background settings. Rows are drag-to-reorder.
stored: array of image objects — same shape as a single `image` value, one per gallery item.
supports:
  - Media library multi-select with gallery editor
  - Drag-to-reorder via dnd-kit
  - Per-image focal point, size, custom width, repeat, fixed-background
  - Re-selecting in the media library preserves per-item settings for kept images
configOptions:
  - name: helpText
    type: string
    description: One-line description shown above the gallery.
gotchas:
  - 'Stored value is always an array. Always check `Array.isArray(value)` before mapping — empty galleries are `[]`, not `null`.'
  - Each item is the full image object (url, alt, focalPoint, size, etc.), so the same renderer that handles single `image` values mostly works per-item.
example: |
  { "id": "ctrl_screens",
    "type": "gallery",
    "label": "Screenshots",
    "attributeKey": "screens",
    "parentPanelId": "panel" }
---

## Consume

:::codetabs
```jsx
export default function Screens({ attributes }) {
  const items = Array.isArray(attributes.screens) ? attributes.screens : [];
  if (items.length === 0) return null;
  return (
    <ul className="gallery">
      {items.map((img) => (
        <li key={img.id}>
          <img src={img.url} alt={img.alt || ''} width={img.width} height={img.height} />
        </li>
      ))}
    </ul>
  );
}
```
```php
<?php
$items = is_array($attributes['screens'] ?? null) ? $attributes['screens'] : [];
if (empty($items)) return;
?>
<ul class="gallery">
  <?php foreach ($items as $img): ?>
    <li>
      <img src="<?php echo esc_url($img['url']); ?>"
           alt="<?php echo esc_attr($img['alt'] ?? ''); ?>"
           width="<?php echo (int)($img['width'] ?? 0); ?>"
           height="<?php echo (int)($img['height'] ?? 0); ?>" />
    </li>
  <?php endforeach; ?>
</ul>
```
:::
