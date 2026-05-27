---
type: relationship
title: relationship
section: Field reference
order: 64
description: 'Multi-select post relationship. Today this is a thin alias over `post-object` with `multiple: true` forced on — same picker, same stored shape.'
stored: 'number[] (default) OR post-object[] when `returnFormat: "object"` is set'
supports:
  - Multi-select with drag-to-reorder
  - All `post-object` features (post type filter, taxonomy filter, return format, etc.)
configOptions:
  - name: postType
    type: 'string | string[]'
    description: WP post type slug(s) to search.
  - name: returnFormat
    type: string
    description: '`"id"` (default) stores post IDs; `"object"` stores full post objects.'
  - name: enablePostTypeFilter
    type: boolean
    default: false
    description: Show a post-type dropdown in the picker (when multiple types are allowed).
  - name: enableTaxonomyFilter
    type: boolean
    default: false
    description: Show taxonomy term dropdowns in the picker.
  - name: filterTaxonomies
    type: "{ slug, label }[]"
    description: Taxonomies to surface as filters.
gotchas:
  - 'Functionally identical to `post-object` with `multiple: true`. Pick whichever name reads better in your `block.fields.json`.'
example: |
  { "id": "ctrl_related",
    "type": "relationship",
    "label": "Related projects",
    "attributeKey": "related",
    "postType": "project",
    "parentPanelId": "panel" }
---
