---
type: oembed
title: oembed
section: Field reference
order: 41
description: URL input with a live embed preview underneath. Stores just the URL — embedding happens at render time via WP''s oEmbed handling or `<wp-embed>`.
stored: string — the embed URL (YouTube, Vimeo, Twitter, etc.)
supports:
  - 'URL-typed input with placeholder for common embed providers'
  - 'Live preview in the editor via the `<wp-embed>` web component'
configOptions:
  - name: helpText
    type: string
    description: One-line description shown below the input.
gotchas:
  - 'Stored value is a plain URL — render-side code must run it through `wp_oembed_get()` (PHP) or your own provider handler (React) to produce the embed markup.'
  - No client-side validation that the URL is actually embeddable. Authors can paste any string.
example: |
  { "id": "ctrl_video",
    "type": "oembed",
    "label": "Hero video",
    "attributeKey": "video",
    "parentPanelId": "panel" }
---

## Consume

:::codetabs
```jsx
export default function Embed({ attributes }) {
  const url = attributes.video;
  if (!url) return null;
  // Use your framework's embed component, or a server-rendered HTML chunk.
  return <iframe src={url} title="Embedded media" />;
}
```
```php
<?php
$url = $attributes['video'] ?? '';
if (!$url) return;
echo wp_oembed_get(esc_url_raw($url));
```
:::
