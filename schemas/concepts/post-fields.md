---
slug: post-fields
title: Post fields (CPT meta)
section: Post fields (CPT meta)
order: 1
---

GCB Lite's field system isn't just for blocks. The same typed controls can attach to a custom post type as a meta-box. The author edits structured fields next to (or instead of) the post body; you read the result from REST as typed JSON.

Useful for content that's a *record*, not a page — testimonials, brands, team members, projects, FAQ items. The CPT is just rows; the fields are the columns.

## Register fields on a CPT

In your theme's `functions.php`:

```php
add_action('init', function () {
    register_post_type('testimonial', [
        'label'        => __('Testimonials', 'mytheme'),
        'public'       => true,
        'show_in_rest' => true,
        'supports'     => ['title'],   // no 'editor' — fields-only
    ]);

    if (function_exists('gcblite_register_post_fields')) {
        gcblite_register_post_fields('testimonial', [
            'controls' => [
                ['type'         => 'textarea',
                 'attributeKey' => 'quote',
                 'label'        => __('Quote', 'mytheme'),
                 'validation'   => ['required' => true, 'minLength' => 10]],

                ['type'         => 'text',
                 'attributeKey' => 'author_name',
                 'label'        => __('Author name', 'mytheme'),
                 'validation'   => ['required' => true]],

                ['type'         => 'image',
                 'attributeKey' => 'author_image',
                 'label'        => __('Author headshot', 'mytheme')],
            ],
        ]);
    }
});
```

## What the author sees

Visit any post of this CPT — you'll see a *Fields* meta-box with the controls you declared. The block editor body is stripped by default (the record IS the data, not a wrapped document). Opt back in by passing `has_body => true`.

## REST exposure

Every field is automatically registered as REST `meta` with its typed schema. You can read it via:

```bash
curl "https://example.com/wp-json/wp/v2/testimonial?per_page=10&_embed=1"
```

Response:

```json
[
  {
    "id": 42,
    "title": { "rendered": "Maya Hernández" },
    "meta": {
      "quote":        "The editor preview and the live site are the same component...",
      "author_name":  "Maya Hernández",
      "author_image": {
        "url":   "https://example.com/wp-content/uploads/.../maya.jpg",
        "alt":   "Maya Hernández",
        "width": 200,
        "height":200
      }
    }
  }
]
```

> `gcblite_register_post_fields` automatically enables `custom-fields` support on the CPT — without that, WP core suppresses `meta` from REST responses even for registered fields. You don't need to add it to your `supports` array.

## Config keys

### `controls`

Required. Same shape as a block's `block.fields.json` controls array. See the [Field reference](/docs/fields).

### `has_body`

Optional (default `false`). When `true`, keeps the block editor body on the post-edit screen alongside the fields meta-box. Use this when the CPT really is a hybrid — record data PLUS a free-form body (e.g. a project with structured metadata and a long case-study).

## Consume

:::codetabs
```jsx
import { getCptCollection } from '@/lib/wpRestClient';

export default async function Testimonials({ attributes }) {
  const items = await getCptCollection('testimonial', attributes);
  return items.map((t) => (
    <blockquote key={t.id}>
      <p>{t.meta.quote}</p>
      <cite>{t.meta.author_name}</cite>
    </blockquote>
  ));
}
```
```php
<?php
use GCBLite\Collection;
$items = Collection::query('testimonial', $attributes);
foreach ($items as $t):
  $quote  = get_post_meta($t->ID, 'quote', true);
  $author = get_post_meta($t->ID, 'author_name', true);
?>
  <blockquote>
    <p><?php echo esc_html($quote); ?></p>
    <cite><?php echo esc_html($author); ?></cite>
  </blockquote>
<?php endforeach; ?>
```
:::

> The `attrs` argument is the section block's own attribute set. The helper reads `source` ("latest" / "manual"), `count`, and `post_ids` from it — so a single helper covers both query modes.
