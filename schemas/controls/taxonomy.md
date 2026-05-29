---
type: taxonomy
title: taxonomy
section: Field reference
order: 61
description: 'Term picker for any taxonomy. Single or multi-select, with optional drag-to-reorder and a "create new term" UI. Omit `taxonomy` to let the editor pick which taxonomy to use at edit time.'
stored: '`{ taxonomy: string, ids: number[] }` — always the canonical shape, whether the schema locks a taxonomy or not. Legacy stored values (bare IDs) are still read correctly.'
supports:
  - Single or multi-select (`multiple`, default `true`)
  - Drag-to-reorder selected terms (multi-select only)
  - Optional inline term creation
  - 'Open-ended mode: omit `taxonomy` to let the editor user pick the taxonomy at edit time'
configOptions:
  - name: taxonomy
    type: string
    description: 'Optional. Lock the field to one taxonomy slug. When omitted, the editor user picks via a dropdown at edit time. Stored value always carries the chosen taxonomy alongside the IDs.'
  - name: restBase
    type: string
    description: 'Optional override for the REST base of a taxonomy with a non-standard rest_base. Only needed when register_taxonomy() set a custom rest_base.'
  - name: multiple
    type: boolean
    default: true
    description: Allow more than one term. `false` stores a single-element ids array.
  - name: allowCreateTerms
    type: boolean
    default: false
    description: Show a "Create new term" form in the picker popover.
gotchas:
  - 'Default is `multiple: true` — opposite of `post-object` (which defaults to single). Pick deliberately.'
  - 'REST base ≠ taxonomy slug for built-ins (`category` → `categories`, `post_tag` → `tags`). The control resolves this automatically; only override `restBase` if you registered a custom one.'
  - 'Switching taxonomy in the open-ended picker clears the selected IDs — they don''t translate across taxonomies.'
example: |
  // Schema-locked: taxonomy fixed to post_tag.
  { "id": "ctrl_tags",
    "type": "taxonomy",
    "label": "Tags",
    "attributeKey": "tags",
    "taxonomy": "post_tag",
    "allowCreateTerms": true,
    "parentPanelId": "panel" }

  // Open-ended: editor picks the taxonomy.
  { "id": "ctrl_classification",
    "type": "taxonomy",
    "label": "Classification",
    "attributeKey": "classification",
    "parentPanelId": "panel" }
---
