---
slug: headless/collection
title: Collection helper
section: Headless rendering
order: 4
---

A "section block" usually wants to render a strip of records pulled from a CPT — a projects grid, a testimonial slider, a brands logo wall. Authors should pick between "latest N" and "manually picked". `getCptCollection` handles both.

## Signature

```ts
async function getCptCollection(
  postType: string,
  attrs: {
    source?:    'latest' | 'manual';
    count?:     number;
    post_ids?:  number[];
  } = {}
): Promise<RestEntity[]>;
```

## Usage

:::codetabs
```jsx
import { getCptCollection } from '@/lib/wpRestClient';

export default async function Projects({ attributes }) {
  const items = await getCptCollection('project', attributes);

  return (
    <div className="row">
      {items.map((p) => (
        <article className="col-md-4" key={p.id}>
          <img src={p.meta.cover?.url} alt={p.title.rendered} />
          <h3>{p.title.rendered}</h3>
        </article>
      ))}
    </div>
  );
}
```
```php
<?php
use GCBLite\Collection;
$items = Collection::query('project', $attributes);
?>
<div class="row">
  <?php foreach ($items as $p):
    $cover = get_post_meta($p->ID, 'cover', true);
  ?>
    <article class="col-md-4">
      <img src="<?php echo esc_url($cover['url'] ?? ''); ?>"
           alt="<?php echo esc_attr(get_the_title($p)); ?>" />
      <h3><?php echo esc_html(get_the_title($p)); ?></h3>
    </article>
  <?php endforeach; ?>
</div>
```
:::

## The two modes

### `source: "latest"`

Fetches `?per_page={count}&orderby=date&order=desc`. Default count is 6 (clamped 1..100). Use this for "newest posts/projects/brands" strips.

### `source: "manual"`

Fetches `?include[]={ids...}&orderby=include` — preserves the author's explicit order. Pair with a `post-object` field to let authors curate the list.

## Pairs with this block.fields.json

```json
{ "id": "ctrl_source",
  "type": "toggle-group",
  "attributeKey": "source",
  "default": "latest",
  "options": [
    { "value": "latest", "label": "Latest" },
    { "value": "manual", "label": "Pick" }
  ] },

{ "id": "ctrl_count",
  "type": "number",
  "attributeKey": "count",
  "default": 6,
  "validation": { "min": 1, "max": 24 },
  "conditionalLogic": {
    "enabled": true,
    "rules": [{ "field": "source", "operator": "==", "value": "latest" }]
  } },

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

> The demo section blocks (brands, blog, projects, testimonials) all use this exact pattern. Copy one as a starting point.

## Caching

Calls use `fetch(url, { next: { revalidate: 30 } })` — Next.js will cache the response for 30 seconds. Editor changes appear within that window. Tune the revalidate value per route if you need faster or slower freshness.
