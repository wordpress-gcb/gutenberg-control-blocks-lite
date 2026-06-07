---
type: query-loop
title: query-loop
section: Field reference
order: 65
description: 'A paginated server-side query over a post type. The block renders page 1 server-side; the front end fetches further pages from the GCB query REST endpoint. Use this for "show all of a CPT, paginated/filterable" — as opposed to `relationship`, where an editor hand-picks a fixed set.'
stored: 'object — the query config (postType, perPage, orderby, order, pagination, filterTaxonomies)'
supports:
  - Server-side WP_Query by post type
  - Pagination (numbered pager or load-more button)
  - Front-end taxonomy filtering (AND across facets, OR within a facet)
  - Ordering (date / title / menu_order / rand / modified)
configOptions:
  - name: postType
    type: string
    description: The post type slug to query (usually the CPT the records live in).
  - name: perPage
    type: integer
    default: 12
    description: Records per page (1–100, capped at 100).
  - name: orderby
    type: string
    default: date
    description: 'One of: date, title, menu_order, rand, modified.'
  - name: order
    type: string
    default: DESC
    description: ASC or DESC.
  - name: pagination
    type: string
    default: numbered
    description: '`numbered` (page buttons), `loadmore` (a Load-more button), or `none`.'
  - name: enableTaxonomyFilter
    type: boolean
    default: false
    description: Show front-end taxonomy filter controls.
  - name: filterTaxonomies
    type: "{ slug, label }[]"
    description: Taxonomies the visitor can filter by (must belong to the post type). Only these are honoured by the endpoint.
gotchas:
  - 'Set `attributeType: "object"` on the control — the stored value is the query config object.'
  - 'render.php must NOT write its own WP_Query. Call `GCBLite\Blocks\Queries\QueryLoop::render_items($config, fn($post) => "...")` — it owns the query, the current page, the active filters and the pager markup, so the same template serves page 1 (server) and pages 2+ (the REST fragment).'
  - 'The wrapper needs `data-block` (the block name) and `data-attrs` (wp_json_encode of $attributes) so view.js can fetch more pages from /gcblite/v1/query.'
  - 'Unlike `relationship`, the editor does not pick individual records here — the query decides what shows. Use `relationship` when the client wants to curate an exact, ordered set.'
example: |
  { "id": "ctrl_query",
    "type": "query-loop",
    "label": "People",
    "attributeKey": "query",
    "attributeType": "object",
    "postType": "team-member",
    "perPage": 12,
    "orderby": "title",
    "order": "ASC",
    "pagination": "numbered",
    "enableTaxonomyFilter": true,
    "filterTaxonomies": [ { "slug": "department", "label": "Department" } ] }
---
