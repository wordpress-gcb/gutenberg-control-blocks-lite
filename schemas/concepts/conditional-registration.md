---
title: Conditional registration (displayWhen)
section: Concepts
order: 50
---

# Show field sets only when conditions match

Add a `displayWhen` clause to any structured-field config to gate when the field set appears. The rules evaluate server-side: if they don't pass, the metabox / sidebar panel / options page / user panel just doesn't render. ACF authors will recognise the idea — same model as ACF Location Rules.

## The shape

Three accepted forms, in order of increasing complexity:

**Single rule** — one condition, applied directly:

```json
{
  "displayWhen": { "key": "post_type", "operator": "=", "value": "page" }
}
```

**Implicit AND** — an array of single rules, all must pass:

```json
{
  "displayWhen": [
    { "key": "post_type", "operator": "=", "value": "page" },
    { "key": "post_id",   "operator": "=", "value": 42 }
  ]
}
```

**Explicit groups** — full AND/OR matrix:

```json
{
  "displayWhen": {
    "any": [
      { "all": [
        { "key": "post_type", "operator": "=", "value": "page" },
        { "key": "post_id",   "operator": "=", "value": 42 }
      ]},
      { "all": [
        { "key": "post_type",     "operator": "=",         "value": "post" },
        { "key": "taxonomy_term", "operator": "contains",
          "value": { "taxonomy": "category", "term": "news" } }
      ]}
    ]
  }
}
```

Read that last one as: *"show on (page #42) OR (a post tagged `news`)"*.

## Supported keys

| Key              | Available on            | Operators                                |
| ---------------- | ----------------------- | ---------------------------------------- |
| `post_type`      | post-fields             | `=`, `!=`, `in`, `not_in`                |
| `post_id`        | post-fields             | `=`, `!=`, `in`, `not_in`, `>`, `>=`, `<`, `<=` |
| `post_template`  | post-fields             | `=`, `!=`                                |
| `post_status`    | post-fields             | `=`, `!=`                                |
| `post_parent`    | post-fields             | `=`, `!=`, `in`                          |
| `taxonomy_term`  | post-fields             | `contains`, `not_contains`               |
| `taxonomy`       | taxonomy-fields         | `=`, `!=`                                |
| `term_id`        | taxonomy-fields         | `=`, `!=`, `in`                          |
| `options_slug`   | options-fields          | `=`, `!=`, `in`                          |
| `target_user_id` | user-fields             | `=`, `!=`, `in`                          |
| `user_role`      | all                     | `=`, `!=`, `in`                          |
| `current_user_id`| all                     | `=`, `in`                                |

The `taxonomy_term` value shape is `{ taxonomy, term }` — use the term slug, not the term ID. The slug is what shows up in REST and what authors are most likely to type.

## How it's evaluated

The evaluator runs in `RuleEngine::matches()` on each registrar's render hook. For post-fields this is `add_meta_boxes` (so the panel never gets registered when rules fail); for options-fields it's `admin_menu` (so the menu item itself disappears); for taxonomy and user it's the panel render callback.

Missing `displayWhen` means "always show" — same behaviour as before this feature existed.

**Unknown keys evaluate to `false`** — fail-safe. A typo'd rule hides the panel instead of accidentally showing it on every screen.

## Examples

### Show a "social share image" only on pages

```json
{
  "displayWhen": { "key": "post_type", "operator": "=", "value": "page" },
  "controls": [
    { "type": "image", "attributeKey": "social_image", "label": "Social image" }
  ]
}
```

### Show "release notes" fields only on the Changelog page (id 42)

```json
{
  "displayWhen": [
    { "key": "post_type", "operator": "=", "value": "page" },
    { "key": "post_id",   "operator": "=", "value": 42 }
  ],
  "controls": [ /* … */ ]
}
```

### Show "press kit" fields only on posts in the `news` category

```json
{
  "displayWhen": {
    "all": [
      { "key": "post_type",     "operator": "=",        "value": "post" },
      { "key": "taxonomy_term", "operator": "contains",
        "value": { "taxonomy": "category", "term": "news" } }
    ]
  }
}
```

### Show an "internal notes" panel only to administrators

```json
{
  "displayWhen": { "key": "user_role", "operator": "=", "value": "administrator" }
}
```

### Hide a Subscribers options page from non-admins

```json
{
  "displayWhen": { "key": "user_role", "operator": "=", "value": "administrator" }
}
```

(Equivalent to setting `capability: manage_options` but expressed declaratively.)
