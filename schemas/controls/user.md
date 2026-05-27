---
type: user
title: user
section: Field reference
order: 62
description: WP user picker. Single or multi-select with drag-to-reorder. Stores user IDs by default, or full user objects when configured.
stored: 'number (single) or number[] (multi) by default; or user-object(s) when `returnFormat: "object"`'
supports:
  - Single or multi-select (`multiple`, default `false`)
  - Drag-to-reorder selected users (multi-select only)
  - Search via `/wp/v2/users`
configOptions:
  - name: multiple
    type: boolean
    default: false
    description: Allow selecting more than one user.
  - name: returnFormat
    type: string
    description: '`"id"` (default) or `"object"`. With `"object"` the saved value is `{ id, name }`.'
gotchas:
  - 'Default is `multiple: false` — single-select. Set `multiple: true` for author teams etc.'
  - 'Search hits `/wp/v2/users` which only returns users with published content unless the current user can `list_users`. Editors may see different results than admins.'
example: |
  { "id": "ctrl_authors",
    "type": "user",
    "label": "Authors",
    "attributeKey": "authors",
    "multiple": true,
    "parentPanelId": "panel" }
---
