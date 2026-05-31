---
type: post-object
title: post-object
section: Field reference
order: 9
description: 'Pick one or many posts (or any custom post type). Stores `{ post_type, ids[] }` — the chosen post type alongside the IDs. Omit `postType` to let the editor pick which post type to use at edit time.'
stored: '`{ post_type: string, ids: number[] }` — always the canonical shape. Legacy stored values (bare IDs, or returnFormat object) are still read correctly.'
supports:
  - Single or multi-select via the `multiple` flag
  - Any post type (built-in or CPT) via `postType`
  - 'Open-ended mode: omit `postType` to let the editor user pick the post type at edit time'
  - Pairs with `conditionalLogic` for latest/manual section-block patterns
configOptions:
  - name: postType
    type: string
    description: 'Optional. Lock the field to one (or comma-separated multiple) post type slugs. When omitted, the editor user picks via a dropdown at edit time. Stored value always carries the chosen post type alongside the IDs.'
  - name: multiple
    type: boolean
    default: false
    description: Allow selecting more than one. With `true` the saved ids array can have multiple entries; with `false` it has exactly one.
gotchas:
  - 'Switching post type in the open-ended picker clears the selected IDs — they don''t translate across post types.'
  - 'The relationship control is a thin alias: it''s post-object with `multiple: true` forced. Same shape, same picker.'
example: |
  // Schema-locked: post type fixed to brand.
  { "id": "ctrl_post_ids",
    "type": "post-object",
    "label": "Brands",
    "attributeKey": "post_ids",
    "multiple": true,
    "postType": "brand",
    "parentPanelId": "panel" }

  // Open-ended: editor picks the post type.
  { "id": "ctrl_featured",
    "type": "post-object",
    "label": "Featured content",
    "attributeKey": "featured",
    "parentPanelId": "panel" }
---

## Pair with conditional logic

The pattern the demo section blocks use: a `source` toggle picks between "latest" and "manual", and the post-object only shows when source == manual:

```json
{ "id": "ctrl_post_ids",
  "type": "post-object",
  "attributeKey": "post_ids",
  "multiple": true,
  "postType": "project",
  "conditionalLogic": {
    "enabled": true,
    "rules": [{ "field": "source", "operator": "==", "value": "manual" }]
  } }
```

## Consume

> On the React side, use the bundled `getCptCollection(postType, attrs)` helper from `lib/wpRestClient.js`. On the PHP side, use the matching `GCBLite\Collection::query()` — both handle latest + manual modes with the same attrs shape.

:::codetabs
```jsx
import { getCptCollection } from '@/lib/wpRestClient';

export default async function Brands({ attributes }) {
  const items = await getCptCollection('brand', attributes);
  return (
    <div className="row">
      {items.map((b) => (
        <div className="col-lg-3" key={b.id}>
          <img src={b.meta.logo?.url} alt={b.title.rendered} />
        </div>
      ))}
    </div>
  );
}
```
```php
<?php
use GCBLite\Collection;
$items = Collection::query('brand', $attributes);
?>
<div class="row">
  <?php foreach ($items as $b):
    $logo = get_post_meta($b->ID, 'logo', true);
  ?>
    <div class="col-lg-3">
      <img src="<?php echo esc_url($logo['url'] ?? ''); ?>"
           alt="<?php echo esc_attr(get_the_title($b)); ?>" />
    </div>
  <?php endforeach; ?>
</div>
```
:::
