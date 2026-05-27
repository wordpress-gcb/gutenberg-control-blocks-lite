---
type: url
title: url
section: Field reference
order: 4
description: URL picker with a custom display label and an "open in new tab" toggle. Stores all three together as a single object.
stored: '{ url: string, text: string, opensInNewTab: boolean }'
supports:
  - URL, display text, and target=_blank toggle in one field
  - 'Default values via `default: { url, text, opensInNewTab }`'
configOptions:
  - name: default
    type: object
    description: 'Initial value, e.g. `{ "url": "", "text": "Learn more", "opensInNewTab": false }`.'
gotchas:
  - When `opensInNewTab` is true, always emit both `target="_blank"` AND `rel="noopener noreferrer"` to prevent reverse-tabnabbing.
example: |
  { "id": "ctrl_cta",
    "type": "url",
    "label": "Primary CTA",
    "attributeKey": "primary_cta",
    "parentPanelId": "panel" }
---

## Consume

:::codetabs
```jsx
export default function CtaButton({ attributes }) {
  const cta = attributes.primary_cta;
  if (!cta?.url) return null;

  return (
    <a
      href={cta.url}
      target={cta.opensInNewTab ? '_blank' : undefined}
      rel={cta.opensInNewTab ? 'noopener noreferrer' : undefined}
      className="cta-btn"
    >
      {cta.text || 'Learn more'}
    </a>
  );
}
```
```php
<?php
$cta = $attributes['primary_cta'] ?? null;
if (!$cta || empty($cta['url'])) return;
$new_tab = !empty($cta['opensInNewTab']);
?>
<a
  href="<?php echo esc_url($cta['url']); ?>"
  <?php if ($new_tab): ?>target="_blank" rel="noopener noreferrer"<?php endif; ?>
  class="cta-btn"
>
  <?php echo esc_html($cta['text'] ?? 'Learn more'); ?>
</a>
```
:::
