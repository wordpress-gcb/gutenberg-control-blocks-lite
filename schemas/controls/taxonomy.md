---
type: taxonomy
title: taxonomy
section: Field reference
order: 61
description: Term picker for any taxonomy. Single or multi-select, with optional drag-to-reorder and a "create new term" UI.
stored: 'number (single) or number[] (multi) by default; or term-object(s) when `returnFormat: "object"`'
supports:
  - Single or multi-select (`multiple`, default `true`)
  - Drag-to-reorder selected terms (multi-select only)
  - Optional inline term creation
  - 'Configurable return format: IDs or full term objects'
configOptions:
  - name: taxonomy
    type: string
    default: category
    description: Taxonomy slug to search.
  - name: multiple
    type: boolean
    default: true
    description: Allow more than one term. `false` stores a single ID/object.
  - name: returnFormat
    type: string
    description: '`"id"` (default) or `"object"`. Determines whether saved values are term IDs or full term objects.'
  - name: allowCreateTerms
    type: boolean
    default: false
    description: Show a "Create new term" form in the picker popover.
gotchas:
  - 'Default is `multiple: true` — opposite of `post-object` (which defaults to single). Pick deliberately.'
  - 'When `returnFormat: "object"`, the saved value is the full WP term shape (`{ id, name, slug, ... }`) — heavier on storage but means consumers don''t need a second REST call.'
example: |
  { "id": "ctrl_tags",
    "type": "taxonomy",
    "label": "Tags",
    "attributeKey": "tags",
    "taxonomy": "post_tag",
    "allowCreateTerms": true,
    "parentPanelId": "panel" }
---
