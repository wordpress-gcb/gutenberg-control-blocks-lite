---
type: image
title: image
section: Field reference
order: 3
description: Media library image picker. Stores a full image object — URL, alt, dimensions, optional focal point, and (when enabled) sizing / repeat / fixed-background config.
stored: 'object — { url, alt, width, height, id, focalPoint?, size?, isRepeat?, isFixed? }'
supports:
  - Media library picker with full image metadata
  - Optional FocalPointPicker for cover-cropping
  - Optional cover / contain / tile size selectors with custom width
  - Optional background-repeat and fixed-background toggles
configOptions:
  - name: enableFocalPoint
    type: boolean
    default: true
    description: Show the FocalPointPicker so the author can choose a focus point for cover-cropping.
  - name: enableSizeOptions
    type: boolean
    default: true
    description: Show cover / contain / tile + custom-width selectors.
  - name: enableRepeatOptions
    type: boolean
    default: true
    description: Toggle for background-repeat (active when size !== "cover").
  - name: enableFixedBackground
    type: boolean
    default: true
    description: 'Toggle for `background-attachment: fixed`.'
gotchas:
  - Optional fields only appear when the corresponding `enable*` flag is on AND the author touched the control. Always destructure with defaults in React.
example: |
  { "id": "ctrl_cover",
    "type": "image",
    "label": "Cover image",
    "attributeKey": "cover",
    "validation": { "required": true },
    "parentPanelId": "panel" }
---

## Consume

:::codetabs
```jsx
export default function Hero({ attributes }) {
  const cover = attributes.cover;
  if (!cover?.url) return null;

  return (
    <div
      className="hero"
      style={{
        backgroundImage: `url(${cover.url})`,
        backgroundSize:  cover.size || 'cover',
        backgroundPosition: cover.focalPoint
          ? `${cover.focalPoint.x * 100}% ${cover.focalPoint.y * 100}%`
          : 'center',
      }}
    />
  );
}
```
```php
<?php
$cover = $attributes['cover'] ?? null;
if (!$cover || empty($cover['url'])) return;

$bg_pos = isset($cover['focalPoint'])
  ? sprintf('%d%% %d%%', $cover['focalPoint']['x'] * 100, $cover['focalPoint']['y'] * 100)
  : 'center';
?>
<div
  class="hero"
  style="background-image:url(<?php echo esc_url($cover['url']); ?>);
         background-size:<?php echo esc_attr($cover['size'] ?? 'cover'); ?>;
         background-position:<?php echo esc_attr($bg_pos); ?>;"
></div>
```
:::
