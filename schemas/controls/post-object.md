---
type: post-object
title: post-object
section: Field reference
order: 9
description: Pick one or many posts (or any custom post type). Stores post IDs — the React component then fetches the rest via REST (or the `getCptCollection` helper).
stored: 'number (single) or number[] (when `multiple: true`) — WP post IDs'
supports:
  - Single or multi-select via the `multiple` flag
  - Any post type (built-in or CPT) via `postType`
  - Pairs with `conditionalLogic` for latest/manual section-block patterns
configOptions:
  - name: postType
    type: string
    description: 'WP post type slug — `"post"`, `"page"`, or any custom-post-type slug. Required.'
  - name: multiple
    type: boolean
    default: false
    description: Allow selecting more than one. With `true` the saved value is an array; with `false` it's a single ID.
gotchas:
  - Saved value shape changes with `multiple`. Always check whether you're consuming a number or an array of numbers.
example: |
  { "id": "ctrl_post_ids",
    "type": "post-object",
    "label": "Brands",
    "attributeKey": "post_ids",
    "multiple": true,
    "postType": "brand",
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
